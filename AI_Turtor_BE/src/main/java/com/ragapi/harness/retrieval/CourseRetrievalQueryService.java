package com.ragapi.harness.retrieval;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.repository.CourseRepository;
import com.ragapi.service.llm.OpenRouterChatService;
import com.ragapi.service.cache.SharedRedisCacheService;
import com.ragapi.util.TextSanitizer;
import com.ragapi.harness.util.VietnameseOutputEnforcer;
import com.ragapi.harness.model.CourseRetrievalQuery;
import com.ragapi.harness.util.LearningPathParser;
import com.ragapi.harness.util.RagStageTimer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;


/** Resolves and expands a user question into a retrieval query. */
@Slf4j
@Service
public class CourseRetrievalQueryService {

    private static final String TRANSLATION_CACHE = "retrieval-query-translation";

    private final LocalRetrievalQueryProcessor localQueryProcessor;
    private final OpenRouterChatService chatService;
    private final SharedRedisCacheService sharedRedisCache;
    private final CourseRepository courseRepository;

    @Value("${rag.retrieval.query-translation.enabled:true}")
    private boolean translationEnabled;

    @Value("${rag.retrieval.query-translation.skip-when-ollama-only:true}")
    private boolean skipTranslationWhenOllamaOnly;

    @Value("${rag.retrieval.query-translation.target-language:English}")
    private String translationTargetLanguage;

    @Value("${app.redis-cache.query-translation-ttl-hours:24}")
    private long translationCacheTtlHours;

    @Autowired
    public CourseRetrievalQueryService(
            LocalRetrievalQueryProcessor localQueryProcessor,
            OpenRouterChatService chatService,
            SharedRedisCacheService sharedRedisCache,
            CourseRepository courseRepository
    ) {
        this.localQueryProcessor = localQueryProcessor;
        this.chatService = chatService;
        this.sharedRedisCache = sharedRedisCache;
        this.courseRepository = courseRepository;
    }

    public CourseRetrievalQueryService(LocalRetrievalQueryProcessor localQueryProcessor) {
        this(localQueryProcessor, null, null, null);
    }

    public CourseRetrievalQuery resolve(
            String question,
            String courseId,
            String retrievalHint,
            RagQueryIntent ragQueryIntent
    ) {
        long started = RagStageTimer.start();
        try {
            String focus = ragQueryIntent != null
                    && ragQueryIntent.getRetrievalQuery() != null
                    && !ragQueryIntent.getRetrievalQuery().isBlank()
                    ? ragQueryIntent.getRetrievalQuery().trim()
                    : LearningPathParser.retrievalFocus(question, retrievalHint);
            LocalRetrievalQueryProcessor.ProcessedQuery processed = localQueryProcessor.process(focus);
            String searchText = processed.semanticQuery();
            if (searchText != null && !searchText.isBlank()) {
                String translated = expandForRetrieval(
                        searchText,
                        courseLabel(courseId),
                        !processed.technicalTerms().isEmpty()
                );
                if (translated != null && !translated.isBlank()) {
                    searchText = translated.trim();
                }
            }
            log.info("Resolved retrieval query language={} technicalTerms={} searchChars={}",
                    processed.language(), processed.technicalTerms(), searchText == null ? 0 : searchText.length());
            return new CourseRetrievalQuery(
                    focus,
                    searchText,
                    processed.language(),
                    processed.technicalTerms(),
                    searchText
            );
        } finally {
            RagStageTimer.record("T4_QUERY_PROCESSING", started);
        }
    }

    private String courseLabel(String courseId) {
        if (courseRepository == null || courseId == null || courseId.isBlank()) {
            return courseId;
        }
        return courseRepository.findByCourseId(courseId)
                .map(course -> {
                    String name = course.getCourseName();
                    if (name == null || name.isBlank()) {
                        return courseId;
                    }
                    return courseId.trim() + " (" + name.trim() + ")";
                })
                .orElse(courseId);
    }

    public String expandForRetrieval(String question, String courseId) {
        return expandForRetrieval(question, courseId, false);
    }

    public String expandForRetrieval(String question, String courseId, boolean keywordExpanded) {
        if (!translationEnabled || chatService == null || sharedRedisCache == null || question == null || question.isBlank() || !shouldTranslate(question, keywordExpanded)) {
            return question;
        }
        if (skipTranslationWhenOllamaOnly && chatService.isOllamaOnlyActive()) {
            log.info("Skipping retrieval query translation because only Ollama is active");
            return question;
        }

        String cacheKey = normalize(courseId) + "|" + normalize(question);
        String cached = sharedRedisCache.getString(TRANSLATION_CACHE, cacheKey).orElse(null);
        if (cached != null && !cached.isBlank()) {
            return combine(question, cached);
        }

        try {
            String rewritten = sanitizeRewrite(chatService.generateUtility(buildPrompt(question, courseId)));
            if (rewritten == null || rewritten.isBlank() || rewritten.equalsIgnoreCase(question.trim())) {
                return question;
            }
            sharedRedisCache.putString(
                    TRANSLATION_CACHE,
                    cacheKey,
                    rewritten,
                    Duration.ofHours(Math.max(1L, translationCacheTtlHours))
            );
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
                - After the literal translation, add 2-4 textbook aliases for the same
                  idea, separated by semicolons. Include the standard textbook name
                  when the learner used a paraphrase.
                - Keep every alias in the same subject as the course. Do not switch
                  the concept to a feature of a different programming language.
                - Preserve every mathematical symbol, formula, variable and expression exactly.
                - Use canonical academic terminology for this course only: %s.
                - Do not rename the concept into a feature of a different language
                  or subject than that course.
                - For mathematics, distinguish the requested object from its surrounding
                  branch of mathematics; never replace a specific concept with only a
                  broader field name. Never invent a definition or answer the question.
                - Keep acronyms, code identifiers and proper names unchanged.
                - Never replace a named technology with a neighboring one.
                  JDBC stays JDBC, not JPA or Hibernate. JSP stays JSP, not Servlet.
                - Do not include markdown, labels, quotation marks or explanations.

                LEARNER QUESTION:
                %s
                """.formatted(translationTargetLanguage, courseId == null ? "unknown" : courseId, question);
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
