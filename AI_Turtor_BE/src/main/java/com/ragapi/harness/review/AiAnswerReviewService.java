package com.ragapi.harness.review;
import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.REVIEW_NOTE_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireEnum;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;
import static com.ragapi.util.ValidationUtils.validateRating;
import com.ragapi.service.student.KnowledgeImageStorageService;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.service.notification.UserNotificationService;

import com.ragapi.dto.AiAnswerReviewEvidenceItem;
import com.ragapi.dto.AiAnswerReviewRequest;
import com.ragapi.dto.GroupedAiAnswerReviewItem;
import com.ragapi.dto.SeniorReviewResolutionRequest;
import com.ragapi.harness.entity.AiAnswerReview;
import com.ragapi.harness.entity.KnowledgeCandidate;
import com.ragapi.harness.entity.KnowledgeImageAttachment;
import com.ragapi.harness.repository.AiAnswerReviewRepository;
import com.ragapi.harness.repository.KnowledgeCandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;


@Service
@RequiredArgsConstructor
public class AiAnswerReviewService {

    private static final String STATUS_SUBMITTED = "SUBMITTED";
    private static final String STATUS_NEEDS_MENTOR_REVIEW = "NEEDS_MENTOR_REVIEW";
    private static final String STATUS_NEEDS_SENIOR_REVIEW = "NEEDS_SENIOR_REVIEW";
    private static final String STATUS_RESOLVED = "RESOLVED";
    private static final String KNOWLEDGE_PENDING_SENIOR_REVIEW = "PENDING_SENIOR_REVIEW";
    private static final String TIER_MODERATE = "MODERATE";
    private static final String TIER_SEVERE = "SEVERE";
    private static final String TIER_IMMEDIATE = "IMMEDIATE";

    private final AiAnswerReviewRepository reviewRepository;
    private final KnowledgeCandidateRepository knowledgeCandidateRepository;
    private final RealtimeEventService realtimeEvents;
    private final TutorAnswerCacheSeniorService tutorAnswerCacheSeniorService;
    private final KnowledgeImageStorageService knowledgeImageStorageService;
    private final UserNotificationService notifications;

    @Value("${app.answer-review.moderate-student-threshold:1}")
    private int moderateStudentThreshold = 1;

    @Value("${app.answer-review.severe-student-threshold:1}")
    private int severeStudentThreshold = 1;

    @Value("${app.answer-review.moderate-rating-min:2}")
    private int moderateRatingMin = 2;

    @Value("${app.answer-review.moderate-rating-max:3}")
    private int moderateRatingMax = 3;

    @Value("${app.answer-review.severe-rating-max:1}")
    private int severeRatingMax = 1;

    @Value("${app.answer-review.red-alert-negative-count:5}")
    private int redAlertNegativeCount = 5;

    @Value("${app.answer-review.similar-question-overlap:0.45}")
    private double similarQuestionOverlap = 0.45;

    public AiAnswerReview submitReview(AiAnswerReviewRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String studentId = requireText(request.getStudentId(), "studentId");
        String courseId = requireText(request.getCourseId(), "courseId");
        String mode = normalizeMode(request.getMode());
        requireEnum(mode, "mode", "RAG", "CODE", "ESCALATE");
        String question = requireMaxLength(request.getQuestion(), "question", DEFAULT_TEXT_MAX_LENGTH);
        String answer = requireMaxLength(request.getAnswer(), "answer", DEFAULT_TEXT_MAX_LENGTH);
        validateRating(request.getRating(), true);

        String reviewType = normalizeReviewType(request.getReviewType());
        validateReviewType(reviewType);
        validateReviewFeedback(request, reviewType);
        LocalDateTime now = LocalDateTime.now();
        String answerFingerprint = answerFingerprint(courseId, question, answer);
        EscalationPlan plan = planEscalation(request, reviewType);

        AiAnswerReview review = AiAnswerReview.builder()
                .id(UUID.randomUUID().toString())
                .studentId(studentId)
                .courseId(courseId)
                .classId(trimToNull(request.getClassId()))
                .conversationId(trimToNull(request.getConversationId()))
                .questionEscalationId(trimToNull(request.getQuestionEscalationId()))
                .mode(mode)
                .reviewType(reviewType)
                .question(question)
                .answer(answer)
                .answerFingerprint(answerFingerprint)
                .aiConfidence(request.getAiConfidence())
                .rating(request.getRating())
                .accurate(request.getAccurate())
                .helpful(request.getHelpful())
                .correctnessLevel(normalizeUpper(request.getCorrectnessLevel()))
                .feedback(optionalMaxLength(request.getFeedback(), "feedback", DEFAULT_TEXT_MAX_LENGTH))
                .suggestedCorrection(optionalMaxLength(request.getSuggestedCorrection(), "suggestedCorrection", DEFAULT_TEXT_MAX_LENGTH))
                .reviewedBy(trimToNull(request.getReviewedBy()))
                .reviewerRole(normalizeUpper(request.getReviewerRole()))
                .status(plan.immediateStatus() != null ? plan.immediateStatus() : STATUS_SUBMITTED)
                .escalationTier(plan.immediateTier())
                .createdAt(now)
                .updatedAt(now)
                .build();
        review = reviewRepository.save(review);

        if (plan.crowdGated()) {
            recomputeFingerprintEscalation(courseId, answerFingerprint, now);
            review = reviewRepository.findById(review.getId()).orElse(review);
        } else if (STATUS_NEEDS_SENIOR_REVIEW.equals(review.getStatus())) {
            publishAnswerReviewEscalation(review, STATUS_NEEDS_SENIOR_REVIEW, 1);
        }
        return review;
    }


