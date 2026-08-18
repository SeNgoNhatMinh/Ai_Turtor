package com.ragapi.service;

import com.ragapi.dto.SeniorTutorAnswerCacheUpdateRequest;
import com.ragapi.dto.TutorAnswerCacheView;
import com.ragapi.entity.AiAnswerReview;
import com.ragapi.entity.CanonicalTutorAnswer;
import com.ragapi.entity.TutorCacheHitAudit;
import com.ragapi.repository.CanonicalTutorAnswerRepository;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@Service
@RequiredArgsConstructor
public class TutorAnswerCacheSeniorService {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_DISABLED = "DISABLED";
    public static final String STATUS_SENIOR_APPROVED = "SENIOR_APPROVED";
    public static final String STATUS_SENIOR_CORRECTED = "SENIOR_CORRECTED";

    private final CanonicalTutorAnswerRepository repository;
    private final TutorCacheHitAuditService auditService;
    private final CanonicalTutorAnswerCacheService cacheService;

    public List<TutorAnswerCacheView> list(
            String courseId,
            String classId,
            String mode,
            String reviewStatus
    ) {
        requireText(courseId, "courseId");
        List<CanonicalTutorAnswer> entries = new ArrayList<>();
        if (reviewStatus != null && !reviewStatus.isBlank()) {
            entries.addAll(repository.findByCourseIdAndReviewStatusOrderByCreatedAtDesc(
                    courseId.trim(),
                    reviewStatus.trim().toUpperCase(Locale.ROOT)
            ));
        } else if (mode != null && !mode.isBlank()) {
            entries.addAll(repository.findByCourseIdAndModeOrderByCreatedAtDesc(
                    courseId.trim(),
                    mode.trim().toUpperCase(Locale.ROOT)
            ));
        } else {
            entries.addAll(repository.findByCourseIdOrderByCreatedAtDesc(courseId.trim()));
        }
        return entries.stream()
                .filter(entry -> matchesClass(entry, classId))
                .filter(entry -> reviewStatus == null || reviewStatus.isBlank()
                        || reviewStatus.trim().equalsIgnoreCase(normalizeReviewStatus(entry.getReviewStatus())))
                .filter(entry -> mode == null || mode.isBlank()
                        || mode.trim().equalsIgnoreCase(nullToEmpty(entry.getMode())))
                .sorted(Comparator.comparing(CanonicalTutorAnswer::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toView)
                .toList();
    }

    public Map<String, Object> stats(String courseId) {
        requireText(courseId, "courseId");
        List<CanonicalTutorAnswer> entries = repository.findByCourseIdOrderByCreatedAtDesc(courseId.trim());
        Map<String, Long> byStatus = new LinkedHashMap<>();
        long active = 0;
        long disabled = 0;
        long seniorApproved = 0;
        long seniorCorrected = 0;
        long totalReuseCount = 0;
        LocalDateTime lastReusedAt = null;
        for (CanonicalTutorAnswer entry : entries) {
            totalReuseCount += entry.getReuseCount();
            if (entry.getLastReusedAt() != null
                    && (lastReusedAt == null || entry.getLastReusedAt().isAfter(lastReusedAt))) {
                lastReusedAt = entry.getLastReusedAt();
            }
            switch (normalizeReviewStatus(entry.getReviewStatus())) {
                case STATUS_DISABLED -> disabled++;
                case STATUS_SENIOR_APPROVED -> seniorApproved++;
                case STATUS_SENIOR_CORRECTED -> seniorCorrected++;
                default -> active++;
            }
        }
        byStatus.put(STATUS_ACTIVE, active);
        byStatus.put(STATUS_SENIOR_APPROVED, seniorApproved);
        byStatus.put(STATUS_SENIOR_CORRECTED, seniorCorrected);
        byStatus.put(STATUS_DISABLED, disabled);
        List<TutorCacheHitAudit> recentHits = auditService.hitsSince(courseId, LocalDateTime.now().minusHours(24));
        Map<String, Long> hitsByType = new LinkedHashMap<>();
        recentHits.forEach(hit -> hitsByType.merge(hit.getHitType(), 1L, Long::sum));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("courseId", courseId.trim());
        result.put("total", entries.size());
        result.put("byReviewStatus", byStatus);
        result.put("totalReuseCount", totalReuseCount);
        result.put("lastReusedAt", lastReusedAt);
        result.put("hitsLast24Hours", recentHits.size());
        result.put("hitsByTypeLast24Hours", hitsByType);
        result.put("averageCacheLookupMsLast24Hours", average(recentHits, true));
        result.put("averageBackendProcessingMsLast24Hours", average(recentHits, false));
        return result;
    }

    public Map<String, Object> diagnostics(String courseId) {
        requireText(courseId, "courseId");
        Map<String, Object> result = new LinkedHashMap<>(cacheService.diagnostics());
        result.put("courseId", courseId.trim());
        result.put("recentHitSampleSize", auditService.recentHits(courseId, 20).size());
        return result;
    }

    public List<TutorCacheHitAudit> recentHits(String courseId, int limit) {
        requireText(courseId, "courseId");
        return auditService.recentHits(courseId, limit);
    }

    public TutorAnswerCacheView get(String cacheId) {
        return toView(requireEntry(cacheId));
    }

    public TutorAnswerCacheView approve(String cacheId, SeniorTutorAnswerCacheUpdateRequest request) {
        requireSenior(request);
        CanonicalTutorAnswer entry = requireEntry(cacheId);
        entry.setReviewStatus(STATUS_SENIOR_APPROVED);
        applySeniorMetadata(entry, request, null);
        return toView(repository.save(entry));
    }

    public TutorAnswerCacheView correct(String cacheId, SeniorTutorAnswerCacheUpdateRequest request) {
        requireSenior(request);
        CanonicalTutorAnswer entry = requireEntry(cacheId);
        String corrected = requireMaxLength(request.getCorrectedAnswer(), "correctedAnswer", DEFAULT_TEXT_MAX_LENGTH);
        if (entry.getOriginalAnswer() == null || entry.getOriginalAnswer().isBlank()) {
            entry.setOriginalAnswer(entry.getAnswer());
        }
        entry.setAnswer(TextSanitizer.cleanForStudentAnswer(corrected));
        entry.setReviewStatus(STATUS_SENIOR_CORRECTED);
        applySeniorMetadata(entry, request, corrected);
        log.info("Senior corrected tutor answer cache id={} courseId={}", cacheId, entry.getCourseId());
        return toView(repository.save(entry));
    }

    public TutorAnswerCacheView disable(String cacheId, SeniorTutorAnswerCacheUpdateRequest request) {
        requireSenior(request);
        CanonicalTutorAnswer entry = requireEntry(cacheId);
        entry.setReviewStatus(STATUS_DISABLED);
        applySeniorMetadata(entry, request, null);
        log.info("Senior disabled tutor answer cache id={} courseId={}", cacheId, entry.getCourseId());
        return toView(repository.save(entry));
    }

    public void delete(String cacheId, SeniorTutorAnswerCacheUpdateRequest request) {
        requireSenior(request);
        if (!repository.existsById(cacheId)) {
            throw new IllegalArgumentException("Tutor answer cache entry not found");
        }
        repository.deleteById(cacheId);
        log.info("Senior deleted tutor answer cache id={}", cacheId);
    }

    public void applySeniorReviewResolution(AiAnswerReview review, String decision, String correctedAnswer, String notes,
                                            String seniorReviewerId, String seniorReviewerName) {
        if (review == null || review.getCourseId() == null || review.getQuestion() == null) {
            return;
        }
        String normalizedDecision = decision == null ? "" : decision.trim().toUpperCase(Locale.ROOT);
        List<CanonicalTutorAnswer> matches = findMatchingEntries(review);
        if (matches.isEmpty()) {
            return;
        }
        for (CanonicalTutorAnswer entry : matches) {
            entry.setLinkedReviewId(review.getId());
            entry.setSeniorReviewerId(trim(seniorReviewerId));
            entry.setSeniorReviewerName(trim(seniorReviewerName));
            entry.setSeniorReviewNotes(trim(notes));
            entry.setSeniorReviewedAt(LocalDateTime.now());
            if ("REJECT_FEEDBACK".equals(normalizedDecision)) {
                entry.setReviewStatus(STATUS_DISABLED);
            } else if ("APPROVE_FEEDBACK".equals(normalizedDecision)) {
                entry.setReviewStatus(STATUS_SENIOR_APPROVED);
            } else if ("CREATE_KNOWLEDGE_CANDIDATE".equals(normalizedDecision) && hasText(correctedAnswer)) {
                if (entry.getOriginalAnswer() == null || entry.getOriginalAnswer().isBlank()) {
                    entry.setOriginalAnswer(entry.getAnswer());
                }
                entry.setAnswer(TextSanitizer.cleanForStudentAnswer(correctedAnswer));
                entry.setReviewStatus(STATUS_SENIOR_CORRECTED);
            }
            repository.save(entry);
        }
        log.info("Applied senior review decision {} to {} tutor cache entries for reviewId={}",
                normalizedDecision,
                matches.size(),
                review.getId());
    }

    public static boolean isUsableForStudents(CanonicalTutorAnswer entry) {
        return entry != null && !STATUS_DISABLED.equals(normalizeReviewStatus(entry.getReviewStatus()));
    }

    public static String normalizeReviewStatus(String reviewStatus) {
        if (reviewStatus == null || reviewStatus.isBlank()) {
            return STATUS_ACTIVE;
        }
        return reviewStatus.trim().toUpperCase(Locale.ROOT);
    }

    private List<CanonicalTutorAnswer> findMatchingEntries(AiAnswerReview review) {
        String mode = review.getMode() == null ? "RAG" : review.getMode().trim().toUpperCase(Locale.ROOT);
        List<CanonicalTutorAnswer> candidates = repository.findByCourseIdAndModeOrderByCreatedAtDesc(
                review.getCourseId().trim(),
                mode
        );
        String normalizedQuestion = normalizePart(review.getQuestion());
        String normalizedAnswer = normalizePart(review.getAnswer());
        List<CanonicalTutorAnswer> matches = new ArrayList<>();
        for (CanonicalTutorAnswer entry : candidates) {
            if (!Objects.equals(normalizeScope(entry.getClassId()), normalizeScope(review.getClassId()))) {
                continue;
            }
            boolean questionMatch = normalizedQuestion.equals(normalizePart(entry.getQuestion()));
            boolean answerMatch = normalizedAnswer.equals(normalizePart(entry.getAnswer()))
                    || normalizedAnswer.equals(normalizePart(entry.getOriginalAnswer()));
            if (questionMatch || answerMatch) {
                matches.add(entry);
            }
        }
        return matches;
    }

    private CanonicalTutorAnswer requireEntry(String cacheId) {
        requireText(cacheId, "cacheId");
        return repository.findById(cacheId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Tutor answer cache entry not found"));
    }

    private void requireSenior(SeniorTutorAnswerCacheUpdateRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        requireText(request.getSeniorReviewerId(), "seniorReviewerId");
        String role = request.getReviewerRole() == null ? "" : request.getReviewerRole().trim().toUpperCase(Locale.ROOT);
        if (!"SENIOR_MENTOR".equals(role) && !"ADMIN".equals(role)) {
            throw new IllegalArgumentException("Only SENIOR_MENTOR or ADMIN can manage tutor answer cache");
        }
    }

    private void applySeniorMetadata(
            CanonicalTutorAnswer entry,
            SeniorTutorAnswerCacheUpdateRequest request,
            String correctedAnswer
    ) {
        entry.setSeniorReviewerId(request.getSeniorReviewerId().trim());
        entry.setSeniorReviewerName(trim(request.getSeniorReviewerName()));
        entry.setSeniorReviewNotes(trim(request.getNotes()));
        entry.setSeniorReviewedAt(LocalDateTime.now());
        if (correctedAnswer != null) {
            entry.setLinkedReviewId(null);
        }
    }

    private TutorAnswerCacheView toView(CanonicalTutorAnswer entry) {
        return TutorAnswerCacheView.builder()
                .id(entry.getId())
                .courseId(entry.getCourseId())
                .classId(entry.getClassId())
                .mode(entry.getMode())
                .question(entry.getQuestion())
                .answer(entry.getAnswer())
                .originalAnswer(entry.getOriginalAnswer())
                .confidence(entry.getConfidence())
                .sources(entry.getSources())
                .groundingType(entry.getGroundingType())
                .reviewStatus(normalizeReviewStatus(entry.getReviewStatus()))
                .seniorReviewerId(entry.getSeniorReviewerId())
                .seniorReviewerName(entry.getSeniorReviewerName())
                .seniorReviewNotes(entry.getSeniorReviewNotes())
                .linkedReviewId(entry.getLinkedReviewId())
                .seniorReviewedAt(entry.getSeniorReviewedAt())
                .reuseCount(entry.getReuseCount())
                .lastReusedAt(entry.getLastReusedAt())
                .createdAt(entry.getCreatedAt())
                .expiresAt(entry.getExpiresAt())
                .semanticReady(entry.getQuestionEmbedding() != null && !entry.getQuestionEmbedding().isEmpty())
                .build();
    }

    private double average(List<TutorCacheHitAudit> hits, boolean lookup) {
        return hits.stream()
                .mapToLong(hit -> lookup ? hit.getCacheLookupMs() : hit.getBackendProcessingMs())
                .average()
                .orElse(0.0);
    }

    private boolean matchesClass(CanonicalTutorAnswer entry, String classId) {
        if (classId == null || classId.isBlank()) {
            return true;
        }
        return normalizeScope(entry.getClassId()).equalsIgnoreCase(classId.trim());
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

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
