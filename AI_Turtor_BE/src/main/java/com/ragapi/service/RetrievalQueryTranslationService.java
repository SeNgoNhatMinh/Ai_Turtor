package com.ragapi.service;

import com.ragapi.util.TextSanitizer;
import com.ragapi.util.VietnameseOutputEnforcer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rewrites a learner query into the language commonly used by course material.
 * This avoids maintaining per-course term dictionaries in Java and improves
 * cross-language vector retrieval, especially for mathematical terminology.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RetrievalQueryTranslationService {

    private static final int MAX_CACHE_ENTRIES = 2_000;

    private final OpenRouterChatService chatService;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    @Value("${rag.retrieval.query-translation.enabled:true}")
    private boolean enabled;

    @Value("${rag.retrieval.query-translation.skip-when-ollama-only:true}")
    private boolean skipWhenOllamaOnly;

    @Value("${rag.retrieval.query-translation.target-language:English}")
    private String targetLanguage;

    public String expandForRetrieval(String question, String courseId) {
        return expandForRetrieval(question, courseId, false);
    }

    public String expandForRetrieval(String question, String courseId, boolean keywordExpanded) {
        if (!enabled || question == null || question.isBlank() || !shouldTranslate(question, keywordExpanded)) {
            return question;
        }
        if (skipWhenOllamaOnly && chatService.isOllamaOnlyActive()) {
            log.info("Skipping retrieval query translation because only Ollama is active");
            return question;
        }

        String cacheKey = normalize(courseId) + "|" + normalize(question);
        String cached = cache.get(cacheKey);
        if (cached != null) {
            return combine(question, cached);
        }

        try {
            String rewritten = sanitizeRewrite(chatService.generateUtility(buildPrompt(question, courseId)));
            if (rewritten == null || rewritten.isBlank() || rewritten.equalsIgnoreCase(question.trim())) {
                return question;
            }
            if (cache.size() >= MAX_CACHE_ENTRIES) {
                cache.clear();
            }
            cache.put(cacheKey, rewritten);
            log.info("Generated cross-language retrieval query for courseId={}", courseId);
            return combine(question, rewritten);
        } catch (Exception error) {
            // Translation improves recall but must never make the tutor unavailable.
            log.warn("Retrieval query translation failed; using original query: {}", error.getMessage());
            return question;
        }
    }

    private boolean shouldTranslate(String question, boolean keywordExpanded) {
        if (!VietnameseOutputEnforcer.containsVietnameseIntent(question)) {
            return false;
        }
        if (VietnameseOutputEnforcer.isEnglishPrimary(question)) {
            return false;
        }
        if (keywordExpanded && hasStrongEnglishRetrievalTerms(question)) {
            return false;
        }
        return true;
    }

    private boolean hasStrongEnglishRetrievalTerms(String question) {
        int asciiWords = 0;
        for (String raw : question.split("\\s+")) {
            String token = raw.replaceAll("[^\\p{L}\\p{N}]+", "");
            if (token.length() >= 3 && token.chars().allMatch(ch -> ch < 128)) {
                asciiWords++;
            }
        }
        return asciiWords >= 8;
    }

    private boolean shouldTranslate(String question) {
        return shouldTranslate(question, false);
    }

    private String buildPrompt(String question, String courseId) {
        return """
                You rewrite search queries for a university course RAG system.
                Translate the learner question into %s for retrieval from course materials.

                RULES:
                - Output exactly one compact search-query line and nothing else.
                - Start with a faithful, literal academic translation of the complete
                  concept in the question. Do not simplify it to a broader topic.
                - After the literal translation, add 2-4 textbook aliases or closely
                  equivalent terms separated by semicolons to improve search recall.
                - Preserve every mathematical symbol, formula, variable and expression exactly.
                - Use canonical academic terminology appropriate to course %s.
                - For mathematics, distinguish the requested object from its surrounding
                  branch of mathematics; never replace a specific concept with only a
                  broader field name. Never invent a definition or answer the question.
                - Keep acronyms, code identifiers and proper names unchanged.
                - Do not include markdown, labels, quotation marks or explanations.

                LEARNER QUESTION:
                %s
                """.formatted(targetLanguage, courseId == null ? "unknown" : courseId, question);
    }

    private String sanitizeRewrite(String value) {
        if (value == null) {
            return null;
        }
        String firstLine = value.strip().lines()
                .filter(line -> !line.isBlank())
                .findFirst()
                .orElse("")
                .replaceFirst("(?i)^(translation|query|english query)\\s*:\\s*", "")
                .replaceAll("^[\\\"'`]+|[\\\"'`]+$", "")
                .trim();
        return firstLine.length() > 600 ? firstLine.substring(0, 600) : firstLine;
    }

    private String combine(String original, String rewritten) {
        return original.trim() + " | " + rewritten.trim();
    }

    private String normalize(String value) {
        return TextSanitizer.normalizeAccentInsensitive(value == null ? "" : value)
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
