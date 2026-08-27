package com.ragapi.service;

import com.ragapi.util.QuestionOverlapUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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
                    .sorted(Comparator.comparing(
                            (ElasticVectorService.SearchChunk chunk) -> chunk.score() == null ? 0.0 : chunk.score(),
                            Comparator.reverseOrder()))
                    .toList();
            List<ElasticVectorService.SearchChunk> deduped = collapseDuplicateQuestions(matches);
            List<ElasticVectorService.SearchChunk> limited = deduped.stream()
                    .limit(Math.max(1, maxChunks))
                    .toList();
            if (!limited.isEmpty()) {
                log.info("Pinned {} relevant senior-approved knowledge chunks for courseId={}",
                        limited.size(), courseId);
            } else if (candidates != null && !candidates.isEmpty()) {
                log.warn(
                        "Filtered all {} senior-approved ES hits for courseId={} question={}",
                        candidates.size(),
                        courseId,
                        question
                );
            }
            return limited;
        } catch (IOException error) {
            log.warn("Approved knowledge retrieval unavailable for courseId={}: {}",
                    courseId, error.getMessage());
            return List.of();
        }
    }

    /**
     * Keep one strongest chunk per material and per normalized question cluster so
     * two Senior answers for the same question do not crowd or contradict each other.
     */
    private List<ElasticVectorService.SearchChunk> collapseDuplicateQuestions(
            List<ElasticVectorService.SearchChunk> matches
    ) {
        Map<String, ElasticVectorService.SearchChunk> byMaterial = new LinkedHashMap<>();
        for (ElasticVectorService.SearchChunk chunk : matches) {
            String materialKey = chunk.materialId() == null || chunk.materialId().isBlank()
                    ? "anon-" + byMaterial.size()
                    : chunk.materialId();
            byMaterial.putIfAbsent(materialKey, chunk);
        }
        Map<String, ElasticVectorService.SearchChunk> byQuestion = new LinkedHashMap<>();
        for (ElasticVectorService.SearchChunk chunk : byMaterial.values()) {
            String questionKey = extractQuestionKey(chunk.content());
            ElasticVectorService.SearchChunk existing = byQuestion.get(questionKey);
            if (existing == null) {
                byQuestion.put(questionKey, chunk);
                continue;
            }
            double existingScore = existing.score() == null ? 0.0 : existing.score();
            double nextScore = chunk.score() == null ? 0.0 : chunk.score();
            if (nextScore > existingScore) {
                byQuestion.put(questionKey, chunk);
            }
        }
        return new ArrayList<>(byQuestion.values());
    }

    private String extractQuestionKey(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String normalized = content.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        int qIdx = normalized.indexOf("câu hỏi:");
        int aIdx = normalized.indexOf("câu trả lời:");
        if (qIdx >= 0) {
            int start = qIdx + "câu hỏi:".length();
            int end = aIdx > start ? aIdx : Math.min(normalized.length(), start + 180);
            return normalized.substring(start, end).trim();
        }
        return normalized.length() <= 160 ? normalized : normalized.substring(0, 160);
    }

    private boolean isRelevant(String question, ElasticVectorService.SearchChunk chunk) {
        double score = chunk.score() == null ? 0.0 : chunk.score();
        if (score >= strongSemanticScore) {
            return true;
        }
        String storedQuestion = extractQuestionKey(chunk.content());
        if (storedQuestion.isBlank() && chunk.content() != null) {
            storedQuestion = chunk.content();
        }
        // Indexed Senior Q&A is already course-scoped. Match the student question to the
        // stored question line — Jaccard against the full long answer is almost always too low.
        if (QuestionOverlapUtil.areSimilarQuestions(question, storedQuestion, 0.40)) {
            return true;
        }
        double questionOverlap = QuestionOverlapUtil.keywordOverlapRatio(question, storedQuestion);
        if (questionOverlap >= 0.35) {
            return true;
        }
        String relevanceText = storedQuestion + " " + extractAnswerLead(chunk.content());
        double keywordOverlap = QuestionOverlapUtil.keywordOverlapRatio(question, relevanceText);
        return score >= minScore && keywordOverlap >= minKeywordOverlap;
    }

    private String extractAnswerLead(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String normalized = content.replaceAll("\\s+", " ").trim();
        String lower = normalized.toLowerCase(Locale.ROOT);
        int aIdx = lower.indexOf("câu trả lời:");
        String answer = aIdx >= 0
                ? normalized.substring(Math.min(normalized.length(), aIdx + "câu trả lời:".length())).trim()
                : normalized;
        return answer.length() <= 280 ? answer : answer.substring(0, 280);
    }
}
