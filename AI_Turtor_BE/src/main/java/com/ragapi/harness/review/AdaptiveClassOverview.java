package com.ragapi.harness.review;

import static com.ragapi.harness.adaptive.AdaptiveCycleWindows.chronologicalChat;
import static com.ragapi.harness.adaptive.AdaptiveDirectiveTexts.percentOrZero;
import static com.ragapi.harness.adaptive.AdaptiveReviewPolicy.CYCLE_SIZE;
import static com.ragapi.harness.adaptive.AdaptiveReviewValues.extractJson;
import static com.ragapi.harness.adaptive.AdaptiveReviewValues.safeMessage;
import static com.ragapi.harness.adaptive.AdaptiveReviewValues.string;
import static com.ragapi.harness.adaptive.AdaptiveReviewValues.strings;
import static com.ragapi.util.ValidationUtils.requireText;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AdaptiveStudentLabelOverview;
import com.ragapi.dto.StudentCourseLearningSummary;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.harness.adaptive.AdaptiveReviewPrompts;
import com.ragapi.harness.adaptive.CourseLearningHistory;
import com.ragapi.harness.directive.PedagogicalDirectiveService;
import com.ragapi.harness.entity.AdaptiveLearningReview;
import com.ragapi.harness.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.service.course.ClassRosterService;
import com.ragapi.service.llm.OpenRouterChatService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Teacher views of class labels and one student's course history. */
@Slf4j
@RequiredArgsConstructor
class AdaptiveClassOverview {

    private final AdaptiveLearningReviewRepository reviewRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassRosterService classRosterService;
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final OpenRouterChatService chatService;
    private final ObjectMapper objectMapper;
    private final PedagogicalDirectiveService directiveService;

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
                ? List.of() : chronologicalChat(messageRepository.findByConversationIdInOrderByCreatedAtAsc(conversationIds));

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

}
