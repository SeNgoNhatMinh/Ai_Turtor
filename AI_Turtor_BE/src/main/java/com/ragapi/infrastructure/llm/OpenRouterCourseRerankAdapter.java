package com.ragapi.infrastructure.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ragapi.service.PrivacySanitizer;
import com.ragapi.service.course.gateway.CourseRerankGateway;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
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

/** HTTP adapter for the OpenRouter-compatible rerank endpoint. */
@Component
@RequiredArgsConstructor
public class OpenRouterCourseRerankAdapter implements CourseRerankGateway {

    private final ObjectMapper objectMapper;
    private final PrivacySanitizer privacySanitizer;

    @Value("${rag.rerank.api-key:}")
    private String apiKey;

    @Value("${rag.rerank.base-url:https://openrouter.ai/api/v1}")
    private String baseUrl;

    @Value("${rag.rerank.model:nvidia/llama-nemotron-rerank-vl-1b-v2:free}")
    private String model;

    @Value("${rag.rerank.timeout-seconds:10}")
    private int timeoutSeconds;

    @Value("${rag.rerank.max-document-chars:2000}")
    private int maxDocumentChars;

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("missing-");
    }

    @Override
    public List<RetrievedCourseChunk> rerank(
            String query,
            List<RetrievedCourseChunk> candidates,
            int topK
    ) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("query", privacySanitizer.sanitize(query));
        body.put("top_n", Math.min(Math.max(1, topK), candidates.size()));
        ArrayNode documents = objectMapper.createArrayNode();
        for (RetrievedCourseChunk candidate : candidates) {
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
            throw new IOException("Rerank API returned HTTP " + response.statusCode());
        }
        return parseResponse(response.body(), candidates, topK);
    }

    private List<RetrievedCourseChunk> parseResponse(
            String responseBody,
            List<RetrievedCourseChunk> candidates,
            int topK
    ) throws Exception {
        JsonNode results = objectMapper.readTree(responseBody).path("results");
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
        List<RetrievedCourseChunk> reranked = new ArrayList<>();
        Set<Integer> usedIndexes = new HashSet<>();
        int limit = Math.min(Math.max(1, topK), candidates.size());
        for (ScoredIndex scoredIndex : scoredIndexes) {
            if (reranked.size() >= limit) {
                break;
            }
            reranked.add(candidates.get(scoredIndex.index()).withScore(scoredIndex.score()));
            usedIndexes.add(scoredIndex.index());
        }
        for (int index = 0; reranked.size() < limit && index < candidates.size(); index++) {
            if (!usedIndexes.contains(index)) {
                reranked.add(candidates.get(index));
            }
        }
        return reranked;
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

    private record ScoredIndex(int index, double score) {
    }
}
