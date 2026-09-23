package com.ragapi.service.course.search;

import com.ragapi.service.course.gateway.CourseRerankGateway;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

/** Chooses external semantic reranking or the local deterministic fallback. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseSearchResultRankingService {

    private final CourseRerankGateway rerankGateway;
    private final CourseHeuristicRankingService heuristicRankingService;

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
        return heuristicRankingService.rerank(query, chunks, topKAfter, reason);
    }
}
