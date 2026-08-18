package com.ragapi.service;

import com.ragapi.util.QuestionOverlapUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovedKnowledgeRetrievalService {

    private final ElasticVectorService vectorService;

    @Value("${rag.approved-knowledge.max-chunks:2}")
    private int maxChunks;

    @Value("${rag.approved-knowledge.min-score:0.60}")
    private double minScore;

    @Value("${rag.approved-knowledge.strong-semantic-score:0.82}")
    private double strongSemanticScore;

    @Value("${rag.approved-knowledge.min-keyword-overlap:0.12}")
    private double minKeywordOverlap;

    public List<ElasticVectorService.SearchChunk> retrieveRelevant(
            String question,
            String courseId,
            String classId
    ) {
        try {
            int candidateCount = Math.max(maxChunks, maxChunks * 4);
            List<ElasticVectorService.SearchChunk> candidates =
                    vectorService.searchApprovedKnowledgeWithScores(
                            question,
                            courseId,
                            classId,
                            candidateCount
                    );
            List<ElasticVectorService.SearchChunk> matches = candidates.stream()
                    .filter(chunk -> isRelevant(question, chunk))
                    .limit(Math.max(1, maxChunks))
                    .toList();
            if (!matches.isEmpty()) {
                log.info("Pinned {} relevant senior-approved knowledge chunks for courseId={}",
                        matches.size(), courseId);
            }
            return matches;
        } catch (IOException error) {
            log.warn("Approved knowledge retrieval unavailable for courseId={}: {}",
                    courseId, error.getMessage());
            return List.of();
        }
    }

    private boolean isRelevant(String question, ElasticVectorService.SearchChunk chunk) {
        double score = chunk.score() == null ? 0.0 : chunk.score();
        if (score >= strongSemanticScore) {
            return true;
        }
        double keywordOverlap = QuestionOverlapUtil.keywordOverlapRatio(question, chunk.content());
        return score >= minScore && keywordOverlap >= minKeywordOverlap;
    }
}
