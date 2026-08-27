package com.ragapi.service;

import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Uses a lightweight LLM pass so the tutor understands student typos and missing
 * diacritics before intent detection and RAG retrieval.
 * Example: "xic chao" -> "xin chào".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentQuestionNormalizationService {

    private static final int MAX_CACHE_ENTRIES = 2_000;

    private final OpenRouterChatService chatService;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    @Value("${app.student-question-normalization.enabled:true}")
    private boolean enabled;

    @Value("${app.student-question-normalization.llm-enabled:true}")
    private boolean llmEnabled;

    @Value("${app.student-question-normalization.max-length:500}")
    private int maxLength;

    public String normalize(String question) {
        if (!enabled || question == null || question.isBlank()) {
            return question;
        }

        String cleaned = TextSanitizer.clean(question);
        if (cleaned == null || cleaned.isBlank()) {
            return question;
        }

        String trimmed = cleaned.trim();
        if (trimmed.length() > maxLength) {
            return trimmed;
        }

        if (!llmEnabled) {
            return trimmed;
        }

        if (alreadyHasVietnameseDiacritics(trimmed)) {
            return trimmed;
        }

        String cached = cache.get(trimmed);
        if (cached != null) {
            return cached;
        }

        String corrected = inferCorrectedQuestion(trimmed);
        if (corrected == null || corrected.isBlank() || !isSafeCorrection(trimmed, corrected)) {
            return trimmed;
        }

        if (!corrected.equals(trimmed)) {
            log.info("AI normalized student question: '{}' -> '{}'", trimmed, corrected);
        }

        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.clear();
        }
        cache.put(trimmed, corrected);
        return corrected;
    }

    private boolean alreadyHasVietnameseDiacritics(String question) {
        return question.codePoints().anyMatch(codePoint ->
                Character.isLetter(codePoint) && codePoint > 127);
    }

    private String inferCorrectedQuestion(String question) {
        try {
            String response = chatService.generateUtility(buildPrompt(question));
            return sanitizeModelOutput(response);
        } catch (Exception error) {
            log.warn("AI question normalization failed; using original text: {}", error.getMessage());
            return question;
        }
    }

    private String buildPrompt(String question) {
        return """
                You repair a university student's chat question before academic search.
                Infer the intended wording when the student made typos, missing Vietnamese
                diacritics, or keyboard mistakes (for example "xic chao" -> "xin chào").

                RULES:
                - Output exactly one corrected question line and nothing else.
                - Fix spelling and diacritics only; keep the same language and meaning.
                - Do NOT answer the question.
                - Do NOT add examples, explanations, markdown, labels, or quotation marks.
                - Preserve code identifiers, APIs, class names, formulas, and English terms.
                - If the text is already clear, return it unchanged.

                STUDENT QUESTION:
                %s
                """.formatted(question);
    }

    private String sanitizeModelOutput(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String firstLine = value.strip().lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .findFirst()
                .orElse("")
                .replaceFirst("(?i)^(corrected question|question|output|câu hỏi)\\s*:\\s*", "")
                .replaceAll("^[\"'`]+|[\"'`]+$", "")
                .trim();
        if (firstLine.length() > maxLength) {
            return firstLine.substring(0, maxLength).trim();
        }
        return firstLine;
    }

    private boolean isSafeCorrection(String original, String corrected) {
        if (corrected.equals(original)) {
            return true;
        }
        if (corrected.length() > original.length() * 2 || corrected.length() < original.length() / 2) {
            return false;
        }
        String normalizedOriginal = TextSanitizer.normalizeAccentInsensitive(original);
        String normalizedCorrected = TextSanitizer.normalizeAccentInsensitive(corrected);
        if (normalizedOriginal.equals(normalizedCorrected)) {
            return true;
        }
        int distance = levenshteinDistance(normalizedOriginal, normalizedCorrected);
        int threshold = Math.max(3, Math.max(normalizedOriginal.length(), normalizedCorrected.length()) / 2);
        return distance <= threshold;
    }

    private int levenshteinDistance(String left, String right) {
        int[][] matrix = new int[left.length() + 1][right.length() + 1];
        for (int row = 0; row <= left.length(); row++) {
            matrix[row][0] = row;
        }
        for (int col = 0; col <= right.length(); col++) {
            matrix[0][col] = col;
        }
        for (int row = 1; row <= left.length(); row++) {
            for (int col = 1; col <= right.length(); col++) {
                int cost = left.charAt(row - 1) == right.charAt(col - 1) ? 0 : 1;
                matrix[row][col] = Math.min(
                        Math.min(matrix[row - 1][col] + 1, matrix[row][col - 1] + 1),
                        matrix[row - 1][col - 1] + cost
                );
            }
        }
        return matrix[left.length()][right.length()];
    }
}
