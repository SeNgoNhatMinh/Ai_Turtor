package com.ragapi.harness.quiz;

import static com.ragapi.harness.util.QuizContentFilter.isAcademicQuizQuestion;
import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.harness.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.retrieval.CourseMaterialTextSearchService;
import com.ragapi.harness.retrieval.CourseSearchResultRankingService;
import com.ragapi.harness.util.QuizJsonParser;
import com.ragapi.harness.util.QuizMaterialGrounding;
import com.ragapi.harness.util.QuizMaterialGrounding.QuizPassage;
import com.ragapi.harness.entity.QuizSession;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Finds course passages and turns a model reply into quiz questions. */
@Slf4j
@RequiredArgsConstructor
class QuizQuestionAuthor {

    private final CourseKnowledgeSearchGateway vectorService;
    private final CourseMaterialTextSearchService fallbackSearchService;
    private final CourseSearchResultRankingService rerankService;
    private final ObjectMapper objectMapper;

    List<QuizPassage> retrieveQuizPassages(String query, String courseId, String classId) {
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<RetrievedCourseChunk> merged = new ArrayList<>();
        addQuizChunks(merged, seen, searchQuizVectors(query, courseId, classId));
        addQuizChunks(merged, seen, searchQuizKeywords(query, courseId, classId));
        if (merged.isEmpty()) {
            addQuizChunks(merged, seen, fallbackSearchService.search(query, courseId, classId, 8));
        }
        List<RetrievedCourseChunk> onTopic = merged.stream()
                .filter(chunk -> QuizMaterialGrounding.chunkMatchesTopic(query, chunk.chapterTitle(), chunk.content()))
                .toList();
        if (onTopic.isEmpty()) {
            return List.of();
        }
        List<RetrievedCourseChunk> ranked = rerankService.rerank(query, onTopic);
        return QuizMaterialGrounding.toPassages(query, ranked.stream()
                .map(chunk -> new QuizMaterialGrounding.SourceChunk(
                        chunk.content(),
                        chunk.materialId(),
                        chunk.chapterTitle(),
                        chunk.score()))
                .toList());
    }

    List<RetrievedCourseChunk> searchQuizVectors(String query, String courseId, String classId) {
        try {
            List<RetrievedCourseChunk> found = vectorService.searchWithScores(query, courseId, classId);
            return found == null ? List.of() : found;
        } catch (Exception exception) {
            log.warn("Vector retrieval unavailable while generating quiz (courseId={}, classId={}): {}",
                    courseId, classId, exception.getMessage());
            return List.of();
        }
    }

    List<RetrievedCourseChunk> searchQuizKeywords(String query, String courseId, String classId) {
        try {
            List<RetrievedCourseChunk> found = vectorService.searchTextbookKeywordWithScores(query, courseId, classId, 8);
            return found == null ? List.of() : found;
        } catch (Exception exception) {
            log.warn("Keyword retrieval unavailable while generating quiz (courseId={}, classId={}): {}",
                    courseId, classId, exception.getMessage());
            return List.of();
        }
    }

    void addQuizChunks(
            List<RetrievedCourseChunk> merged,
            Set<String> seen,
            List<RetrievedCourseChunk> chunks
    ) {
        if (chunks == null) {
            return;
        }
        for (RetrievedCourseChunk chunk : chunks) {
            if (chunk == null || chunk.content() == null || chunk.content().isBlank()) {
                continue;
            }
            String key = chunk.chunkId() != null && !chunk.chunkId().isBlank()
                    ? chunk.chunkId()
                    : Integer.toHexString(chunk.content().trim().hashCode());
            if (seen.add(key)) {
                merged.add(chunk);
            }
        }
    }


    String buildQuizPrompt(
            String courseId,
            String classId,
            String topic,
            int questionCount,
            String context
    ) {
        return """
                You are an AI Tutor quiz generator for university students.

                STRICT RULES:
                - Use ONLY the PASSAGE blocks below. Do not use outside knowledge.
                - Write at most questionCount questions. If the passages do not support that many distinct facts, return fewer. Never invent a question to fill the count.
                - Every question must be answerable from exactly one PASSAGE.
                - evidenceQuote must be copied verbatim from that PASSAGE body, at least 8 consecutive words. Do not translate it. Do not paraphrase it. Do not quote the Chapter label.
                - sourcePassage must be the passage id, such as P1.
                - Test academic understanding: definitions, relationships, use cases, comparisons, and true/false facts written in the passage.
                - Do NOT ask about document structure or metadata: page numbers, table of contents, "trong tài liệu", "ở trang", source URLs, materialId, or where a name is mentioned.
                - Use clean, natural Vietnamese with diacritics for questionText, options, and explanation.
                - Keep English technical terms as they appear in the passage.
                - Only create MULTIPLE_CHOICE and TRUE_FALSE questions.
                - correctAnswer must be the full text of one option, not a letter.
                - Keep explanations short. Do not write "trong tài liệu có ghi".

                Return valid JSON only. No markdown. No comments.
                - Escape any double quote inside strings as \\".
                - Every field in an object must be separated by a comma.
                - Every object in questions[] must be separated by a comma.

                JSON schema:
                {
                  "questions": [
                    {
                      "type": "MULTIPLE_CHOICE",
                      "questionText": "...",
                      "options": ["...", "...", "...", "..."],
                      "correctAnswer": "...",
                      "explanation": "...",
                      "evidenceQuote": "verbatim words copied from one passage",
                      "sourcePassage": "P1"
                    }
                  ]
                }

                courseId: %s
                classId: %s
                topic: %s
                questionCount: %d

                PASSAGES:
                %s
                """.formatted(
                courseId,
                classId == null ? "" : classId,
                topic,
                questionCount,
                truncateContext(context)
        );
    }

