package com.ragapi.harness.retrieval;

import com.ragapi.harness.gateway.CourseRerankGateway;
import com.ragapi.harness.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Chooses external semantic reranking or the local deterministic fallback. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseSearchResultRankingService {

    private final CourseRerankGateway rerankGateway;

    private static final Set<String> STOP_WORDS = Set.of(
            "and", "are", "definition", "for", "from", "how", "the", "what",
            "cua", "cho", "gi", "la", "nhu", "va"
    );

    @Value("${rag.rerank.enabled:false}")
    private boolean enabled;

    @Value("${rag.rerank.top-k-before:20}")
    private int topKBefore;

    @Value("${rag.rerank.top-k-after:5}")
    private int topKAfter;

    public List<RetrievedCourseChunk> rerank(String query, List<RetrievedCourseChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        if (!enabled) {
            log.debug("Rerank disabled; preserving all {} hybrid retrieval chunks", chunks.size());
            return List.copyOf(chunks);
        }

        List<RetrievedCourseChunk> candidates = chunks.stream()
                .filter(chunk -> chunk.content() != null && !chunk.content().isBlank())
                .limit(Math.max(1, topKBefore))
                .toList();
        if (candidates.size() <= 1) {
            return candidates;
        }
        if (query == null || query.isBlank()) {
            return fallback(query, chunks, "query is blank");
        }
        if (!rerankGateway.isAvailable()) {
            return fallback(query, chunks, "rerank provider is unavailable");
        }

        try {
            List<RetrievedCourseChunk> reranked = rerankGateway.rerank(query, candidates, topKAfter);
            if (reranked == null || reranked.isEmpty()) {
                return fallback(query, chunks, "rerank provider returned no results");
            }
            log.info("Reranked {} candidate chunks down to {} chunks", candidates.size(), reranked.size());
            return reranked;
        } catch (Exception exception) {
            log.warn("Rerank call failed. Falling back to local lexical reranking: {}", exception.getMessage());
            return fallback(query, chunks, "rerank exception");
        }
    }

    private List<RetrievedCourseChunk> fallback(
            String query,
            List<RetrievedCourseChunk> chunks,
            String reason
    ) {
        return lexicalRerank(query, chunks, topKAfter, reason);
    }

    private List<RetrievedCourseChunk> lexicalRerank(
            String query,
            List<RetrievedCourseChunk> chunks,
            int topK,
            String reason
    ) {
        int limit = Math.min(Math.max(1, topK), chunks.size());
        Set<String> queryTokens = meaningfulTokens(query);
        if (queryTokens.isEmpty()) {
            log.debug("Rerank fallback used without lexical tokens: {}", reason);
            return chunks.stream().limit(limit).toList();
        }

        List<RetrievedCourseChunk> reranked = new ArrayList<>(chunks);
        reranked.sort(
                Comparator.comparingDouble(
                                (RetrievedCourseChunk chunk) -> lexicalScore(queryTokens, chunk.content()))
                        .reversed()
                        .thenComparing(
                                chunk -> chunk.score() == null ? Double.NEGATIVE_INFINITY : chunk.score(),
                                Comparator.reverseOrder())
        );
        log.info("Local lexical rerank fallback selected {} of {} chunks: {}", limit, chunks.size(), reason);
        return reranked.stream().limit(limit).toList();
    }

        private double lexicalScore(Set<String> queryTokens, String content) {
        Set<String> contentTokens = meaningfulTokens(content);
        if (contentTokens.isEmpty()) {
            return 0.0;
        }
        long matches = queryTokens.stream().filter(contentTokens::contains).count();
        return (double) matches / queryTokens.size();
    }

        private Set<String> meaningfulTokens(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return Set.of();
        }
        Set<String> tokens = new LinkedHashSet<>();
        for (String token : normalized.split("\\s+")) {
            if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }
}
