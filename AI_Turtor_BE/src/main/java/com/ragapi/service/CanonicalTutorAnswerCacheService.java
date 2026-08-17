package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.entity.CanonicalTutorAnswer;
import com.ragapi.repository.CanonicalTutorAnswerRepository;
import com.ragapi.util.EmbeddingSimilarityUtil;
import com.ragapi.util.QuestionOverlapUtil;
import com.ragapi.util.StudentFacingMessages;
import com.ragapi.util.TextSanitizer;
import dev.langchain4j.data.embedding.Embedding;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class CanonicalTutorAnswerCacheService {

    private static final double MIN_STORE_CONFIDENCE = 0.6;
    private static final String COURSE_MATERIAL = "COURSE_MATERIAL";
    private static final int MAX_MEMORY_ENTRIES = 2_000;

    private final CanonicalTutorAnswerRepository repository;
    private final EmbeddingService embeddingService;
    private final PdfPageRenderService pdfPageRenderService;
    private final Map<String, MemoryRagAnswer> exactRagMemoryCache = new ConcurrentHashMap<>();

    @Value("${app.tutor-answer-cache.enabled:true}")
    private boolean enabled;

    @Value("${app.tutor-answer-cache.ttl-hours:168}")
    private int ttlHours;

    @Value("${app.tutor-answer-cache.semantic-enabled:true}")
    private boolean semanticEnabled;

    @Value("${app.tutor-answer-cache.semantic-min-similarity:0.90}")
    private double semanticMinSimilarity;

    @Value("${app.tutor-answer-cache.semantic-min-keyword-overlap:0.45}")
    private double semanticMinKeywordOverlap;

    @Value("${app.tutor-answer-cache.semantic-min-source-overlap:0.20}")
    private double semanticMinSourceOverlap;

    @Value("${app.tutor-answer-cache.semantic-max-candidates:100}")
    private int semanticMaxCandidates;

    @PostConstruct
    void preloadExactRagAnswers() {
        if (!enabled) {
            return;
        }
        try {
            LocalDateTime now = LocalDateTime.now();
            List<CanonicalTutorAnswer> entries =
                    repository.findTop2000ByModeAndExpiresAtAfterOrderByCreatedAtDesc("RAG", now);
            entries.stream()
                    .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                    .filter(entry -> !StudentFacingMessages.isUnavailableMessage(entry.getAnswer()))
                    .filter(entry -> !TextSanitizer.isSystemFailureOrEscalationAnswer(entry.getAnswer()))
                    .filter(entry -> entry.getSourceEvidence() != null && !entry.getSourceEvidence().isEmpty())
                    .forEach(entry -> rememberExactRagAnswer(
                            entry.getId(),
                            toRagAnswer(entry),
                            entry.getExpiresAt()
                    ));
            log.info("Preloaded {} exact tutor answers into memory cache", exactRagMemoryCache.size());
        } catch (Exception error) {
            log.warn("Cannot preload exact tutor answer cache: {}", error.getMessage());
        }
    }

    public Optional<CourseRagAnswer> lookupRagAnswer(
            String courseId,
            String classId,
            String question,
            double currentConfidence,
            List<String> currentSources
    ) {
        Optional<CourseRagAnswer> exact = lookupExactRagAnswer(courseId, classId, question);
        if (exact.isPresent()) {
            return exact;
        }
        return lookupSemanticRagAnswer(courseId, classId, question, currentConfidence, currentSources);
    }

    public Optional<CourseRagAnswer> lookupExactRagAnswer(String courseId, String classId, String question) {
        String key = buildKey(courseId, classId, "RAG", question, null);
        MemoryRagAnswer memoryEntry = exactRagMemoryCache.get(key);
        if (memoryEntry != null) {
            if (memoryEntry.expiresAt().isAfter(LocalDateTime.now())
                    && hasSourceEvidence(memoryEntry.answer())) {
                log.info("In-memory exact tutor answer cache hit for courseId={}", courseId);
                return Optional.of(memoryEntry.answer());
            }
            exactRagMemoryCache.remove(key, memoryEntry);
        }

        Optional<CanonicalTutorAnswer> exact = lookup(key);
        if (exact.isEmpty()) {
            return Optional.empty();
        }
        log.info("Exact tutor answer cache hit for courseId={}", courseId);
        CourseRagAnswer answer = toRagAnswer(exact.get());
        if (!hasSourceEvidence(answer)) {
            log.info("Exact tutor answer cache requires evidence refresh for courseId={}", courseId);
            return Optional.empty();
        }
        rememberExactRagAnswer(key, answer, exact.get().getExpiresAt());
        return Optional.of(answer);
    }

    public Optional<String> lookupCodeAnswer(String courseId, String classId, String question, String code) {
        Optional<CanonicalTutorAnswer> exact = lookup(buildKey(courseId, classId, "CODE", question, code));
        if (exact.isPresent()) {
            return exact.map(CanonicalTutorAnswer::getAnswer);
        }
        if (!semanticEnabled || hasText(code)) {
            return Optional.empty();
        }
        return lookupSemanticCodeAnswer(courseId, classId, question);
    }

    public void storeRagAnswer(String courseId, String classId, String question, CourseRagAnswer answer) {
        if (!shouldStoreRagAnswer(answer)) {
            return;
        }
        String key = buildKey(courseId, classId, "RAG", question, null);
        rememberExactRagAnswer(key, answer, LocalDateTime.now().plusHours(Math.max(1, ttlHours)));
        save(
                key,
                courseId,
                classId,
                "RAG",
                question,
                answer.getAnswer(),
                answer.getConfidence(),
                answer.getSources(),
                answer.getSourceEvidence(),
                answer.getGroundingType(),
                embedQuestion(question)
        );
    }

    public void storeRagAnswerAsync(String courseId, String classId, String question, CourseRagAnswer answer) {
        if (!shouldStoreRagAnswer(answer)) {
            return;
        }
        String key = buildKey(courseId, classId, "RAG", question, null);
        rememberExactRagAnswer(key, answer, LocalDateTime.now().plusHours(Math.max(1, ttlHours)));
        CompletableFuture.runAsync(() -> {
            try {
                storeRagAnswer(courseId, classId, question, answer);
            } catch (Exception error) {
                log.warn("Cannot persist tutor answer cache asynchronously for courseId={}: {}",
                        courseId, error.getMessage());
            }
        });
    }

    public void storeCodeAnswer(String courseId, String classId, String question, String code, String answer) {
        if (!shouldStore(answer)) {
            return;
        }
        save(
                buildKey(courseId, classId, "CODE", question, code),
                courseId,
                classId,
                "CODE",
                question,
                answer,
                1.0,
                List.of("CODE"),
                List.of(),
                "AI_GENERAL_KNOWLEDGE",
                hasText(code) ? null : embedQuestion(question)
        );
    }

    public Optional<CourseRagAnswer> lookupSemanticRagAnswer(
            String courseId,
            String classId,
            String question,
            double currentConfidence,
            List<String> currentSources
    ) {
        if (!semanticEnabled || currentConfidence < MIN_STORE_CONFIDENCE) {
            return Optional.empty();
        }
        List<Float> queryEmbedding = embedQuestion(question);
        if (queryEmbedding.isEmpty()) {
            return Optional.empty();
        }
        List<CanonicalTutorAnswer> candidates = loadSemanticCandidates(courseId, classId, "RAG");
        Optional<CanonicalTutorAnswer> best = candidates.stream()
                .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                .filter(entry -> isAcademicRagCacheCandidate(entry, question, queryEmbedding, currentConfidence, currentSources))
                .max(Comparator.comparingDouble(entry -> EmbeddingSimilarityUtil.cosineSimilarity(
                        queryEmbedding,
                        entry.getQuestionEmbedding()
                )));
        if (best.isEmpty()) {
            return Optional.empty();
        }
        log.info("Semantic tutor answer cache hit for courseId={} matchedQuestion={}",
                courseId,
                best.get().getQuestion());
        return best.map(this::toRagAnswer);
    }

    private void rememberExactRagAnswer(String key, CourseRagAnswer answer, LocalDateTime expiresAt) {
        if (key == null || answer == null) {
            return;
        }
        if (exactRagMemoryCache.size() >= MAX_MEMORY_ENTRIES) {
            exactRagMemoryCache.clear();
        }
        LocalDateTime safeExpiry = expiresAt == null
                ? LocalDateTime.now().plusHours(Math.max(1, ttlHours))
                : expiresAt;
        exactRagMemoryCache.put(key, new MemoryRagAnswer(answer, safeExpiry));
        preloadEvidencePages(answer);
    }

    private void preloadEvidencePages(CourseRagAnswer answer) {
        if (!hasSourceEvidence(answer)) {
            return;
        }
        java.util.Set<String> scheduled = new java.util.HashSet<>();
        for (RagSourceEvidence evidence : answer.getSourceEvidence()) {
            if (evidence == null || evidence.getMaterialId() == null) {
                continue;
            }
            if (evidence.getVisualEvidence() != null && !evidence.getVisualEvidence().isEmpty()) {
                evidence.getVisualEvidence().forEach(visual -> {
                    if (visual == null || visual.getPageNumber() == null) {
                        return;
                    }
                    String key = evidence.getMaterialId() + ":" + visual.getPageNumber();
                    if (scheduled.add(key)) {
                        pdfPageRenderService.preloadPageAsync(evidence.getMaterialId(), visual.getPageNumber());
                    }
                });
            } else if (evidence.getPageStart() != null) {
                String key = evidence.getMaterialId() + ":" + evidence.getPageStart();
                if (scheduled.add(key)) {
                    pdfPageRenderService.preloadPageAsync(evidence.getMaterialId(), evidence.getPageStart());
                }
            }
        }
    }

    private Optional<String> lookupSemanticCodeAnswer(String courseId, String classId, String question) {
        List<Float> queryEmbedding = embedQuestion(question);
        if (queryEmbedding.isEmpty()) {
            return Optional.empty();
        }
        List<CanonicalTutorAnswer> candidates = loadSemanticCandidates(courseId, classId, "CODE");
        return candidates.stream()
                .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                .filter(entry -> entry.getQuestionEmbedding() != null && !entry.getQuestionEmbedding().isEmpty())
                .filter(entry -> EmbeddingSimilarityUtil.cosineSimilarity(queryEmbedding, entry.getQuestionEmbedding())
                        >= semanticMinSimilarity)
                .filter(entry -> QuestionOverlapUtil.keywordOverlapRatio(question, entry.getQuestion())
                        >= semanticMinKeywordOverlap)
                .max(Comparator.comparingDouble(entry -> EmbeddingSimilarityUtil.cosineSimilarity(
                        queryEmbedding,
                        entry.getQuestionEmbedding()
                )))
                .map(CanonicalTutorAnswer::getAnswer);
    }

    private List<CanonicalTutorAnswer> loadSemanticCandidates(String courseId, String classId, String mode) {
        List<CanonicalTutorAnswer> candidates = repository.findByCourseIdAndClassIdAndModeAndExpiresAtAfterOrderByCreatedAtDesc(
                normalizeScope(courseId),
                normalizeScope(classId),
                mode,
                LocalDateTime.now()
        );
        if (candidates.size() <= semanticMaxCandidates) {
            return candidates;
        }
        return candidates.subList(0, semanticMaxCandidates);
    }

    private boolean isAcademicRagCacheCandidate(
            CanonicalTutorAnswer entry,
            String question,
            List<Float> queryEmbedding,
            double currentConfidence,
            List<String> currentSources
    ) {
        if (entry.getQuestionEmbedding() == null || entry.getQuestionEmbedding().isEmpty()) {
            return false;
        }
        if (!COURSE_MATERIAL.equals(entry.getGroundingType())) {
            return false;
        }
        if (entry.getConfidence() == null || entry.getConfidence() < MIN_STORE_CONFIDENCE) {
            return false;
        }
        if (currentConfidence < MIN_STORE_CONFIDENCE) {
            return false;
        }
        double similarity = EmbeddingSimilarityUtil.cosineSimilarity(queryEmbedding, entry.getQuestionEmbedding());
        if (similarity < semanticMinSimilarity) {
            return false;
        }
        double keywordOverlap = QuestionOverlapUtil.keywordOverlapRatio(question, entry.getQuestion());
        if (keywordOverlap < semanticMinKeywordOverlap) {
            return false;
        }
        double sourceOverlap = QuestionOverlapUtil.sourceOverlapRatio(currentSources, entry.getSources());
        if (sourceOverlap < semanticMinSourceOverlap) {
            return false;
        }
        return true;
    }

    private boolean shouldStoreRagAnswer(CourseRagAnswer answer) {
        if (answer == null || !shouldStore(answer.getAnswer())) {
            return false;
        }
        if (!COURSE_MATERIAL.equals(answer.getGroundingType())) {
            return false;
        }
        return answer.getConfidence() != null && answer.getConfidence() >= MIN_STORE_CONFIDENCE;
    }

    private Optional<CanonicalTutorAnswer> lookup(String key) {
        if (!enabled || key == null || key.isBlank()) {
            return Optional.empty();
        }
        return repository.findById(key)
                .filter(entry -> entry.getExpiresAt() == null || entry.getExpiresAt().isAfter(LocalDateTime.now()))
                .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                .filter(entry -> !StudentFacingMessages.isUnavailableMessage(entry.getAnswer()))
                .filter(entry -> !TextSanitizer.isSystemFailureOrEscalationAnswer(entry.getAnswer()));
    }

    private CourseRagAnswer toRagAnswer(CanonicalTutorAnswer entry) {
        return CourseRagAnswer.builder()
                .answer(entry.getAnswer())
                .confidence(entry.getConfidence() == null ? 1.0 : entry.getConfidence())
                .sources(entry.getSources() == null ? List.of() : entry.getSources())
                .sourceEvidence(entry.getSourceEvidence() == null ? List.of() : entry.getSourceEvidence())
                .groundingType(entry.getGroundingType() == null ? COURSE_MATERIAL : entry.getGroundingType())
                .escalationRecommended(false)
                .escalationReason(null)
                .build();
    }

    private record MemoryRagAnswer(CourseRagAnswer answer, LocalDateTime expiresAt) {
    }

    private void save(
            String key,
            String courseId,
            String classId,
            String mode,
            String question,
            String answer,
            Double confidence,
            List<String> sources,
            List<RagSourceEvidence> sourceEvidence,
            String groundingType,
            List<Float> questionEmbedding
    ) {
        if (!enabled) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        CanonicalTutorAnswer entry = CanonicalTutorAnswer.builder()
                .id(key)
                .courseId(trim(courseId))
                .classId(normalizeScope(classId))
                .mode(mode)
                .question(trim(question))
                .answer(TextSanitizer.cleanForStudentAnswer(answer))
                .confidence(confidence)
                .sources(sources == null ? List.of() : sources)
                .sourceEvidence(sourceEvidence == null ? List.of() : sourceEvidence)
                .groundingType(groundingType)
                .questionEmbedding(questionEmbedding == null || questionEmbedding.isEmpty() ? null : questionEmbedding)
                .reviewStatus(TutorAnswerCacheSeniorService.STATUS_ACTIVE)
                .createdAt(now)
                .expiresAt(now.plusHours(Math.max(1, ttlHours)))
                .build();
        repository.save(entry);
        log.debug("Stored tutor answer cache key={} mode={} courseId={} semantic={}",
                key,
                mode,
                courseId,
                questionEmbedding != null && !questionEmbedding.isEmpty());
    }

    private boolean hasSourceEvidence(CourseRagAnswer answer) {
        return answer != null
                && answer.getSourceEvidence() != null
                && !answer.getSourceEvidence().isEmpty();
    }

    private List<Float> embedQuestion(String question) {
        if (!semanticEnabled || question == null || question.isBlank()) {
            return List.of();
        }
        try {
            Embedding embedding = embeddingService.generateQueryEmbedding(question);
            return EmbeddingSimilarityUtil.toFloatList(embedding.vector());
        } catch (Exception error) {
            log.warn("Failed to embed question for semantic tutor cache: {}", error.getMessage());
            return List.of();
        }
    }

    private boolean shouldStore(String answer) {
        if (!enabled || answer == null || answer.isBlank()) {
            return false;
        }
        return !StudentFacingMessages.isUnavailableMessage(answer)
                && !TextSanitizer.isSystemFailureOrEscalationAnswer(answer);
    }

    static String buildKey(String courseId, String classId, String mode, String question, String codeSnippet) {
        String payload = normalizePart(courseId)
                + "|" + normalizePart(classId)
                + "|" + normalizePart(mode)
                + "|" + normalizePart(question)
                + "|" + normalizePart(codeSnippet);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception error) {
            throw new IllegalStateException("Cannot build tutor answer cache key", error);
        }
    }

    private static String normalizePart(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return TextSanitizer.normalizeAccentInsensitive(value.trim()).toLowerCase(Locale.ROOT);
    }

    private static String normalizeScope(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
