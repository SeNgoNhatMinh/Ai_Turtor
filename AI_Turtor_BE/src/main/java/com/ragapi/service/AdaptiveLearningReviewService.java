package com.ragapi.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AdaptiveLearningReviewDecisionRequest;
import com.ragapi.dto.AdaptiveStudentLabelOverview;
import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.dto.StudentCourseLearningSummary;
import com.ragapi.dto.TeachingStrategyRecommendation;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.service.adaptive.AdaptiveReviewEvidence.EvidenceFacts;
import com.ragapi.service.adaptive.AdaptiveReviewEvidence.GradedAttempt;
import com.ragapi.service.adaptive.AdaptiveReviewPrompts;
import com.ragapi.service.adaptive.CourseLearningHistory;
import com.ragapi.service.behavior.BehaviorActor;
import com.ragapi.service.behavior.StudentTeachingProfileService;
import com.ragapi.service.behavior.TeachingBehaviorService;
import com.ragapi.service.behavior.TeachingStrategyCatalog;
import com.ragapi.service.behavior.TeachingStrategyRecommendationParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.requireText;
import static com.ragapi.service.adaptive.AdaptiveCycleWindows.*;
import static com.ragapi.service.adaptive.AdaptiveDirectiveTexts.*;
import static com.ragapi.service.adaptive.AdaptiveReviewEvidence.*;
import static com.ragapi.service.adaptive.AdaptiveReviewPolicy.*;
import static com.ragapi.service.adaptive.AdaptiveReviewValues.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdaptiveLearningReviewService {
    /** Stored trigger label; kept for existing reviews and the teacher UI. */
    public static final String TRIGGER_CYCLE = "CYCLE_10";
    public static final String TRIGGER_EARLY_REPEATED_MISTAKES = "EARLY_REPEATED_MISTAKES";
    public static final String TRIGGER_EARLY_CONSISTENT_SUCCESS = "EARLY_CONSISTENT_SUCCESS";
    private static final Set<String> DECISIONS = Set.of("APPROVE", "MODIFY", "REJECT");

    private final AdaptiveLearningReviewRepository reviewRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassSectionRepository classSectionRepository;
    private final ClassRosterService classRosterService;
    private final RealtimeEventService realtimeEvents;
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final OpenRouterChatService chatService;
    private final ObjectMapper objectMapper;
    private final PedagogicalDirectiveService directiveService;
    private final TeachingBehaviorService behaviorService;
    private final StudentTeachingProfileService profileService;

    /**
     * Called after a student question (and its answer) is durably saved. Every
     * {@link #CYCLE_SIZE} questions a student asks within one course triggers an
     * AI review for that student in that course only; counts never mix across
     * courses. Reviews are idempotent per student/course/question count, and a
     * failed LLM assessment never affects the chat flow.
     */
    @Async("adaptiveReviewExecutor")
    public void onStudentQuestionAnswered(String studentId, String courseId, String classId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) return;
        String safeStudentId = studentId.trim();
        String safeCourseId = courseId.trim();
        try {
            List<AiConversation> conversations =
                    conversationRepository.findByUserIdAndCourseId(safeStudentId, safeCourseId);
            List<String> conversationIds = conversations.stream()
                    .map(AiConversation::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            if (conversationIds.isEmpty()) return;

            long totalQuestions = messageRepository.countByConversationIdInAndRole(conversationIds, "STUDENT");
            if (totalQuestions == 0) return;
            // Evaluate the latest completed 10-question milestone. If the exact
            // milestone event was missed (deploy gap, async failure), the next
            // question catches up instead of losing that cycle forever — the
            // support level must be able to move both ways at every milestone.
            int questionCount = (int) (totalQuestions - (totalQuestions % CYCLE_SIZE));
            if (questionCount == 0) return;
            if (reviewRepository.findByStudentIdAndCourseIdAndQuestionCount(
                    safeStudentId, safeCourseId, questionCount).isPresent()) return;
            // Legacy session-based reviews may already cover the same numeric cycle.
            if (reviewRepository.findByStudentIdAndCourseIdAndCompletedSessionCount(
                    safeStudentId, safeCourseId, questionCount).isPresent()) return;

            String effectiveClassId = (classId != null && !classId.isBlank())
                    ? classId.trim()
                    : latestClassId(conversations);
            String currentLevel = directiveService.resolveSupportLevel(
                    safeStudentId, safeCourseId, effectiveClassId);
            List<AiMessage> cycleMessages = latestCycle(sortedCourseMessages(conversationIds));
            createReview(safeStudentId, safeCourseId, effectiveClassId, questionCount,
                    cycleMessages, currentLevel, TRIGGER_CYCLE);
        } catch (Exception error) {
            // Review processing must not make asking a question fail.
            log.error("Adaptive learning review failed for student {} in course {}: {}",
                    safeStudentId, safeCourseId, error.getMessage(), error);
        }
    }

    /**
     * Layer 1 (event-based detection, no LLM): called after an
     * understanding-check answer is stored. Lightweight rules look for
     * repeated mistakes inside the open cycle — at least
     * {@link #EARLY_SAME_CONCEPT_WRONG_THRESHOLD} wrong answers on the same
     * concept, or {@link #EARLY_TOTAL_WRONG_THRESHOLD} wrong answers overall.
     * A single wrong answer is only recorded as evidence. When a rule fires,
     * an early adaptive review runs immediately instead of waiting for the
     * 10-question milestone; at most one early review runs per open cycle.
     */
    @Async("adaptiveReviewExecutor")
    public void onUnderstandingCheckRecorded(String studentId, String courseId, String classId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) return;
        String safeStudentId = studentId.trim();
        String safeCourseId = courseId.trim();
        try {
            List<AiConversation> conversations =
                    conversationRepository.findByUserIdAndCourseId(safeStudentId, safeCourseId);
            List<String> conversationIds = conversations.stream()
                    .map(AiConversation::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            if (conversationIds.isEmpty()) return;

            long totalQuestions = messageRepository.countByConversationIdInAndRole(conversationIds, "STUDENT");
            // Exact milestones are handled by the regular cycle review.
            if (totalQuestions == 0 || totalQuestions % CYCLE_SIZE == 0) return;
            long openCycleStart = totalQuestions - (totalQuestions % CYCLE_SIZE);

            List<AiMessage> window = openCycle(sortedCourseMessages(conversationIds), totalQuestions);
            // After an earlier review in this cycle, only answers recorded since
            // then count, so one burst of mistakes cannot re-trigger forever.
            var latestCycleReview = reviewRepository
                    .findByStudentIdAndCourseIdOrderByCreatedAtDesc(safeStudentId, safeCourseId)
                    .stream()
                    .filter(review -> review.getQuestionCount() != null
                            && review.getQuestionCount() > openCycleStart
                            && review.getQuestionCount() <= totalQuestions)
                    .findFirst();
            LocalDateTime reviewedAt = latestCycleReview.map(AdaptiveLearningReview::getCreatedAt).orElse(null);
            boolean reviewedInCycle = latestCycleReview.isPresent();

            Map<String, Long> wrongByConcept = new LinkedHashMap<>();
            long totalWrong = 0;
            long totalCorrect = 0;
            for (GradedAttempt graded : gradedAttempts(window)) {
                // An easier re-check after a re-teach is the same gap, not a new one.
                if (graded.recheck()) continue;
                var attempt = graded.attempt();
                if (reviewedInCycle && (reviewedAt == null || attempt.getAnsweredAt() == null
                        || !attempt.getAnsweredAt().isAfter(reviewedAt))) {
                    continue;
                }
                if (Boolean.TRUE.equals(attempt.getCorrect())) {
                    totalCorrect++;
                } else if (Boolean.FALSE.equals(attempt.getCorrect())) {
                    totalWrong++;
                    wrongByConcept.merge(normalizeConceptKey(attempt), 1L, Long::sum);
                }
            }
            boolean repeatedSameConcept = wrongByConcept.values().stream()
                    .anyMatch(count -> count >= EARLY_SAME_CONCEPT_WRONG_THRESHOLD);
            long wrongThreshold = reviewedInCycle ? EARLY_SAME_CONCEPT_WRONG_THRESHOLD : EARLY_TOTAL_WRONG_THRESHOLD;
            boolean struggling = repeatedSameConcept || totalWrong >= wrongThreshold;
            boolean consistentSuccess = totalWrong == 0 && totalCorrect >= EARLY_CORRECT_STREAK_THRESHOLD;
            if (!struggling && !consistentSuccess) return;

            String effectiveClassId = (classId != null && !classId.isBlank())
                    ? classId.trim()
                    : latestClassId(conversations);
            String currentLevel = directiveService.resolveSupportLevel(
                    safeStudentId, safeCourseId, effectiveClassId);
            // Nothing to raise when the student is already at the top level.
            if (!struggling && "CHALLENGE".equals(normalizeLevel(currentLevel, "STANDARD"))) return;
            String trigger = struggling ? TRIGGER_EARLY_REPEATED_MISTAKES : TRIGGER_EARLY_CONSISTENT_SUCCESS;
            log.info("Early adaptive review triggered for student {} in course {}: trigger={}, "
                            + "correctAnswers={}, wrongAnswers={}, byConcept={}, totalQuestions={}",
                    safeStudentId, safeCourseId, trigger, totalCorrect, totalWrong, wrongByConcept, totalQuestions);
            createReview(safeStudentId, safeCourseId, effectiveClassId, (int) totalQuestions,
                    window, currentLevel, trigger);
        } catch (Exception error) {
            log.error("Early adaptive review detection failed for student {} in course {}: {}",
                    safeStudentId, safeCourseId, error.getMessage(), error);
        }
    }

    private List<AiMessage> sortedCourseMessages(List<String> conversationIds) {
        return chronologicalChat(messageRepository.findByConversationIdInOrderByCreatedAtAsc(conversationIds));
    }

    private void createReview(String studentId, String courseId, String classId, int questionCount,
                              List<AiMessage> cycleMessages, String currentSupportLevel, String triggerType) {
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> evidence = buildEvidence(cycleMessages);
        EvidenceFacts facts = evidenceFacts(evidence);
        AssessmentParse parsed = parseAssessment(courseId, currentSupportLevel, facts, evidence);
        Map<String, Object> assessment = parsed.assessment();
        String failure = parsed.failure();

        if (failure == null) assessment.put("confidencePercent", facts.confidencePercent());
        // The prompt contract has no overallPercent: the backend derives it
        // from the three learning dimensions so the UI keeps one summary score.
        assessment.put("overallPercent", Math.round(
                (number(assessment.get("knowledgePercent"), 0)
                        + number(assessment.get("practicePercent"), 0)
                        + number(assessment.get("independencePercent"), 0)) / 3.0f));
        AdaptiveLearningReview previousReview = reviewRepository
                .findByStudentIdAndCourseIdOrderByCreatedAtDesc(studentId, courseId)
                .stream().findFirst().orElse(null);
        String suggested = failure == null
                ? decideTargetLevel(assessment, currentSupportLevel, previousReview, facts)
                : normalizeLevel(currentSupportLevel, "STANDARD");
        AdaptiveLearningReview review = AdaptiveLearningReview.builder()
                .id(UUID.randomUUID().toString())
                .studentId(studentId)
                .courseId(courseId)
                .classId(classId)
                .triggerType(triggerType == null ? TRIGGER_CYCLE : triggerType)
                .questionCount(questionCount)
                .completedSessionCount(questionCount)
                .sessionIds(evidence.stream()
                        .map(item -> String.valueOf(item.get("conversationId")))
                        .distinct()
                        .toList())
                .status("PENDING")
                .currentSupportLevel(normalizeLevel(currentSupportLevel, "STANDARD"))
                .suggestedSupportLevel(suggested)
                .overallPercent(number(assessment.get("overallPercent"), 0))
                .knowledgePercent(number(assessment.get("knowledgePercent"), 0))
                .practicePercent(number(assessment.get("practicePercent"), 0))
                .independencePercent(number(assessment.get("independencePercent"), 0))
                .confidencePercent(number(assessment.get("confidencePercent"), 0))
                .summary(string(assessment.get("summary"), "Chưa có tóm tắt đánh giá."))
                .strengths(strings(assessment.get("strengths")))
                .knowledgeGaps(strings(assessment.get("knowledgeGaps")))
                .teachingRecommendations(List.of())
                .strategyRecommendations(List.of())
                .learnsBestWith(strings(assessment.get("learnsBestWith")))
                .struggleSignals(strings(assessment.get("struggleSignals")))
                .evidence(evidence)
                .evaluationError(failure)
                .createdAt(now)
                .updatedAt(now)
                .build();
        applyParsedRecommendations(review, assessment);
        AdaptiveLearningReview saved = reviewRepository.save(review);
        log.info("Adaptive learning review created: student={}, course={}, questionCount={}, "
                        + "suggestedLevel={}, confidence={}%",
                studentId, courseId, questionCount, saved.getSuggestedSupportLevel(),
                saved.getConfidencePercent());
        scoreBehaviorsUsedSincePreviousReview(saved, previousReview, facts);
        applySupportLevelAutomatically(saved);
        publishReviewCreated(saved);
        if (failure != null) {
            // AdaptiveReviewRepairScheduler retries PENDING+evaluationError reviews automatically.
            log.info("Adaptive review {} saved incomplete; background repair will retry the assessment",
                    saved.getId());
        }
    }

    /**
     * Re-run the LLM assessment for a PENDING review that failed JSON parsing
     * (or any evaluationError). Updates the same review document in place.
     */
    public AdaptiveLearningReview retryEvaluation(String reviewId) {
        AdaptiveLearningReview review = get(reviewId);
        if (!"PENDING".equalsIgnoreCase(review.getStatus())) {
            throw new IllegalStateException("Chỉ chạy lại được đánh giá đang chờ nhận xét");
        }
        List<Map<String, Object>> evidence = review.getEvidence() == null ? List.of() : review.getEvidence();
        EvidenceFacts facts = evidenceFacts(evidence);
        AssessmentParse parsed = parseAssessment(
                review.getCourseId(), review.getCurrentSupportLevel(), facts, evidence);
        Map<String, Object> assessment = parsed.assessment();
        if (parsed.failure() == null) {
            assessment.put("confidencePercent", facts.confidencePercent());
        }
        assessment.put("overallPercent", Math.round(
                (number(assessment.get("knowledgePercent"), 0)
                        + number(assessment.get("practicePercent"), 0)
                        + number(assessment.get("independencePercent"), 0)) / 3.0f));
        AdaptiveLearningReview previousReview = reviewRepository
                .findByStudentIdAndCourseIdOrderByCreatedAtDesc(review.getStudentId(), review.getCourseId())
                .stream()
                .filter(item -> !Objects.equals(item.getId(), review.getId()))
                .findFirst()
                .orElse(null);
        String suggested = parsed.failure() == null
                ? decideTargetLevel(assessment, review.getCurrentSupportLevel(), previousReview, facts)
                : normalizeLevel(review.getCurrentSupportLevel(), "STANDARD");

        review.setSuggestedSupportLevel(suggested);
        review.setOverallPercent(number(assessment.get("overallPercent"), 0));
        review.setKnowledgePercent(number(assessment.get("knowledgePercent"), 0));
        review.setPracticePercent(number(assessment.get("practicePercent"), 0));
        review.setIndependencePercent(number(assessment.get("independencePercent"), 0));
        review.setConfidencePercent(number(assessment.get("confidencePercent"), 0));
        review.setSummary(string(assessment.get("summary"), "Chưa có tóm tắt đánh giá."));
        review.setStrengths(strings(assessment.get("strengths")));
        review.setKnowledgeGaps(strings(assessment.get("knowledgeGaps")));
        applyParsedRecommendations(review, assessment);
        review.setLearnsBestWith(strings(assessment.get("learnsBestWith")));
        review.setStruggleSignals(strings(assessment.get("struggleSignals")));
        review.setEvaluationError(parsed.failure());
        review.setUpdatedAt(LocalDateTime.now());
        AdaptiveLearningReview saved = reviewRepository.save(review);
        if (parsed.failure() == null) {
            applySupportLevelAutomatically(saved);
        }
        attachStudentIdentity(saved);
        return saved;
    }

    private record AssessmentParse(Map<String, Object> assessment, String failure) {}

    private AssessmentParse parseAssessment(
            String courseId, String currentSupportLevel, EvidenceFacts facts, List<Map<String, Object>> evidence) {
        String prompt = AdaptiveReviewPrompts.assessmentPrompt(courseId, currentSupportLevel, facts, evidence);
        Exception lastError = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                String attemptPrompt = attempt == 1 ? prompt : prompt + """

                        CRITICAL RETRY #%d: Your previous reply was not usable.
                        Return ONLY one raw JSON object. No markdown fences, no <think> tags,
                        no commentary, no text before or after the JSON.
                        """.formatted(attempt);
                return new AssessmentParse(parseAssessmentRaw(chatService.generateUtility(attemptPrompt)), null);
            } catch (Exception error) {
                lastError = error;
                log.warn("Adaptive review JSON parse failed on attempt {}/3: {}", attempt, safeMessage(error));
                if (attempt < 3) {
                    try {
                        Thread.sleep(1_500L * attempt);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
        log.warn("Adaptive review JSON parse exhausted retries: {}", safeMessage(lastError));
        return new AssessmentParse(
                fallbackAssessment(currentSupportLevel),
                "Đánh giá tự động đang được hệ thống chạy lại. Giảng viên chỉ cần đọc kết quả khi sẵn sàng.");
    }

    private Map<String, Object> parseAssessmentRaw(String raw) throws Exception {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Empty LLM response");
        }
        String json = extractJson(raw);
        Map<String, Object> assessment = objectMapper.readValue(json, new TypeReference<>() {});
        validateAssessment(assessment);
        return assessment;
    }

    /**
     * Learning loop: behaviors the tutor applied since the previous review
     * count as successful when understanding rose or mistakes fell.
     */
    private void scoreBehaviorsUsedSincePreviousReview(
            AdaptiveLearningReview review, AdaptiveLearningReview previousReview, EvidenceFacts facts) {
        try {
            List<String> used = profileService.takeUsedBehaviorIds(review.getStudentId(), review.getCourseId());
            if (used.isEmpty() || previousReview == null) return;
            if (review.getEvaluationError() != null && !review.getEvaluationError().isBlank()) return;
            boolean success = behaviorOutcomeSucceeded(review, previousReview, facts);
            behaviorService.recordOutcome(used, success);
        } catch (Exception error) {
            log.warn("Could not score teaching behaviors for review {}: {}", review.getId(), error.getMessage());
        }
    }

    static boolean behaviorOutcomeSucceeded(
            AdaptiveLearningReview review, AdaptiveLearningReview previousReview, EvidenceFacts facts) {
        int knowledgeNow = percentOrZero(review.getKnowledgePercent());
        int knowledgeBefore = percentOrZero(previousReview.getKnowledgePercent());
        int wrongBefore = evidenceFacts(previousReview.getEvidence()).wrong();
        return knowledgeNow > knowledgeBefore || facts.wrong() < wrongBefore;
    }

    /**
     * After assessment, store pending recommendations for the teacher and refresh
     * the learning-profile hypotheses. Does <strong>not</strong> confirm AI
     * directives or activate teaching strategies in chat — teacher approval is required.
     */
    private void applySupportLevelAutomatically(AdaptiveLearningReview review) {
        if (review.getEvaluationError() != null && !review.getEvaluationError().isBlank()) return;
        applyStrategiesAutomatically(review);
        String suggested = normalizeLevel(review.getSuggestedSupportLevel(), "STANDARD");
        String current = normalizeLevel(review.getCurrentSupportLevel(), "STANDARD");
        if (!suggested.equals(current)) {
            log.info("Support level suggestion {}→{} for student {} in course {} awaits teacher approval",
                    current, suggested, review.getStudentId(), review.getCourseId());
        }
    }

    /**
     * Creates AI_PENDING behaviors for teacher review and merges soft profile signals.
     * Pending behaviors are not retrieved into tutor prompts until APPROVED.
     */
    private void applyStrategiesAutomatically(AdaptiveLearningReview review) {
        try {
            profileService.mergeFromReview(review);
        } catch (Exception error) {
            log.warn("Could not update teaching profile from review {}: {}", review.getId(), error.getMessage());
        }
        try {
            behaviorService.createPendingFromReview(review);
        } catch (Exception error) {
            log.warn("Could not store pending teaching strategies for review {}: {}", review.getId(), error.getMessage());
        }
    }

    private void applyParsedRecommendations(AdaptiveLearningReview review, Map<String, Object> assessment) {
        List<TeachingStrategyRecommendation> structured =
                TeachingStrategyRecommendationParser.parse(assessment.get("strategyRecommendations"));
        if (structured.isEmpty()) {
            structured = TeachingStrategyRecommendationParser.fromLegacyTexts(
                    strings(assessment.get("teachingRecommendations")));
        }
        review.setStrategyRecommendations(structured);
        List<String> legacy = TeachingStrategyRecommendationParser.legacyDisplayTexts(structured);
        if (legacy.isEmpty()) {
            legacy = strings(assessment.get("teachingRecommendations"));
        }
        review.setTeachingRecommendations(legacy);
    }

    /** Pushes the new effective support level to the student's open pages. */
    private void publishSupportLevelChanged(AdaptiveLearningReview review, String effectiveLevel) {
        if (review.getStudentId() == null || review.getStudentId().isBlank()) return;
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("studentId", review.getStudentId());
            data.put("courseId", review.getCourseId() == null ? "" : review.getCourseId());
            data.put("classId", review.getClassId() == null ? "" : review.getClassId());
            data.put("supportLevel", effectiveLevel);
            data.put("previousLevel", review.getCurrentSupportLevel() == null
                    ? "" : review.getCurrentSupportLevel());
            data.put("reviewId", review.getId());
            realtimeEvents.publishToUser(review.getStudentId(), "SUPPORT_LEVEL_CHANGED",
                    "PEDAGOGICAL_DIRECTIVE",
                    review.getAppliedDirectiveId() == null ? review.getId() : review.getAppliedDirectiveId(),
                    effectiveLevel, data);
        } catch (Exception error) {
            log.warn("Could not publish SUPPORT_LEVEL_CHANGED for review {}: {}",
                    review.getId(), error.getMessage());
        }
    }

    /** Archives the AI auto-applied directive once a teacher decides on the review. */
    private void archiveAutoAppliedDirective(AdaptiveLearningReview review) {
        if (review.getAppliedDirectiveId() == null || review.getAppliedDirectiveId().isBlank()) return;
        try {
            directiveService.archiveIfPresent(review.getAppliedDirectiveId());
        } catch (Exception error) {
            log.warn("Could not archive auto-applied directive {}: {}",
                    review.getAppliedDirectiveId(), error.getMessage());
        }
    }

    private void publishReviewCreated(AdaptiveLearningReview review) {
        if (review.getClassId() == null || review.getClassId().isBlank()) return;
        classSectionRepository.findByCourseIdAndClassId(review.getCourseId(), review.getClassId())
                .map(section -> section.getTeacherId())
                .filter(teacherId -> teacherId != null && !teacherId.isBlank())
                .ifPresent(teacherId -> realtimeEvents.publishToUser(
                        teacherId,
                        "ADAPTIVE_LEARNING_REVIEW_CREATED",
                        "ADAPTIVE_LEARNING_REVIEW",
                        review.getId(),
                        review.getStatus(),
                        Map.of(
                                "reviewId", review.getId(),
                                "courseId", review.getCourseId(),
                                "classId", review.getClassId(),
                                "studentId", review.getStudentId(),
                                "overallPercent", review.getOverallPercent(),
                                "status", review.getStatus()
                        )));
    }

    public Optional<String> adaptiveSupportLevel(String studentId, String courseId, String classId) {
        return reviewRepository.findByStudentIdAndCourseIdAndClassIdOrderByCreatedAtDesc(studentId, courseId, classId)
                .stream()
                .filter(review -> review.getEvaluationError() == null || review.getEvaluationError().isBlank())
                .filter(review -> review.getConfidencePercent() != null && review.getConfidencePercent() >= 75)
                .filter(review -> Set.of("PENDING", "APPROVED").contains(
                        review.getStatus() == null ? "" : review.getStatus().toUpperCase(Locale.ROOT)))
                .map(review -> normalizeLevel(review.getSuggestedSupportLevel(), "STANDARD"))
                .findFirst();
    }

    public List<AdaptiveLearningReview> listForTeacher(String courseId, String classId) {
        String safeCourse = requireText(courseId, "courseId");
        String safeClass = requireText(classId, "classId");
        List<AdaptiveLearningReview> reviews = reviewRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(safeCourse, safeClass);
        reviews.forEach(this::attachStudentIdentity);
        return reviews;
    }

    /**
     * Every enrolled student of the class with their latest AI label. Students
     * without any review are included with {@code labeled=false} and zeroed
     * percentages, plus their progress toward the next 10-question cycle.
     */
    public List<AdaptiveStudentLabelOverview> listStudentLabels(String courseId, String classId) {
        String safeCourse = requireText(courseId, "courseId");
        String safeClass = requireText(classId, "classId");

        Map<String, AdaptiveLearningReview> latestReviewByStudent = new LinkedHashMap<>();
        for (AdaptiveLearningReview review
                : reviewRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(safeCourse, safeClass)) {
            latestReviewByStudent.putIfAbsent(review.getStudentId(), review);
        }

        Map<String, CourseEnrollment> enrollmentByStudent = new LinkedHashMap<>();
        for (CourseEnrollment enrollment
                : enrollmentRepository.findByCourseIdAndClassId(safeCourse, safeClass)) {
            if (enrollment.getStudentId() != null && !enrollment.getStudentId().isBlank()) {
                enrollmentByStudent.putIfAbsent(enrollment.getStudentId(), enrollment);
            }
        }
        // Students with a review but no enrollment row should still be visible.
        for (String studentId : latestReviewByStudent.keySet()) {
            enrollmentByStudent.putIfAbsent(studentId, null);
        }

        List<AdaptiveStudentLabelOverview> result = new ArrayList<>();
        for (Map.Entry<String, CourseEnrollment> entry : enrollmentByStudent.entrySet()) {
            String studentId = entry.getKey();
            CourseEnrollment enrollment = entry.getValue();
            AdaptiveLearningReview latest = latestReviewByStudent.get(studentId);

            List<String> conversationIds = conversationRepository
                    .findByUserIdAndCourseId(studentId, safeCourse)
                    .stream()
                    .map(AiConversation::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            long totalQuestions = conversationIds.isEmpty()
                    ? 0
                    : messageRepository.countByConversationIdInAndRole(conversationIds, "STUDENT");

            String studentName = enrollment == null ? null : enrollment.getStudentName();
            String studentCode = enrollment == null ? null : enrollment.getStudentCode();
            String studentEmail = enrollment == null ? null : enrollment.getStudentEmail();
            if (studentName == null || studentName.isBlank()) {
                var identity = classRosterService.resolveStudent(studentId, safeCourse, safeClass);
                if (identity != null) {
                    studentName = identity.getStudentName();
                    studentCode = identity.getStudentCode();
                    studentEmail = identity.getStudentEmail();
                }
            }

            result.add(AdaptiveStudentLabelOverview.builder()
                    .studentId(studentId)
                    .studentName(studentName)
                    .studentCode(studentCode)
                    .studentEmail(studentEmail)
                    .courseId(safeCourse)
                    .classId(safeClass)
                    .totalQuestions(totalQuestions)
                    .questionsInCurrentCycle((int) (totalQuestions % CYCLE_SIZE))
                    .cycleSize(CYCLE_SIZE)
                    .labeled(latest != null)
                    .latestReviewId(latest == null ? null : latest.getId())
                    .reviewStatus(latest == null ? null : latest.getStatus())
                    .currentSupportLevel(latest == null
                            ? directiveService.resolveSupportLevel(studentId, safeCourse, safeClass)
                            : latest.getCurrentSupportLevel())
                    .suggestedSupportLevel(latest == null ? null : latest.getSuggestedSupportLevel())
                    .overallPercent(latest == null ? 0 : percentOrZero(latest.getOverallPercent()))
                    .knowledgePercent(latest == null ? 0 : percentOrZero(latest.getKnowledgePercent()))
                    .practicePercent(latest == null ? 0 : percentOrZero(latest.getPracticePercent()))
                    .independencePercent(latest == null ? 0 : percentOrZero(latest.getIndependencePercent()))
                    .confidencePercent(latest == null ? 0 : percentOrZero(latest.getConfidencePercent()))
                    .reviewQuestionCount(latest == null ? null
                            : (latest.getQuestionCount() != null
                                    ? latest.getQuestionCount()
                                    : latest.getCompletedSessionCount()))
                    .summary(latest == null ? null : latest.getSummary())
                    .reviewCreatedAt(latest == null ? null : latest.getCreatedAt())
                    .build());
        }
        // Students needing attention first: pending labels, then unlabeled
        // closest to the next cycle, then everyone else by name.
        result.sort(Comparator
                .comparingInt((AdaptiveStudentLabelOverview item) ->
                        "PENDING".equalsIgnoreCase(item.getReviewStatus() == null ? "" : item.getReviewStatus()) ? 0
                                : !item.isLabeled() ? 1 : 2)
                .thenComparing(item -> item.getStudentName() == null ? "" : item.getStudentName(),
                        String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    /**
     * Whole-history overview for one student in one course, generated on
     * demand for the teacher: deterministic chat/quiz statistics over every
     * conversation in the course (correct, wrong and skipped quizzes kept
     * separate), the support-level change history, and an AI narrative that
     * reads the full history. The narrative never changes the support level
     * by itself — level moves only happen in the cycle reviews (or the early
     * reviews), which can move one step in either direction.
     */
    public StudentCourseLearningSummary summarizeStudentCourse(String studentId, String courseId, String classId) {
        String safeStudentId = requireText(studentId, "studentId");
        String safeCourseId = requireText(courseId, "courseId");
        String safeClassId = (classId == null || classId.isBlank()) ? null : classId.trim();

        List<AiConversation> conversations =
                conversationRepository.findByUserIdAndCourseId(safeStudentId, safeCourseId);
        List<String> conversationIds = conversations.stream()
                .map(AiConversation::getId)
                .filter(id -> id != null && !id.isBlank())
                .toList();
        List<AiMessage> messages = conversationIds.isEmpty()
                ? List.of() : sortedCourseMessages(conversationIds);

        CourseLearningHistory history = CourseLearningHistory.of(messages);
        List<AdaptiveLearningReview> reviews = reviewRepository
                .findByStudentIdAndCourseIdOrderByCreatedAtDesc(safeStudentId, safeCourseId)
                .stream()
                .filter(review -> safeClassId == null || safeClassId.equals(review.getClassId()))
                .toList();
        String currentLevel = directiveService.resolveSupportLevel(safeStudentId, safeCourseId, safeClassId);
        String prompt = AdaptiveReviewPrompts.courseSummaryPrompt(safeCourseId, history, currentLevel);

        String aiSummary;
        List<String> strengths = List.of();
        List<String> knowledgeGaps = List.of();
        List<String> recommendations = List.of();
        boolean modelGenerated = true;
        try {
            String raw = chatService.generateUtility(prompt);
            Map<String, Object> parsed = objectMapper.readValue(extractJson(raw), new TypeReference<>() {});
            String summary = string(parsed.get("summary"), "").trim();
            String trajectory = string(parsed.get("trajectory"), "").trim();
            aiSummary = trajectory.isBlank() ? summary
                    : (summary.isBlank() ? trajectory : summary + " " + trajectory);
            if (aiSummary.isBlank()) throw new IllegalArgumentException("Empty summary");
            strengths = strings(parsed.get("strengths"));
            knowledgeGaps = strings(parsed.get("knowledgeGaps"));
            recommendations = strings(parsed.get("teachingRecommendations"));
        } catch (Exception error) {
            modelGenerated = false;
            aiSummary = AdaptiveReviewPrompts.fallbackCourseSummary(safeCourseId, history, currentLevel);
            log.warn("Course learning summary fallback for student {} in {}: {}",
                    safeStudentId, safeCourseId, safeMessage(error));
        }

        return StudentCourseLearningSummary.builder()
                .studentId(safeStudentId)
                .courseId(safeCourseId)
                .classId(safeClassId)
                .totalQuestions(history.totalQuestions())
                .totalConversations(conversations.size())
                .questionsInCurrentCycle((int) (history.totalQuestions() % CYCLE_SIZE))
                .cycleSize(CYCLE_SIZE)
                .quizGiven(history.quizGiven())
                .quizAnswered(history.quizAnswered())
                .quizCorrect(history.quizCorrect())
                .quizWrong(history.quizWrong())
                .quizSkipped(history.quizSkipped())
                .quizCorrectPercent(history.correctPercent())
                .difficultConcepts(history.difficultConcepts())
                .recentQuestions(history.recentQuestions())
                .currentSupportLevel(currentLevel)
                .levelHistory(CourseLearningHistory.levelHistory(reviews))
                .aiSummary(aiSummary)
                .strengths(strengths)
                .knowledgeGaps(knowledgeGaps)
                .teachingRecommendations(recommendations)
                .modelGenerated(modelGenerated)
                .generatedAt(LocalDateTime.now())
                .build();
    }

    public AdaptiveLearningReview get(String reviewId) {
        AdaptiveLearningReview review = reviewRepository.findById(requireText(reviewId, "reviewId"))
                .orElseThrow(() -> new IllegalArgumentException("Adaptive learning review not found"));
        attachStudentIdentity(review);
        return review;
    }

    public AdaptiveLearningReview decide(
            String reviewId, String teacherId, AdaptiveLearningReviewDecisionRequest request) {
        return decide(reviewId, teacherId, "TEACHER", request);
    }

    public AdaptiveLearningReview decide(
            String reviewId, String teacherId, String teacherRole, AdaptiveLearningReviewDecisionRequest request) {
        if (request == null) throw new IllegalArgumentException("Request body is required");
        AdaptiveLearningReview review = get(reviewId);
        if (!"PENDING".equalsIgnoreCase(review.getStatus())) {
            throw new IllegalStateException("This review has already been processed");
        }
        String decision = requireText(request.getDecision(), "decision").toUpperCase(Locale.ROOT);
        if (!DECISIONS.contains(decision)) throw new IllegalArgumentException("Unsupported decision");
        String feedback = request.getTeacherFeedback() == null ? "" : request.getTeacherFeedback().trim();
        if (feedback.length() > 5000) throw new IllegalArgumentException("Teacher feedback exceeds 5000 characters");

        review.setTeacherId(requireText(teacherId, "teacherId"));
        review.setTeacherFeedback(feedback);
        review.setTeacherDecision(decision);
        review.setReviewedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());

        if ("REJECT".equals(decision)) {
            // Rejecting reverts everything the AI applied: the level and its strategies,
            // so the student falls back to the default way of teaching.
            archiveAutoAppliedDirective(review);
            behaviorService.rejectReviewBehaviors(review.getId());
            review.setTeacherSelectedStrategies(List.of());
            review.setStatus("REJECTED");
            AdaptiveLearningReview rejected = reviewRepository.save(review);
            publishSupportLevelChanged(rejected, directiveService.resolveSupportLevel(
                    rejected.getStudentId(), rejected.getCourseId(), rejected.getClassId()));
            return rejected;
        }
        StrategyChoice choice = validateStrategyChoice(review, request);
        // A teacher decision replaces the AI auto-applied directive.
        archiveAutoAppliedDirective(review);

        String selectedLevel = "MODIFY".equals(decision)
                ? normalizeLevel(request.getSupportLevel(), review.getSuggestedSupportLevel())
                : review.getSuggestedSupportLevel();
        String instruction = teacherInstruction(review, feedback);
        PedagogicalDirectiveRequest directiveRequest = new PedagogicalDirectiveRequest();
        directiveRequest.setStudentId(review.getStudentId());
        directiveRequest.setCourseId(review.getCourseId());
        directiveRequest.setClassId(review.getClassId());
        directiveRequest.setTopic(String.join(", ", safeList(review.getKnowledgeGaps())));
        directiveRequest.setInstruction(instruction);
        directiveRequest.setSupportLevel(selectedLevel);
        directiveRequest.setPriority(85);
        PedagogicalDirective draft = directiveService.createDraft(directiveRequest, teacherId, teacherId);
        PedagogicalDirective confirmed = directiveService.confirm(draft.getId(), teacherId);
        review.setAppliedDirectiveId(confirmed.getId());
        review.setSuggestedSupportLevel(selectedLevel);
        review.setTeacherSelectedStrategies(choice.selected());
        review.setTeacherCustomStrategy(choice.custom());
        review.setStatus("APPROVED");
        AdaptiveLearningReview approved = reviewRepository.save(review);
        applyTeacherStrategies(approved, choice, new BehaviorActor(teacherId, teacherId, teacherRole));
        publishSupportLevelChanged(approved, selectedLevel);
        return approved;
    }

    private record StrategyChoice(List<String> selected, String custom, String shareScope, String shareDomain) {}

    /** Validates the checkbox choice before anything is changed. Accepts strategy codes or legacy texts. */
    private StrategyChoice validateStrategyChoice(
            AdaptiveLearningReview review, AdaptiveLearningReviewDecisionRequest request) {
        List<String> recommendations = safeList(review.getTeachingRecommendations());
        Set<String> allowed = new HashSet<>();
        recommendations.forEach(item -> allowed.add(item.trim()));
        if (review.getStrategyRecommendations() != null) {
            for (TeachingStrategyRecommendation item : review.getStrategyRecommendations()) {
                if (item.getStrategyCode() != null) allowed.add(item.getStrategyCode());
                String display = TeachingStrategyRecommendationParser.legacyDisplayTexts(List.of(item))
                        .stream().findFirst().orElse(null);
                if (display != null) allowed.add(display);
            }
        }
        List<String> selected;
        if (request.getSelectedStrategies() == null) {
            selected = review.getStrategyRecommendations() != null && !review.getStrategyRecommendations().isEmpty()
                    ? review.getStrategyRecommendations().stream()
                    .map(TeachingStrategyRecommendation::getStrategyCode)
                    .filter(Objects::nonNull)
                    .toList()
                    : new ArrayList<>(recommendations);
        } else {
            selected = new ArrayList<>();
            for (String item : request.getSelectedStrategies()) {
                String text = item == null ? "" : item.trim();
                if (text.isEmpty() || selected.contains(text)) continue;
                if (!allowed.contains(text)) {
                    throw new IllegalArgumentException("Chiến lược được chọn không thuộc đề xuất của AI");
                }
                selected.add(text);
            }
        }
        String custom = trimToNull(request.getCustomStrategy());
        if (custom != null && custom.length() > TeachingBehaviorService.MAX_INSTRUCTION_LENGTH) {
            throw new IllegalArgumentException("Chiến lược khác tối đa "
                    + TeachingBehaviorService.MAX_INSTRUCTION_LENGTH + " ký tự");
        }
        String shareScope = trimToNull(request.getShareScope());
        String shareDomain = null;
        if (shareScope != null) {
            shareScope = shareScope.toUpperCase(Locale.ROOT);
            if (!Set.of("COURSE", "DOMAIN", "GLOBAL").contains(shareScope)) {
                throw new IllegalArgumentException("Phạm vi chia sẻ không hợp lệ");
            }
            if ("DOMAIN".equals(shareScope)) shareDomain = TeachingBehaviorService.requireDomain(request.getShareDomain());
        }
        return new StrategyChoice(List.copyOf(selected), custom, shareScope, shareDomain);
    }

    /** Checked strategies (+ "Khác") become the student's approved behaviors; optionally shared wider. */
    private void applyTeacherStrategies(AdaptiveLearningReview review, StrategyChoice choice, BehaviorActor actor) {
        try {
            List<TeachingBehavior> approved = behaviorService.approveReviewBehaviors(
                    review, choice.selected(), choice.custom(), actor);
            if (choice.shareScope() != null && !approved.isEmpty()) {
                List<String> names = new ArrayList<>();
                if (review.getStudentName() != null) names.add(review.getStudentName());
                if (review.getStudentCode() != null) names.add(review.getStudentCode());
                behaviorService.shareBehaviors(approved, choice.shareScope(), choice.shareDomain(),
                        review.getCourseId(), names, actor);
            }
        } catch (Exception error) {
            log.warn("Could not store teacher-selected strategies for review {}: {}",
                    review.getId(), error.getMessage());
        }
    }

    private void attachStudentIdentity(AdaptiveLearningReview review) {
        if (review == null || review.getStudentId() == null) return;
        var identity = classRosterService.resolveStudent(
                review.getStudentId(), review.getCourseId(), review.getClassId());
        if (identity == null) return;
        review.setStudentName(identity.getStudentName());
        review.setStudentCode(identity.getStudentCode());
        review.setStudentEmail(identity.getStudentEmail());
    }
}
