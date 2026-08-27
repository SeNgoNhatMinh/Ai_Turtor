package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.TutorCacheHitMetadata;
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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
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
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
@RequiredArgsConstructor
public class CanonicalTutorAnswerCacheService {

    private static final double MIN_STORE_CONFIDENCE = 0.6;
    private static final String COURSE_MATERIAL = "COURSE_MATERIAL";
    private static final int MAX_MEMORY_ENTRIES = 2_000;

    private final CanonicalTutorAnswerRepository repository;
    private final EmbeddingService embeddingService;
    private final MongoTemplate mongoTemplate;
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

    @Value("${app.tutor-answer-cache.semantic-early-min-similarity:0.92}")
    private double semanticEarlyMinSimilarity;

    @Value("${app.tutor-answer-cache.semantic-early-min-keyword-overlap:0.50}")
    private double semanticEarlyMinKeywordOverlap;

    @Value("${app.tutor-answer-cache.semantic-early-min-evidence-count:1}")
    private int semanticEarlyMinEvidenceCount;

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
                    .filter(entry -> !StudentFacingMessages.isInsufficientMaterialAnswer(entry.getAnswer()))
                    .filter(entry -> !TextSanitizer.isSystemFailureOrEscalationAnswer(entry.getAnswer()))
                    .filter(entry -> entry.getSourceEvidence() != null && !entry.getSourceEvidence().isEmpty())
                    .forEach(entry -> rememberExactRagAnswer(
                            entry.getId(),
                            entry.getCourseId(),
                            toRagAnswer(entry),
                            entry.getExpiresAt(),
                            entry.getReuseCount(),
                            entry.getLastReusedAt()
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
        long lookupStartedNanos = System.nanoTime();
        String key = buildKey(courseId, classId, "RAG", question, null);
        MemoryRagAnswer memoryEntry = exactRagMemoryCache.get(key);
        if (memoryEntry != null) {
            if (memoryEntry.expiresAt().isAfter(LocalDateTime.now())
                    && hasSourceEvidence(memoryEntry.answer())
                    && !StudentFacingMessages.isInsufficientMaterialAnswer(memoryEntry.answer().getAnswer())) {
                log.info("In-memory exact tutor answer cache hit for courseId={}", courseId);
                incrementReuse(key, memoryEntry);
                return Optional.of(withHitMetadata(
                        memoryEntry.answer(), "EXACT", key, 1.0, lookupStartedNanos, courseId, classId));
            }
            exactRagMemoryCache.remove(key, memoryEntry);
        }

        Optional<CanonicalTutorAnswer> exact = lookup(key);
        if (exact.isEmpty()) {
            return Optional.empty();
        }
        log.info("Exact tutor answer cache hit for courseId={}", courseId);
        CanonicalTutorAnswer entry = exact.get();
        CourseRagAnswer answer = toRagAnswer(entry);
        if (!hasSourceEvidence(answer)) {
            log.info("Exact tutor answer cache requires evidence refresh for courseId={}", courseId);
            return Optional.empty();
        }
        incrementReuse(entry);
        rememberExactRagAnswer(
                key,
                entry.getCourseId(),
                answer,
                entry.getExpiresAt(),
                entry.getReuseCount(),
                entry.getLastReusedAt()
        );
        return Optional.of(withHitMetadata(
                answer, "EXACT", key, 1.0, lookupStartedNanos, courseId, classId));
    }

    public Optional<String> lookupCodeAnswer(String courseId, String classId, String question, String code) {
        Optional<CanonicalTutorAnswer> exact = lookup(buildKey(courseId, classId, "CODE", question, code));
        if (exact.isPresent()) {
            incrementReuse(exact.get());
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
        rememberExactRagAnswer(
                key,
                courseId,
                answer,
                LocalDateTime.now().plusHours(Math.max(1, ttlHours)),
                0L,
                null
        );
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
        rememberExactRagAnswer(
                key,
                courseId,
                answer,
                LocalDateTime.now().plusHours(Math.max(1, ttlHours)),
                0L,
                null
        );
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
        long lookupStartedNanos = System.nanoTime();
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
        CanonicalTutorAnswer entry = best.get();
        double similarity = EmbeddingSimilarityUtil.cosineSimilarity(queryEmbedding, entry.getQuestionEmbedding());
        incrementReuse(entry);
        log.info("Semantic tutor answer cache hit for courseId={} matchedQuestion={}",
                courseId,
                entry.getQuestion());
        return Optional.of(withHitMetadata(
                toRagAnswer(entry),
                "SEMANTIC_VERIFIED",
                entry.getId(),
                similarity,
                lookupStartedNanos,
                courseId,
                classId
        ));
    }

    public Optional<CourseRagAnswer> lookupEarlySemanticRagAnswer(
            String courseId,
            String classId,
            String question
    ) {
        long lookupStartedNanos = System.nanoTime();
        if (!semanticEnabled) {
            return Optional.empty();
        }
        List<Float> queryEmbedding = embedQuestion(question);
        if (queryEmbedding.isEmpty()) {
            return Optional.empty();
        }
        Optional<CanonicalTutorAnswer> best = loadSemanticCandidates(courseId, classId, "RAG").stream()
                .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                .filter(entry -> !StudentFacingMessages.isInsufficientMaterialAnswer(entry.getAnswer()))
                .filter(entry -> isEarlyAcademicRagCacheCandidate(entry, courseId, classId, question, queryEmbedding))
                .max(Comparator.comparingDouble(entry -> EmbeddingSimilarityUtil.cosineSimilarity(
                        queryEmbedding, entry.getQuestionEmbedding())));
        if (best.isEmpty()) {
            return Optional.empty();
        }
        CanonicalTutorAnswer entry = best.get();
        double similarity = EmbeddingSimilarityUtil.cosineSimilarity(queryEmbedding, entry.getQuestionEmbedding());
        incrementReuse(entry);
        log.info("Early semantic tutor answer cache hit courseId={} cacheId={} similarity={}",
                courseId, entry.getId(), similarity);
        return Optional.of(withHitMetadata(
                toRagAnswer(entry),
                "SEMANTIC_EARLY",
                entry.getId(),
                similarity,
                lookupStartedNanos,
                courseId,
                classId
        ));
    }

    private void rememberExactRagAnswer(
            String key,
            String courseId,
            CourseRagAnswer answer,
            LocalDateTime expiresAt,
            long reuseCount,
            LocalDateTime lastReusedAt
    ) {
        if (key == null || answer == null) {
            return;
        }
        if (exactRagMemoryCache.size() >= MAX_MEMORY_ENTRIES) {
            exactRagMemoryCache.clear();
        }
        LocalDateTime safeExpiry = expiresAt == null
                ? LocalDateTime.now().plusHours(Math.max(1, ttlHours))
                : expiresAt;
        exactRagMemoryCache.put(
                key,
                new MemoryRagAnswer(normalizeScope(courseId), answer, safeExpiry, reuseCount, lastReusedAt)
        );
    }

    public void evictExactRagAnswer(String cacheId) {
        if (cacheId == null || cacheId.isBlank()) {
            return;
        }
        exactRagMemoryCache.remove(cacheId.trim());
    }

    public long evictRagAnswersForCourse(String courseId) {
        String normalizedCourseId = normalizeScope(courseId);
        if (normalizedCourseId.isBlank()) {
            return 0L;
        }

        exactRagMemoryCache.entrySet().removeIf(entry ->
                normalizedCourseId.equalsIgnoreCase(entry.getValue().courseId()));

        try {
            long deleted = mongoTemplate.remove(
                    Query.query(Criteria.where("courseId").is(normalizedCourseId).and("mode").is("RAG")),
                    CanonicalTutorAnswer.class
            ).getDeletedCount();
            log.info("Evicted {} persisted tutor RAG cache entries for courseId={}", deleted, normalizedCourseId);
            return deleted;
        } catch (Exception error) {
            log.warn("Cannot evict persisted tutor RAG cache for courseId={}: {}",
                    normalizedCourseId, error.getMessage());
            return 0L;
        }
    }

    private Optional<String> lookupSemanticCodeAnswer(String courseId, String classId, String question) {
        List<Float> queryEmbedding = embedQuestion(question);
        if (queryEmbedding.isEmpty()) {
            return Optional.empty();
        }
        List<CanonicalTutorAnswer> candidates = loadSemanticCandidates(courseId, classId, "CODE");
        Optional<CanonicalTutorAnswer> best = candidates.stream()
                .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                .filter(entry -> entry.getQuestionEmbedding() != null && !entry.getQuestionEmbedding().isEmpty())
                .filter(entry -> EmbeddingSimilarityUtil.cosineSimilarity(queryEmbedding, entry.getQuestionEmbedding())
                        >= semanticMinSimilarity)
                .filter(entry -> QuestionOverlapUtil.keywordOverlapRatio(question, entry.getQuestion())
                        >= semanticMinKeywordOverlap)
                .max(Comparator.comparingDouble(entry -> EmbeddingSimilarityUtil.cosineSimilarity(
                        queryEmbedding,
                        entry.getQuestionEmbedding()
                )));
        best.ifPresent(this::incrementReuse);
        return best.map(CanonicalTutorAnswer::getAnswer);
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
        if (!isReusableGroundingType(entry.getGroundingType())) {
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

    private boolean isEarlyAcademicRagCacheCandidate(
            CanonicalTutorAnswer entry,
            String courseId,
            String classId,
            String question,
            List<Float> queryEmbedding
    ) {
        if (entry.getQuestionEmbedding() == null || entry.getQuestionEmbedding().isEmpty()
                || !isReusableGroundingType(entry.getGroundingType())
                || entry.getConfidence() == null
                || entry.getConfidence() < MIN_STORE_CONFIDENCE) {
            return false;
        }
        if (!normalizeScope(courseId).equals(normalizeScope(entry.getCourseId()))
                || !normalizeScope(classId).equals(normalizeScope(entry.getClassId()))) {
            return false;
        }
        if (entry.getSources() == null || entry.getSources().isEmpty()
                || entry.getSourceEvidence() == null
                || entry.getSourceEvidence().size() < Math.max(1, semanticEarlyMinEvidenceCount)) {
            return false;
        }
        boolean evidenceMatchesScope = entry.getSourceEvidence().stream()
                .filter(java.util.Objects::nonNull)
                .allMatch(evidence -> (evidence.getCourseId() == null
                        || normalizeScope(courseId).equals(normalizeScope(evidence.getCourseId())))
                        && evidence.getMaterialId() != null
                        && !evidence.getMaterialId().isBlank()
                        && entry.getSources().stream()
                        .filter(java.util.Objects::nonNull)
                        .anyMatch(source -> source.contains(evidence.getMaterialId())));
        if (!evidenceMatchesScope) {
            return false;
        }
        double similarity = EmbeddingSimilarityUtil.cosineSimilarity(queryEmbedding, entry.getQuestionEmbedding());
        return similarity >= semanticEarlyMinSimilarity
                && QuestionOverlapUtil.keywordOverlapRatio(question, entry.getQuestion())
                >= semanticEarlyMinKeywordOverlap;
    }

    private boolean shouldStoreRagAnswer(CourseRagAnswer answer) {
        if (answer == null || !shouldStore(answer.getAnswer())) {
            return false;
        }
        if (Boolean.TRUE.equals(answer.getEscalationRecommended())) {
            return false;
        }
        if (!isReusableGroundingType(answer.getGroundingType())) {
            return false;
        }
        return answer.getConfidence() != null && answer.getConfidence() >= MIN_STORE_CONFIDENCE;
    }

    private boolean isReusableGroundingType(String groundingType) {
        return COURSE_MATERIAL.equals(groundingType)
                || "SENIOR_APPROVED_KNOWLEDGE".equals(groundingType)
                || "COURSE_MATERIAL_WITH_APPROVED_KNOWLEDGE".equals(groundingType);
    }

    private Optional<CanonicalTutorAnswer> lookup(String key) {
        if (!enabled || key == null || key.isBlank()) {
            return Optional.empty();
        }
        return repository.findById(key)
                .filter(entry -> entry.getExpiresAt() == null || entry.getExpiresAt().isAfter(LocalDateTime.now()))
                .filter(TutorAnswerCacheSeniorService::isUsableForStudents)
                .filter(entry -> !StudentFacingMessages.isUnavailableMessage(entry.getAnswer()))
                .filter(entry -> !StudentFacingMessages.isInsufficientMaterialAnswer(entry.getAnswer()))
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

    private static final class MemoryRagAnswer {
        private final String courseId;
        private final CourseRagAnswer answer;
        private final LocalDateTime expiresAt;
        private final AtomicLong reuseCount;
        private final AtomicReference<LocalDateTime> lastReusedAt;

        private MemoryRagAnswer(
                String courseId,
                CourseRagAnswer answer,
                LocalDateTime expiresAt,
                long reuseCount,
                LocalDateTime lastReusedAt
        ) {
            this.courseId = courseId;
            this.answer = answer;
            this.expiresAt = expiresAt;
            this.reuseCount = new AtomicLong(reuseCount);
            this.lastReusedAt = new AtomicReference<>(lastReusedAt);
        }

        CourseRagAnswer answer() {
            return answer;
        }

        String courseId() {
            return courseId;
        }

        LocalDateTime expiresAt() {
            return expiresAt;
        }
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
        Update update = new Update()
                .set("courseId", trim(courseId))
                .set("classId", normalizeScope(classId))
                .set("mode", mode)
                .set("question", trim(question))
                .set("answer", TextSanitizer.cleanForStudentAnswer(answer))
                .set("confidence", confidence)
                .set("sources", sources == null ? List.of() : sources)
                .set("sourceEvidence", sourceEvidence == null ? List.of() : sourceEvidence)
                .set("groundingType", groundingType)
                .set("questionEmbedding",
                        questionEmbedding == null || questionEmbedding.isEmpty() ? null : questionEmbedding)
                .set("expiresAt", now.plusHours(Math.max(1, ttlHours)))
                .setOnInsert("reviewStatus", TutorAnswerCacheSeniorService.STATUS_ACTIVE)
                .setOnInsert("reuseCount", 0L)
                .setOnInsert("createdAt", now);
        mongoTemplate.upsert(Query.query(Criteria.where("_id").is(key)), update, CanonicalTutorAnswer.class);
        log.debug("Stored tutor answer cache key={} mode={} courseId={} semantic={}",
                key,
                mode,
                courseId,
                questionEmbedding != null && !questionEmbedding.isEmpty());
    }

    private void incrementReuse(CanonicalTutorAnswer entry) {
        if (entry == null || entry.getId() == null) {
            return;
        }
        LocalDateTime reusedAt = LocalDateTime.now();
        entry.setReuseCount(entry.getReuseCount() + 1L);
        entry.setLastReusedAt(reusedAt);
        persistReuseIncrementAsync(entry.getId(), reusedAt);
    }

    private void incrementReuse(String cacheId, MemoryRagAnswer memoryEntry) {
        LocalDateTime reusedAt = LocalDateTime.now();
        memoryEntry.reuseCount.incrementAndGet();
        memoryEntry.lastReusedAt.set(reusedAt);
        persistReuseIncrementAsync(cacheId, reusedAt);
    }

    private void persistReuseIncrementAsync(String cacheId, LocalDateTime reusedAt) {
        CompletableFuture.runAsync(() -> {
            try {
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("_id").is(cacheId)),
                        new Update().inc("reuseCount", 1L).set("lastReusedAt", reusedAt),
                        CanonicalTutorAnswer.class
                );
            } catch (Exception error) {
                log.warn("Cannot persist cache reuse increment for cacheId={}: {}", cacheId, error.getMessage());
            }
        });
    }

    private CourseRagAnswer withHitMetadata(
            CourseRagAnswer answer,
            String hitType,
            String matchedCacheId,
            double similarity,
            long lookupStartedNanos,
            String courseId,
            String classId
    ) {
        return CourseRagAnswer.builder()
                .answer(answer.getAnswer())
                .confidence(answer.getConfidence())
                .sources(answer.getSources())
                .sourceEvidence(answer.getSourceEvidence())
                .groundingType(answer.getGroundingType())
                .escalationRecommended(answer.getEscalationRecommended())
                .escalationReason(answer.getEscalationReason())
                .cacheHitMetadata(TutorCacheHitMetadata.builder()
                        .hitType(hitType)
                        .matchedCacheId(matchedCacheId)
                        .similarity(similarity)
                        .cacheLookupMs(TutorCacheHitAuditService.elapsedMillis(lookupStartedNanos))
                        .courseId(trim(courseId))
                        .classId(normalizeScope(classId))
                        .build())
                .build();
    }

    private boolean hasSourceEvidence(CourseRagAnswer answer) {
        return answer != null
                && answer.getSourceEvidence() != null
                && !answer.getSourceEvidence().isEmpty();
    }

    public Map<String, Object> diagnostics() {
        Map<String, Object> diagnostics = new java.util.LinkedHashMap<>();
        diagnostics.put("enabled", enabled);
        diagnostics.put("semanticEnabled", semanticEnabled);
        diagnostics.put("exactMemoryEntries", exactRagMemoryCache.size());
        diagnostics.put("semanticEarlyMinSimilarity", semanticEarlyMinSimilarity);
        diagnostics.put("semanticEarlyMinKeywordOverlap", semanticEarlyMinKeywordOverlap);
        diagnostics.put("semanticEarlyMinEvidenceCount", semanticEarlyMinEvidenceCount);
        diagnostics.put("semanticVerifiedMinSimilarity", semanticMinSimilarity);
        diagnostics.put("semanticVerifiedMinKeywordOverlap", semanticMinKeywordOverlap);
        diagnostics.put("semanticVerifiedMinSourceOverlap", semanticMinSourceOverlap);
        diagnostics.put("semanticMaxCandidates", semanticMaxCandidates);
        return diagnostics;
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
                && !StudentFacingMessages.isInsufficientMaterialAnswer(answer)
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