    private AnswerReviewQueue queue() {
        return new AnswerReviewQueue(redAlertNegativeCount, similarQuestionOverlap);
    }

    public List<GroupedAiAnswerReviewItem> listGroupedPending(String queueStatus, String courseId) {
        List<AiAnswerReview> pending = listReviews(queueStatus, courseId, null);
        Map<String, List<AiAnswerReview>> grouped = new LinkedHashMap<>();
        for (AiAnswerReview review : pending) {
            String key = queue().groupKey(review);
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(review);
        }
        return grouped.values().stream()
                .collect(java.util.stream.Collectors.collectingAndThen(
                        java.util.stream.Collectors.toList(),
                        queue()::clusterSimilarFingerprintGroups
                ))
                .stream()
                .map(members -> queue().toGroupedItem(members, queueStatus))
                .sorted(queue().queueUrgencyOrder())
                .toList();
    }

    public List<AiAnswerReview> listReviews(String status, String courseId, String studentId) {
        List<AiAnswerReview> reviews = status != null && !status.isBlank()
                ? reviewRepository.findByStatus(status.trim().toUpperCase())
                : reviewRepository.findAll();

        if (courseId != null && !courseId.isBlank()) {
            reviews = reviews.stream()
                    .filter(review -> courseId.equals(review.getCourseId()))
                    .toList();
        }
        if (studentId != null && !studentId.isBlank()) {
            reviews = reviews.stream()
                    .filter(review -> studentId.equals(review.getStudentId()))
                    .toList();
        }
        return reviews;
    }

    public AiAnswerReview resolveBySeniorReviewer(String reviewId, SeniorReviewResolutionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        requireSeniorReviewer(request.getSeniorReviewerId(), request.getReviewerRole());

        AiAnswerReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("AI answer review not found"));

        LocalDateTime now = LocalDateTime.now();
        String originalStatus = review.getStatus();
        List<AiAnswerReview> group = reviewRepository.findByStatus(originalStatus).stream()
                .filter(item -> Objects.equals(review.getCourseId(), item.getCourseId()))
                .filter(item -> sameOrSimilarQuestion(review, item))
                .toList();

        String candidateId = null;
        if (Boolean.TRUE.equals(request.getCreateKnowledgeCandidate())) {
            String candidateType = normalizeCandidateType(request.getCandidateType());
            validateLearnableCandidateType(candidateType);
            validateReviewCanCreateKnowledge(review);
            KnowledgeCandidate candidate = createKnowledgeCandidate(review, request, candidateType, now);
            candidate = knowledgeCandidateRepository.save(candidate);
            candidateId = candidate.getId();
            Map<String, Object> candidateData = new LinkedHashMap<>();
            candidateData.put("candidateId", candidate.getId());
            candidateData.put("courseId", candidate.getCourseId() == null ? "" : candidate.getCourseId());
            candidateData.put("classId", candidate.getClassId() == null ? "" : candidate.getClassId());
            candidateData.put("status", candidate.getStatus());
            try {
                notifications.publishStoredOrRoles(
                        notifications.recordKnowledgeReview(candidate),
                        Set.of("SENIOR_MENTOR", "ADMIN"),
                        "KNOWLEDGE_CANDIDATE_CREATED",
                        "KNOWLEDGE_CANDIDATE",
                        candidate.getId(),
                        candidate.getStatus(),
                        candidateData
                );
            } catch (Exception notifyError) {
                realtimeEvents.publishToRoles(
                        Set.of("SENIOR_MENTOR", "ADMIN"),
                        "KNOWLEDGE_CANDIDATE_CREATED",
                        "KNOWLEDGE_CANDIDATE",
                        candidate.getId(),
                        candidate.getStatus(),
                        candidateData
                );
            }
        }

