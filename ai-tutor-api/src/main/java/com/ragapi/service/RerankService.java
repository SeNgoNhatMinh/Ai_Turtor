package com.ragapi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class RerankService {

    private final ObjectMapper objectMapper;
    private final PrivacySanitizer privacySanitizer;

    @Value("${rag.rerank.enabled:false}")
    private boolean enabled;

    @Value("${rag.rerank.api-key:}")
    private String apiKey;

    @Value("${rag.rerank.base-url:https://openrouter.ai/api/v1}")
    private String baseUrl;

    @Value("${rag.rerank.model:nvidia/llama-nemotron-rerank-vl-1b-v2:free}")
    private String model;

    @Value("${rag.rerank.top-k-before:20}")
    private int topKBefore;

    @Value("${rag.rerank.top-k-after:5}")
    private int topKAfter;

    @Value("${rag.rerank.timeout-seconds:10}")
    private int timeoutSeconds;

    @Value("${rag.rerank.max-document-chars:2000}")
    private int maxDocumentChars;

    public List<ElasticVectorService.SearchChunk> rerank(String query, List<ElasticVectorService.SearchChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        if (!enabled) {
            return fallback(chunks, "rerank disabled");
        }
        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("missing-")) {
            return fallback(chunks, "rerank api key is missing");
        }
        if (query == null || query.isBlank()) {
            return fallback(chunks, "query is blank");
        }

        List<ElasticVectorService.SearchChunk> candidates = chunks.stream()
                .filter(chunk -> chunk.content() != null && !chunk.content().isBlank())
                .limit(Math.max(1, topKBefore))
                .toList();
        if (candidates.size() <= 1) {
            return candidates;
        }

        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", model);
            body.put("query", privacySanitizer.sanitize(query));
            body.put("top_n", Math.min(Math.max(1, topKAfter), candidates.size()));

            ArrayNode documents = objectMapper.createArrayNode();
            for (ElasticVectorService.SearchChunk candidate : candidates) {
                documents.add(privacySanitizer.sanitize(truncate(candidate.content(), maxDocumentChars)));
            }
            body.set("documents", documents);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(baseUrl) + "/rerank"))
                    .timeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("X-Title", "AI Tutor Platform")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Rerank API failed with status {}. Falling back to Elasticsearch order. Body: {}",
                        response.statusCode(), truncate(response.body(), 500));
                return fallback(chunks, "rerank api returned non-2xx");
            }

            List<ElasticVectorService.SearchChunk> reranked = parseRerankResponse(response.body(), candidates);
            if (reranked.isEmpty()) {
                return fallback(chunks, "rerank api returned no results");
            }
            log.info("Reranked {} candidate chunks down to {} chunks", candidates.size(), reranked.size());
            return reranked;
        } catch (Exception e) {
            log.warn("Rerank API call failed. Falling back to Elasticsearch order: {}", e.getMessage());
            return fallback(chunks, "rerank exception");
        }
    }

    private List<ElasticVectorService.SearchChunk> parseRerankResponse(
            String responseBody,
            List<ElasticVectorService.SearchChunk> candidates
    ) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode results = root.path("results");
        if (!results.isArray()) {
            return List.of();
        }

        List<ScoredIndex> scoredIndexes = new ArrayList<>();
        for (JsonNode result : results) {
            int index = result.path("index").asInt(-1);
            if (index < 0 || index >= candidates.size()) {
                continue;
            }
            double score = result.has("relevance_score")
                    ? result.path("relevance_score").asDouble(0.0)
                    : result.path("score").asDouble(0.0);
            scoredIndexes.add(new ScoredIndex(index, score));
        }

        scoredIndexes.sort(Comparator.comparing(ScoredIndex::score).reversed());
        List<ElasticVectorService.SearchChunk> reranked = new ArrayList<>();
        Set<Integer> usedIndexes = new HashSet<>();
        int limit = Math.min(Math.max(1, topKAfter), candidates.size());

        for (ScoredIndex scoredIndex : scoredIndexes) {
            if (reranked.size() >= limit) {
                break;
            }
            ElasticVectorService.SearchChunk original = candidates.get(scoredIndex.index());
            reranked.add(new ElasticVectorService.SearchChunk(
                    original.content(),
                    scoredIndex.score(),
                    original.materialId(),
                    original.courseId(),
                    original.classId(),
                    original.teacherId(),
                    original.materialScope()
            ));
            usedIndexes.add(scoredIndex.index());
        }

        for (int i = 0; reranked.size() < limit && i < candidates.size(); i++) {
            if (!usedIndexes.contains(i)) {
                reranked.add(candidates.get(i));
            }
        }
        return reranked;
    }

    private List<ElasticVectorService.SearchChunk> fallback(List<ElasticVectorService.SearchChunk> chunks, String reason) {
        int limit = Math.min(Math.max(1, topKAfter), chunks.size());
        log.debug("Rerank fallback used: {}", reason);
        return chunks.stream().limit(limit).toList();
    }

    private String normalizeBaseUrl(String value) {
        String safeValue = value == null || value.isBlank() ? "https://openrouter.ai/api/v1" : value.trim();
        return safeValue.endsWith("/") ? safeValue.substring(0, safeValue.length() - 1) : safeValue;
    }

    private String truncate(String value, int maxChars) {
        if (value == null) {
            return "";
        }
        int safeMax = Math.max(200, maxChars);
        return value.length() <= safeMax ? value : value.substring(0, safeMax);
    }

    private record ScoredIndex(int index, double score) {}
}