    QuizPayload parseQuizPayload(String raw) throws IOException {
        return QuizJsonParser.readValue(raw, objectMapper, QuizPayload.class);
    }

    List<QuizSession.QuizQuestion> normalizeQuestions(
            QuizPayload payload,
            int limit,
            List<QuizPassage> passages
    ) {
        if (payload == null || payload.getQuestions() == null) {
            return List.of();
        }

        List<QuizSession.QuizQuestion> questions = new ArrayList<>();
        LinkedHashSet<String> seenQuestions = new LinkedHashSet<>();
        for (QuizQuestionPayload item : payload.getQuestions()) {
            if (questions.size() >= limit) {
                break;
            }
            String type = normalizeType(item.getType());
            String questionText = sanitizeQuizText(normalize(item.getQuestionText()));
            List<String> options = cleanOptions(item.getOptions(), type);
            String correctAnswer = sanitizeQuizText(normalize(item.getCorrectAnswer()));
            String explanation = sanitizeQuizText(normalize(item.getExplanation()));
            if (questionText == null || options.size() < 2 || correctAnswer == null) {
                continue;
            }
            if (!seenQuestions.add(normalizeForCompare(questionText))) {
                continue;
            }
            if (!isAcademicQuizQuestion(questionText, explanation)) {
                log.warn("Skipping metadata-style quiz question: {}", questionText);
                continue;
            }
            QuizPassage support = QuizMaterialGrounding.supportingPassage(
                    item.getEvidenceQuote(),
                    item.getSourcePassage(),
                    passages
            );
            if (support == null) {
                log.warn("Skipping quiz question without a verbatim passage quote: {}", questionText);
                continue;
            }
            String matchedAnswer = QuizMaterialGrounding.matchOption(correctAnswer, options);
            if (matchedAnswer == null) {
                log.warn("Skipping quiz question whose answer does not match an option: {}", questionText);
                continue;
            }
            List<String> sourceIds = support.materialId() == null || support.materialId().isBlank()
                    ? List.of()
                    : List.of(support.materialId());

            questions.add(QuizSession.QuizQuestion.builder()
                    .questionId(UUID.randomUUID().toString())
                    .type(type)
                    .questionText(questionText)
                    .options(options)
                    .correctAnswer(matchedAnswer)
                    .explanation(explanation)
                    .sourceMaterialIds(sourceIds)
                    .build());
        }
        return questions;
    }

    String normalizeType(String type) {
        String normalized = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        if ("TRUE_FALSE".equals(normalized) || "TRUEFALSE".equals(normalized)) {
            return "TRUE_FALSE";
        }
        return "MULTIPLE_CHOICE";
    }

    List<String> cleanOptions(List<String> options, String type) {
        if ("TRUE_FALSE".equals(type)) {
            return List.of("Đúng", "Sai");
        }
        LinkedHashSet<String> cleaned = new LinkedHashSet<>();
        if (options != null) {
            for (String option : options) {
                String normalized = sanitizeQuizText(normalize(option));
                if (normalized != null) {
                    cleaned.add(normalized);
                }
            }
        }
        return new ArrayList<>(cleaned);
    }


    String truncateContext(String context) {
        if (context == null) {
            return "";
        }
        if (context.length() <= DEFAULT_TEXT_MAX_LENGTH) {
            return context;
        }
        return context.substring(0, DEFAULT_TEXT_MAX_LENGTH);
    }


    String sanitizeQuizText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String cleaned = value
                .replaceAll("[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}\\p{IsCyrillic}]+", "")
                .replaceAll("[ \\t]{2,}", " ")
                .replaceAll("\\s+([?.!,;:])", "$1")
                .trim();
        return cleaned.isBlank() ? null : cleaned;
    }
    String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class QuizPayload {
        List<QuizQuestionPayload> questions;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class QuizQuestionPayload {
        String type;
        String questionText;
        List<String> options;
        @com.fasterxml.jackson.annotation.JsonAlias({"answer", "correct", "correctOption", "answerKey"})
        String correctAnswer;
        String explanation;
        @com.fasterxml.jackson.annotation.JsonAlias({"evidence", "quote", "citation", "sourceQuote"})
        String evidenceQuote;
        @com.fasterxml.jackson.annotation.JsonAlias({"passage", "passageId", "sourceId"})
        String sourcePassage;
    }


    private String normalizeForCompare(String value) {
        String normalized = normalize(value);
        return normalized == null ? "" : normalized.toLowerCase(Locale.ROOT);
    }
}