        AiAnswerReview representative = review;
        for (AiAnswerReview member : group) {
            member.setSeniorReviewerId(request.getSeniorReviewerId().trim());
            member.setSeniorReviewerName(trimToNull(request.getSeniorReviewerName()));
            member.setSeniorReviewDecision(normalizeUpper(request.getDecision()));
            member.setSeniorReviewNotes(optionalMaxLength(request.getNotes(), "notes", REVIEW_NOTE_MAX_LENGTH));
            member.setSeniorReviewedAt(now);
            member.setStatus(STATUS_RESOLVED);
            member.setUpdatedAt(now);
            if (candidateId != null) {
                member.setLinkedKnowledgeCandidateId(candidateId);
            }
            AiAnswerReview saved = reviewRepository.save(member);
            if (Objects.equals(member.getId(), reviewId)) {
                representative = saved;
            }
        }
        tutorAnswerCacheSeniorService.applySeniorReviewResolution(
                representative,
                request.getDecision(),
                request.getCorrectedAnswer(),
                request.getNotes(),
                request.getSeniorReviewerId(),
                request.getSeniorReviewerName()
        );
        return representative;
    }

    private KnowledgeCandidate createKnowledgeCandidate(
            AiAnswerReview review,
            SeniorReviewResolutionRequest request,
            String candidateType,
            LocalDateTime now
    ) {
        String correctedAnswer = optionalMaxLength(request.getCorrectedAnswer(), "correctedAnswer", DEFAULT_TEXT_MAX_LENGTH);
        if (correctedAnswer == null) {
            correctedAnswer = optionalMaxLength(review.getSuggestedCorrection(), "suggestedCorrection", DEFAULT_TEXT_MAX_LENGTH);
        }
        if (correctedAnswer == null) {
            correctedAnswer = optionalMaxLength(review.getFeedback(), "feedback", DEFAULT_TEXT_MAX_LENGTH);
        }
        if (correctedAnswer == null) {
            throw new IllegalArgumentException("correctedAnswer, suggestedCorrection, or feedback is required to create a knowledge candidate");
        }

        List<KnowledgeImageAttachment> images = knowledgeImageStorageService.resolveAttachments(request.getImageIds());
        String content = """
                Question:
                %s

                Senior-reviewed correction:
                %s

                Review evidence:
                reviewType=%s, rating=%s, accurate=%s, helpful=%s, feedback=%s
                """.formatted(
                review.getQuestion(),
                correctedAnswer,
                review.getReviewType(),
                review.getRating(),
                review.getAccurate(),
                review.getHelpful(),
                review.getFeedback() == null ? "" : review.getFeedback()
        ) + KnowledgeImageStorageService.formatImageAppendix(images);

        return KnowledgeCandidate.builder()
                .id(UUID.randomUUID().toString())
                .aiAnswerReviewId(review.getId())
                .courseId(review.getCourseId())
                .classId(review.getClassId())
                .teacherId(request.getSeniorReviewerId().trim())
                .candidateType(candidateType)
                .sourceType("AI_ANSWER_REVIEW")
                .question(review.getQuestion())
                .answer(correctedAnswer)
                .content(content)
                .images(images.isEmpty() ? null : images)
                .status(KNOWLEDGE_PENDING_SENIOR_REVIEW)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private record EscalationPlan(
            boolean crowdGated,
            String crowdTier,
            String immediateStatus,
            String immediateTier
    ) {}

    private EscalationPlan planEscalation(AiAnswerReviewRequest request, String reviewType) {
        if (isOperationalReviewType(reviewType)) {
            return new EscalationPlan(false, null, null, null);
        }
        if (isImmediateSeniorReviewType(reviewType)) {
            return new EscalationPlan(false, null, STATUS_NEEDS_SENIOR_REVIEW, TIER_IMMEDIATE);
        }
        if (isSevereNegativeReview(request) || mentionsWrongCourseKnowledge(request.getFeedback())
                || mentionsWrongCourseKnowledge(request.getSuggestedCorrection())) {
            return new EscalationPlan(true, TIER_SEVERE, null, null);
        }
        if (isModerateNegativeReview(request)) {
            return new EscalationPlan(true, TIER_MODERATE, null, null);
        }
        return new EscalationPlan(false, null, null, null);
    }

    private void recomputeFingerprintEscalation(String courseId, String answerFingerprint, LocalDateTime now) {
        List<AiAnswerReview> group = reviewRepository.findByCourseIdAndAnswerFingerprint(courseId, answerFingerprint);
        long severeStudents = countDistinctStudents(group, this::isSevereNegativeReviewEntity);
        long moderateStudents = countDistinctStudents(group, this::isModerateNegativeReviewEntity);

        if (severeStudents >= Math.max(1, severeStudentThreshold)) {
            AiAnswerReview sample = escalateTier(
                    group,
                    TIER_SEVERE,
                    STATUS_NEEDS_SENIOR_REVIEW,
                    this::isSevereNegativeReviewEntity,
                    now
            );
            if (sample != null) {
                publishAnswerReviewEscalation(sample, STATUS_NEEDS_SENIOR_REVIEW, severeStudents);
            }
        }
        if (moderateStudents >= Math.max(1, moderateStudentThreshold)) {
            AiAnswerReview sample = escalateTier(
                    group,
                    TIER_MODERATE,
                    STATUS_NEEDS_MENTOR_REVIEW,
                    this::isModerateNegativeReviewEntity,
                    now
            );
            if (sample != null) {
                publishAnswerReviewEscalation(sample, STATUS_NEEDS_MENTOR_REVIEW, moderateStudents);
            }
        }
    }

    private AiAnswerReview escalateTier(
            List<AiAnswerReview> group,
            String tier,
            String targetStatus,
            Predicate<AiAnswerReview> matcher,
            LocalDateTime now
    ) {
        AiAnswerReview lastUpdated = null;
        for (AiAnswerReview review : group) {
            if (!matcher.test(review)) {
                continue;
            }
            if (!STATUS_SUBMITTED.equals(review.getStatus())) {
                continue;
            }
            review.setStatus(targetStatus);
            review.setEscalationTier(tier);
            review.setUpdatedAt(now);
            lastUpdated = reviewRepository.save(review);
        }
        return lastUpdated;
    }

    private long countDistinctStudents(List<AiAnswerReview> group, Predicate<AiAnswerReview> matcher) {
        return group.stream()
                .filter(matcher)
                .map(AiAnswerReview::getStudentId)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .distinct()
                .count();
    }

    private boolean sameOrSimilarQuestion(AiAnswerReview left, AiAnswerReview right) {
        if (left == null || right == null) {
            return false;
        }
        if (Objects.equals(effectiveFingerprint(left), effectiveFingerprint(right))) {
            return true;
        }
        return com.ragapi.harness.util.QuestionOverlapUtil.areSimilarQuestions(
                left.getQuestion(),
                right.getQuestion(),
                similarQuestionOverlap
        );
    }

    private boolean isModerateNegativeReview(AiAnswerReviewRequest request) {
        Integer rating = request.getRating();
        if (rating == null) {
            return false;
        }
        if (rating < moderateRatingMin || rating > moderateRatingMax) {
            return false;
        }
        return Boolean.FALSE.equals(request.getAccurate())
                || rating <= moderateRatingMax;
    }

    private boolean isSevereNegativeReview(AiAnswerReviewRequest request) {
        Integer rating = request.getRating();
        if (rating == null) {
            return false;
        }
        return rating <= severeRatingMax && isNegativeReview(request);
    }

    private boolean isModerateNegativeReviewEntity(AiAnswerReview review) {
        Integer rating = review.getRating();
        if (rating == null) {
            return false;
        }
        if (rating < moderateRatingMin || rating > moderateRatingMax) {
            return false;
        }
        return isNegativeReviewEntity(review);
    }

    private boolean isSevereNegativeReviewEntity(AiAnswerReview review) {
        Integer rating = review.getRating();
        if (rating == null) {
            return false;
        }
        return rating <= severeRatingMax && isNegativeReviewEntity(review);
    }

    private void publishAnswerReviewEscalation(AiAnswerReview review, String status, long negativeStudentCount) {
        Map<String, Object> data = Map.of(
                "courseId", review.getCourseId() == null ? "" : review.getCourseId(),
                "classId", review.getClassId() == null ? "" : review.getClassId(),
                "reviewType", review.getReviewType() == null ? "" : review.getReviewType(),
                "answerFingerprint", review.getAnswerFingerprint() == null ? "" : review.getAnswerFingerprint(),
                "escalationTier", review.getEscalationTier() == null ? "" : review.getEscalationTier(),
                "negativeStudentCount", negativeStudentCount
        );
        if (STATUS_NEEDS_MENTOR_REVIEW.equals(status)) {
            realtimeEvents.publishToRoles(
                    Set.of("TEACHER"),
                    "ANSWER_REVIEW_NEEDS_MENTOR",
                    "AI_ANSWER_REVIEW",
                    review.getId(),
                    status,
                    data
            );
        } else if (STATUS_NEEDS_SENIOR_REVIEW.equals(status)) {
            realtimeEvents.publishToRoles(
                    Set.of("SENIOR_MENTOR", "ADMIN"),
                    "ANSWER_REVIEW_NEEDS_SENIOR",
                    "AI_ANSWER_REVIEW",
                    review.getId(),
                    status,
                    data
            );
        }
    }

    private boolean isNegativeReviewEntity(AiAnswerReview review) {
        if (Boolean.FALSE.equals(review.getAccurate())) {
            return true;
        }
        if (review.getRating() != null && review.getRating() <= 3) {
            return true;
        }
        String correctness = normalizeUpper(review.getCorrectnessLevel());
        return "LOW".equals(correctness) || "INCORRECT".equals(correctness) || "WRONG".equals(correctness);
    }

    private String answerFingerprint(String courseId, String question, String answer) {
        String payload = normalizeFingerprintPart(courseId)
                + "|"
                + normalizeFingerprintPart(question)
                + "|"
                + normalizeFingerprintPart(answer);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot fingerprint AI answer review", e);
        }
    }

    private String effectiveFingerprint(AiAnswerReview review) {
        if (review.getAnswerFingerprint() != null && !review.getAnswerFingerprint().isBlank()) {
            return review.getAnswerFingerprint().trim();
        }
        return answerFingerprint(review.getCourseId(), review.getQuestion(), review.getAnswer());
    }

    private String normalizeFingerprintPart(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    private boolean isImmediateSeniorReviewType(String reviewType) {
        return "SOURCE_CONFLICT".equals(reviewType)
                || "MISSING_MATERIAL".equals(reviewType)
                || "KNOWLEDGE_CORRECTION".equals(reviewType)
                || "MATERIAL_CORRECTION".equals(reviewType);
    }

    private String normalizeMode(String mode) {
        String normalized = normalizeUpper(mode);
        if ("RAG_TUTOR".equals(normalized)) {
            return "RAG";
        }
        if ("CODE_MENTOR".equals(normalized)) {
            return "CODE";
        }
        return normalized;
    }

    private boolean isNegativeReview(AiAnswerReviewRequest request) {
        if (Boolean.FALSE.equals(request.getAccurate())) {
            return true;
        }
        if (request.getRating() != null && request.getRating() <= 3) {
            return true;
        }
        String correctness = normalizeUpper(request.getCorrectnessLevel());
        return "LOW".equals(correctness) || "INCORRECT".equals(correctness) || "WRONG".equals(correctness);
    }

    private boolean mentionsWrongCourseKnowledge(String text) {
        String normalized = normalizeLowerAscii(text);
        if (normalized == null) {
            return false;
        }
        return normalized.contains("tai lieu sai")
                || normalized.contains("sai tai lieu")
                || normalized.contains("tai lieu khong dung")
                || normalized.contains("khong dung tai lieu")
                || normalized.contains("slide sai")
                || normalized.contains("sai slide")
                || normalized.contains("slide khong dung")
                || normalized.contains("kien thuc sai")
                || normalized.contains("sai kien thuc")
                || normalized.contains("nguon sai")
                || normalized.contains("sai nguon")
                || normalized.contains("khac voi slide")
                || normalized.contains("trai voi tai lieu")
                || normalized.contains("material is wrong")
                || normalized.contains("wrong material")
                || normalized.contains("document is wrong")
                || normalized.contains("wrong document")
                || normalized.contains("source is wrong")
                || normalized.contains("wrong source")
                || normalized.contains("knowledge is wrong")
                || normalized.contains("wrong knowledge");
    }

    private void validateReviewCanCreateKnowledge(AiAnswerReview review) {
        String reviewType = normalizeReviewType(review.getReviewType());
        if (!"ANSWER_DISPUTE".equals(reviewType)
                && !"SOURCE_CONFLICT".equals(reviewType)
                && !"MISSING_MATERIAL".equals(reviewType)) {
            throw new IllegalArgumentException("Only learning disputes, source conflicts, or missing material reviews can create AI learning candidates");
        }
    }

    private void validateReviewType(String reviewType) {
        requireEnum(reviewType, "reviewType",
                "QUALITY_FEEDBACK",
                "ANSWER_DISPUTE",
                "SOURCE_CONFLICT",
                "MISSING_MATERIAL",
                "KNOWLEDGE_CORRECTION",
                "MATERIAL_CORRECTION",
                "OPERATIONAL_POLICY",
                "GRADING_DECISION",
                "CLASS_RULE",
                "ASSIGNMENT_SPECIFIC");
    }

    private void validateReviewFeedback(AiAnswerReviewRequest request, String reviewType) {
        String feedback = optionalMaxLength(request.getFeedback(), "feedback", DEFAULT_TEXT_MAX_LENGTH);
        optionalMaxLength(request.getSuggestedCorrection(), "suggestedCorrection", DEFAULT_TEXT_MAX_LENGTH);
        if (("SOURCE_CONFLICT".equals(reviewType)
                || "MISSING_MATERIAL".equals(reviewType)
                || "KNOWLEDGE_CORRECTION".equals(reviewType)
                || "MATERIAL_CORRECTION".equals(reviewType)
                || (request.getRating() != null && request.getRating() <= 1))
                && feedback == null) {
            throw new IllegalArgumentException("feedback is required for severe or source-related reviews");
        }
    }

    private boolean isOperationalReviewType(String reviewType) {
        return "OPERATIONAL_POLICY".equals(reviewType)
                || "GRADING_DECISION".equals(reviewType)
                || "CLASS_RULE".equals(reviewType)
                || "ASSIGNMENT_SPECIFIC".equals(reviewType);
    }

    private void validateLearnableCandidateType(String candidateType) {
        if (!"ACADEMIC_KNOWLEDGE".equals(candidateType)
                && !"MATERIAL_CORRECTION".equals(candidateType)
                && !"FAQ_CLARIFICATION".equals(candidateType)) {
            throw new IllegalArgumentException("Only ACADEMIC_KNOWLEDGE, MATERIAL_CORRECTION, or FAQ_CLARIFICATION can be used for AI learning candidates");
        }
    }

    private String normalizeCandidateType(String candidateType) {
        String normalized = normalizeUpper(candidateType);
        return normalized == null ? "ACADEMIC_KNOWLEDGE" : normalized;
    }

    private String normalizeReviewType(String reviewType) {
        String normalized = normalizeUpper(reviewType);
        return normalized == null ? "QUALITY_FEEDBACK" : normalized;
    }

    private void requireSeniorReviewer(String reviewerId, String reviewerRole) {
        requireText(reviewerId, "seniorReviewerId");
        String role = normalizeUpper(reviewerRole);
        if (!"SENIOR_MENTOR".equals(role) && !"ADMIN".equals(role)) {
            throw new IllegalArgumentException("Only SENIOR_MENTOR or ADMIN can resolve AI answer reviews");
        }
    }

    private String trimToNull(String value) {
        return optionalMaxLength(value, "value", SHORT_TEXT_MAX_LENGTH);
    }

    private String normalizeUpper(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase();
    }

    private String normalizeLowerAscii(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('\u0111', 'd')
                .replace('\u0110', 'D')
                .toLowerCase();
        return normalized.replaceAll("[^a-z0-9]+", " ").trim();
    }
}
