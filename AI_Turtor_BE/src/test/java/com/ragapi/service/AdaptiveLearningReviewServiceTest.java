package com.ragapi.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AdaptiveLearningReviewDecisionRequest;
import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.dto.UnderstandingCheckPayload;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.ClassSectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdaptiveLearningReviewServiceTest {

    @Mock AdaptiveLearningReviewRepository reviewRepository;
    @Mock com.ragapi.repository.CourseEnrollmentRepository enrollmentRepository;
    @Mock ClassSectionRepository classSectionRepository;
    @Mock ClassRosterService classRosterService;
    @Mock RealtimeEventService realtimeEvents;
    @Mock AiConversationRepository conversationRepository;
    @Mock AiMessageRepository messageRepository;
    @Mock OpenRouterChatService chatService;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Mock PedagogicalDirectiveService directiveService;

    @InjectMocks AdaptiveLearningReviewService service;

    private static final String STUDENT = "student-1";
    private static final String COURSE = "PRO192";
    private static final String OTHER_COURSE = "DBI202";
    private static final String CLASS = "SE1833";

    private static final String SUBSTANTIVE_ANSWER =
            "Em đã tự viết ví dụ về đóng gói trong Java, tạo lớp Student với thuộc tính private, "
            + "viết getter và setter, sau đó tự giải thích vì sao đoạn mã chạy đúng và thử thay đổi "
            + "dữ liệu đầu vào để kiểm tra kết quả in ra màn hình có đúng như em dự đoán hay không.";

    private List<AiConversation> conversations(String courseId, int count) {
        List<AiConversation> result = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            AiConversation conversation = new AiConversation();
            conversation.setId(courseId.toLowerCase() + "-conv-" + i);
            conversation.setUserId(STUDENT);
            conversation.setCourseId(courseId);
            conversation.setClassId(CLASS);
            conversation.setUpdatedAt(LocalDateTime.of(2026, 10, i, 9, 0));
            result.add(conversation);
        }
        return result;
    }

    private AiMessage message(String id, String conversationId, String role, String content, LocalDateTime at) {
        AiMessage message = new AiMessage();
        message.setId(id);
        message.setConversationId(conversationId);
        message.setUserId(STUDENT);
        message.setRole(role);
        message.setContent(content);
        message.setCreatedAt(at);
        return message;
    }

    /** Interleaved student questions and AI answers spread across two conversations of the course. */
    private List<AiMessage> cycleMessages(int questions, String studentContent) {
        List<AiMessage> messages = new ArrayList<>();
        LocalDateTime base = LocalDateTime.of(2026, 10, 2, 9, 0);
        for (int i = 0; i < questions; i++) {
            String conversationId = COURSE.toLowerCase() + "-conv-" + (i % 2 + 1);
            messages.add(message("stu-" + i, conversationId, "STUDENT", studentContent, base.plusMinutes(i * 2L)));
            messages.add(message("ai-" + i, conversationId, "ASSISTANT", "Giải thích của AI Tutor", base.plusMinutes(i * 2L + 1)));
        }
        return messages;
    }

    private void stubCourseConversations(String courseId, List<AiConversation> conversations) {
        when(conversationRepository.findByUserIdAndCourseId(STUDENT, courseId)).thenReturn(conversations);
    }

    private void stubQuestionCycle(long totalQuestions, List<AiMessage> cycleMessages) {
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT")))
                .thenReturn(totalQuestions);
        if (cycleMessages != null) {
            when(messageRepository.findByConversationIdInOrderByCreatedAtAsc(anyList()))
                    .thenReturn(cycleMessages);
        }
        when(directiveService.resolveSupportLevel(STUDENT, COURSE, CLASS)).thenReturn("STANDARD");
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private static String assessmentJson(int overall, int knowledge, int practice, int independence, String level) {
        // New prompt contract: exactly 9 keys, no overallPercent (backend derives it).
        return """
                {"knowledgePercent":%d,"practicePercent":%d,
                 "independencePercent":%d,"confidencePercent":10,
                 "summary":"Đánh giá từ bằng chứng hội thoại.",
                 "strengths":["Tự làm được ví dụ"],"knowledgeGaps":["Đa hình"],
                 "teachingRecommendations":["Tăng bài tập tự làm"],
                 "suggestedSupportLevel":"%s"}
                """.formatted(knowledge, practice, independence, level);
    }

    @Test
    void doesNotCreateReviewBeforeTenthQuestionInTheCourse() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT"))).thenReturn(9L);

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        verify(reviewRepository, never()).save(any());
        verify(chatService, never()).generateUtility(anyString());
    }

    @Test
    void createsPendingReviewAtTenthQuestionInCourseAndNotifiesTeacher() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        stubQuestionCycle(10, cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(90, 88, 85, 92, "CHALLENGE"));
        ClassSection section = new ClassSection();
        section.setCourseId(COURSE);
        section.setClassId(CLASS);
        section.setTeacherId("teacher-1");
        when(classSectionRepository.findByCourseIdAndClassId(COURSE, CLASS))
                .thenReturn(Optional.of(section));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository).save(captor.capture());
        AdaptiveLearningReview review = captor.getValue();
        assertThat(review.getStatus()).isEqualTo("PENDING");
        assertThat(review.getCourseId()).isEqualTo(COURSE);
        assertThat(review.getQuestionCount()).isEqualTo(10);
        assertThat(review.getSessionIds()).containsExactlyInAnyOrder(
                COURSE.toLowerCase() + "-conv-1", COURSE.toLowerCase() + "-conv-2");
        // Evidence completeness is computed by the backend from the student's
        // own messages (10 substantive questions), not the LLM's self-reported 10.
        assertThat(review.getConfidencePercent()).isGreaterThanOrEqualTo(90);
        assertThat(review.getSuggestedSupportLevel()).isEqualTo("CHALLENGE");
        // overallPercent is derived by the backend: (90 + 88 + 85) / 3 rounded.
        assertThat(review.getOverallPercent()).isEqualTo(88);
        assertThat(review.getEvidence()).isNotEmpty();
        verify(realtimeEvents).publishToUser(eq("teacher-1"), eq("ADAPTIVE_LEARNING_REVIEW_CREATED"),
                anyString(), anyString(), anyString(), any());
    }

    @Test
    void autoAppliesSuggestedLevelImmediatelyWhenItChanges() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        stubQuestionCycle(10, cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(90, 88, 85, 92, "CHALLENGE"));
        PedagogicalDirective directive = new PedagogicalDirective();
        directive.setId("dir-auto");
        when(directiveService.createDraft(any(PedagogicalDirectiveRequest.class), eq("AI_TUTOR"), anyString()))
                .thenReturn(directive);
        when(directiveService.confirm("dir-auto", "AI_TUTOR")).thenReturn(directive);

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        AdaptiveLearningReview applied = captor.getAllValues().get(1);
        assertThat(applied.getAppliedDirectiveId()).isEqualTo("dir-auto");
        ArgumentCaptor<PedagogicalDirectiveRequest> requestCaptor =
                ArgumentCaptor.forClass(PedagogicalDirectiveRequest.class);
        verify(directiveService).createDraft(requestCaptor.capture(), eq("AI_TUTOR"), anyString());
        assertThat(requestCaptor.getValue().getSupportLevel()).isEqualTo("CHALLENGE");
        assertThat(requestCaptor.getValue().getStudentId()).isEqualTo(STUDENT);
        verify(directiveService).confirm("dir-auto", "AI_TUTOR");
        // The student is notified in real time about the new level.
        verify(realtimeEvents).publishToUser(eq(STUDENT), eq("SUPPORT_LEVEL_CHANGED"),
                anyString(), anyString(), eq("CHALLENGE"), any());
    }

    @Test
    void autoApplyRunsEvenWhenTeacherDirectiveExists() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        stubQuestionCycle(10, cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(90, 88, 85, 92, "CHALLENGE"));
        PedagogicalDirective directive = new PedagogicalDirective();
        directive.setId("dir-auto");
        when(directiveService.createDraft(any(PedagogicalDirectiveRequest.class), eq("AI_TUTOR"), anyString()))
                .thenReturn(directive);
        when(directiveService.confirm("dir-auto", "AI_TUTOR")).thenReturn(directive);

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        // AI changes the level automatically; previous AI directives are cleaned up first.
        verify(directiveService).archiveAutoAppliedDirectives(STUDENT, COURSE, CLASS);
        verify(directiveService).createDraft(any(PedagogicalDirectiveRequest.class), eq("AI_TUTOR"), anyString());
        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        assertThat(captor.getAllValues().get(1).getAppliedDirectiveId()).isEqualTo("dir-auto");
    }

    @Test
    void evidenceCapturesStudentQuestionsAndWrongQuizAnswers() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        List<AiMessage> messages = cycleMessages(10, SUBSTANTIVE_ANSWER);
        AiMessage quizMessage = messages.get(1);
        quizMessage.setUnderstandingCheck(new UnderstandingCheckPayload(
                "Tính đóng gói trong Java là gì?",
                List.of(new UnderstandingCheckPayload.Option("A", "Che giấu dữ liệu bên trong lớp"),
                        new UnderstandingCheckPayload.Option("B", "Kế thừa nhiều lớp cha")),
                "A",
                "Đóng gói là che giấu dữ liệu và chỉ mở qua phương thức."));
        quizMessage.setUnderstandingSelectedKey("B");
        quizMessage.setUnderstandingCorrect(false);
        stubQuestionCycle(10, messages);
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(40, 35, 30, 30, "HIGH_SUPPORT"));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        var evidence = captor.getValue().getEvidence();
        var wrong = evidence.stream()
                .filter(item -> "STUDENT_ANSWER".equals(item.get("kind")))
                .findFirst().orElseThrow();
        assertThat(wrong.get("quizQuestion")).isEqualTo("Tính đóng gói trong Java là gì?");
        assertThat(wrong.get("selectedKey")).isEqualTo("B");
        assertThat(wrong.get("correctKey")).isEqualTo("A");
        assertThat(wrong.get("correct")).isEqualTo(false);
        // Full AI answers are not student evidence and must not be stored here.
        assertThat(evidence.stream().anyMatch(item -> "AI_ANSWER".equals(item.get("kind")))).isFalse();
        assertThat(evidence.stream().filter(item -> "STUDENT_QUESTION".equals(item.get("kind"))).count())
                .isEqualTo(10);
    }

    @Test
    void rejectDecisionArchivesAutoAppliedDirective() {
        AdaptiveLearningReview review = pendingReview();
        review.setAppliedDirectiveId("dir-auto");
        when(reviewRepository.findById("rev-1")).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AdaptiveLearningReviewDecisionRequest request = new AdaptiveLearningReviewDecisionRequest();
        request.setDecision("REJECT");
        AdaptiveLearningReview decided = service.decide("rev-1", "teacher-1", request);

        assertThat(decided.getStatus()).isEqualTo("REJECTED");
        verify(directiveService).archiveIfPresent("dir-auto");
        verify(directiveService, never()).createDraft(any(), anyString(), anyString());
    }

    private void markQuizWrong(AiMessage message, String question) {
        message.setUnderstandingCheck(new UnderstandingCheckPayload(
                question,
                List.of(new UnderstandingCheckPayload.Option("A", "Đáp án đúng"),
                        new UnderstandingCheckPayload.Option("B", "Đáp án sai")),
                "A", "Giải thích đáp án đúng."));
        message.setUnderstandingSelectedKey("B");
        message.setUnderstandingCorrect(false);
    }

    @Test
    void earlyReviewTriggersOnRepeatedMistakesBeforeCycleEnd() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        List<AiMessage> messages = cycleMessages(13, SUBSTANTIVE_ANSWER);
        // Two wrong answers on the same concept inside the open cycle (questions 11-13).
        markQuizWrong(messages.get(21), "Tính đóng gói trong Java là gì?");
        markQuizWrong(messages.get(23), "Tính đóng gói trong Java là gì?");
        stubQuestionCycle(13, messages);
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(30, 25, 20, 15, "HIGH_SUPPORT"));

        service.onUnderstandingCheckRecorded(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        AdaptiveLearningReview review = captor.getValue();
        assertThat(review.getTriggerType()).isEqualTo(AdaptiveLearningReviewService.TRIGGER_EARLY_REPEATED_MISTAKES);
        assertThat(review.getQuestionCount()).isEqualTo(13);
        var wrongKinds = review.getEvidence().stream()
                .filter(item -> "STUDENT_ANSWER".equals(item.get("kind"))
                        && Boolean.FALSE.equals(item.get("correct"))).count();
        assertThat(wrongKinds).isEqualTo(2);
    }

    @Test
    void earlyRepeatedWrongAnswersForceHighSupportDespiteWeakChatEvidence() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        List<AiMessage> messages = cycleMessages(3, "ok");
        // Three wrong quiz answers in the first three turns of the cycle.
        markQuizWrong(messages.get(1), "Đóng gói trong Java là gì?");
        markQuizWrong(messages.get(3), "Kế thừa trong Java là gì?");
        markQuizWrong(messages.get(5), "Đa hình trong Java là gì?");
        stubQuestionCycle(3, messages);
        // The LLM still suggests keeping STANDARD; the repeated-mistake rule wins.
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(80, 80, 80, 80, "STANDARD"));

        service.onUnderstandingCheckRecorded(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        AdaptiveLearningReview review = captor.getValue();
        assertThat(review.getTriggerType()).isEqualTo(AdaptiveLearningReviewService.TRIGGER_EARLY_REPEATED_MISTAKES);
        assertThat(review.getSuggestedSupportLevel()).isEqualTo("HIGH_SUPPORT");
        assertThat(review.getEvidence().stream()
                .filter(item -> "STUDENT_ANSWER".equals(item.get("kind"))
                        && Boolean.FALSE.equals(item.get("correct"))).count()).isEqualTo(3);
    }

    private com.ragapi.dto.UnderstandingCheckAttempt quizAttempt(
            int index, String question, String selected, Boolean correct) {
        var check = new UnderstandingCheckPayload(
                question,
                List.of(new UnderstandingCheckPayload.Option("A", "Đáp án đúng"),
                        new UnderstandingCheckPayload.Option("B", "Đáp án sai")),
                "A", "Giải thích đáp án đúng.");
        return com.ragapi.dto.UnderstandingCheckAttempt.builder()
                .quizIndex(index)
                .attemptId("att-" + index + "-" + question.hashCode())
                .check(check)
                .selectedKey(selected)
                .correct(correct)
                .answeredAt(selected == null ? null : LocalDateTime.of(2026, 10, 2, 10, 0))
                .build();
    }

    @Test
    void skippedQuizIsRecordedAsSkippedNeverAsWrong() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        List<AiMessage> messages = cycleMessages(10, SUBSTANTIVE_ANSWER);
        messages.get(1).setUnderstandingCheckAttempts(List.of(
                quizAttempt(0, "Đóng gói trong Java là gì?", "A", true),
                quizAttempt(1, "Kế thừa trong Java là gì?", null, null)));
        stubQuestionCycle(10, messages);
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(80, 80, 80, 80, "STANDARD"));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        AdaptiveLearningReview review = captor.getValue();
        var answers = review.getEvidence().stream()
                .filter(item -> "STUDENT_ANSWER".equals(item.get("kind"))).toList();
        assertThat(answers).hasSize(2);
        assertThat(answers.stream().filter(item -> Boolean.TRUE.equals(item.get("skipped")))).hasSize(1);
        assertThat(answers.stream().filter(item -> Boolean.FALSE.equals(item.get("correct")))).isEmpty();
    }

    @Test
    void missedMilestoneIsCaughtUpOnNextQuestion() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        stubQuestionCycle(93, cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(80, 80, 80, 80, "STANDARD"));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        assertThat(captor.getValue().getQuestionCount()).isEqualTo(90);
    }

    @Test
    void courseSummaryCountsCorrectWrongAndSkippedSeparately() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        List<AiMessage> messages = cycleMessages(3, SUBSTANTIVE_ANSWER);
        messages.get(1).setUnderstandingCheckAttempts(List.of(
                quizAttempt(0, "Đóng gói trong Java là gì?", "A", true),
                quizAttempt(1, "Kế thừa trong Java là gì?", null, null)));
        messages.get(3).setUnderstandingCheckAttempts(List.of(
                quizAttempt(0, "Đa hình trong Java là gì?", "B", false)));
        when(messageRepository.findByConversationIdInOrderByCreatedAtAsc(anyList())).thenReturn(messages);
        when(directiveService.resolveSupportLevel(STUDENT, COURSE, CLASS)).thenReturn("STANDARD");
        when(chatService.generateUtility(anyString())).thenReturn("""
                {"summary":"Sinh viên nắm được đóng gói nhưng còn yếu đa hình.",
                 "strengths":["Đóng gói"],"knowledgeGaps":["Đa hình"],
                 "teachingRecommendations":["Ôn lại đa hình"],"trajectory":"Đang tiến bộ."}
                """);

        var summary = service.summarizeStudentCourse(STUDENT, COURSE, CLASS);

        assertThat(summary.getTotalQuestions()).isEqualTo(3);
        assertThat(summary.getQuizGiven()).isEqualTo(3);
        assertThat(summary.getQuizAnswered()).isEqualTo(2);
        assertThat(summary.getQuizCorrect()).isEqualTo(1);
        assertThat(summary.getQuizWrong()).isEqualTo(1);
        assertThat(summary.getQuizSkipped()).isEqualTo(1);
        assertThat(summary.getQuizCorrectPercent()).isEqualTo(50);
        assertThat(summary.isModelGenerated()).isTrue();
        assertThat(summary.getAiSummary()).contains("đóng gói");
    }

    @Test
    void singleWrongAnswerDoesNotTriggerEarlyReview() {
        stubCourseConversations(COURSE, conversations(COURSE, 2));
        List<AiMessage> messages = cycleMessages(13, SUBSTANTIVE_ANSWER);
        markQuizWrong(messages.get(21), "Tính đóng gói trong Java là gì?");
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT"))).thenReturn(13L);
        when(messageRepository.findByConversationIdInOrderByCreatedAtAsc(anyList()))
                .thenReturn(messages);

        service.onUnderstandingCheckRecorded(STUDENT, COURSE, CLASS);

        verify(reviewRepository, never()).save(any());
        verify(chatService, never()).generateUtility(anyString());
    }

    @Test
    void levelChangeIsClampedToOneStepPerReview() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT"))).thenReturn(10L);
        when(messageRepository.findByConversationIdInOrderByCreatedAtAsc(anyList()))
                .thenReturn(cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(directiveService.resolveSupportLevel(STUDENT, COURSE, CLASS)).thenReturn("HIGH_SUPPORT");
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(90, 88, 85, 92, "CHALLENGE"));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        // HIGH_SUPPORT -> CHALLENGE would skip a step; the controller moves one step only.
        assertThat(captor.getValue().getSuggestedSupportLevel()).isEqualTo("STANDARD");
    }

    @Test
    void antiFlappingKeepsLevelWhenPreviousReviewJustChangedIt() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT"))).thenReturn(10L);
        when(messageRepository.findByConversationIdInOrderByCreatedAtAsc(anyList()))
                .thenReturn(cycleMessages(10, "a".repeat(120)));
        when(directiveService.resolveSupportLevel(STUDENT, COURSE, CLASS)).thenReturn("STANDARD");
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        AdaptiveLearningReview previous = pendingReview();
        previous.setAppliedDirectiveId("dir-old");
        when(reviewRepository.findByStudentIdAndCourseIdOrderByCreatedAtDesc(STUDENT, COURSE))
                .thenReturn(List.of(previous));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(90, 88, 85, 92, "CHALLENGE"));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository).save(captor.capture());
        // Backend evidence confidence is ~80 (< 85) right after a level change: keep STANDARD.
        assertThat(captor.getValue().getConfidencePercent()).isLessThan(85);
        assertThat(captor.getValue().getSuggestedSupportLevel()).isEqualTo("STANDARD");
        verify(directiveService, never()).createDraft(any(), anyString(), anyString());
    }

    @Test
    void countsQuestionsPerCourseSeparately() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        stubCourseConversations(OTHER_COURSE, conversations(OTHER_COURSE, 1));
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT")))
                .thenAnswer(invocation -> {
                    List<String> ids = invocation.getArgument(0);
                    return ids.contains(OTHER_COURSE.toLowerCase() + "-conv-1") ? 7L : 10L;
                });
        when(messageRepository.findByConversationIdInOrderByCreatedAtAsc(anyList()))
                .thenReturn(cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // 7 questions in DBI202: below the per-course cycle, no review.
        service.onStudentQuestionAnswered(STUDENT, OTHER_COURSE, CLASS);
        verify(reviewRepository, never()).save(any());

        // The 10th question in PRO192 triggers a review for PRO192 only.
        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);
        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository).save(captor.capture());
        assertThat(captor.getValue().getCourseId()).isEqualTo(COURSE);
        assertThat(captor.getValue().getQuestionCount()).isEqualTo(10);
    }

    @Test
    void doesNotDuplicateReviewForSameQuestionCycle() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT"))).thenReturn(10L);
        when(reviewRepository.findByStudentIdAndCourseIdAndQuestionCount(STUDENT, COURSE, 10))
                .thenReturn(Optional.of(new AdaptiveLearningReview()));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        verify(reviewRepository, never()).save(any());
        verify(chatService, never()).generateUtility(anyString());
    }

    @Test
    void weakEvidenceKeepsCurrentSupportLevelDespiteLlmSuggestion() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        stubQuestionCycle(10, cycleMessages(10, "ok ạ"));
        when(chatService.generateUtility(anyString()))
                .thenReturn(assessmentJson(30, 25, 20, 15, "HIGH_SUPPORT"));

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository).save(captor.capture());
        assertThat(captor.getValue().getConfidencePercent()).isLessThan(75);
        assertThat(captor.getValue().getSuggestedSupportLevel()).isEqualTo("STANDARD");
    }

    @Test
    void llmFailureStillStoresReviewWithEvaluationError() {
        stubCourseConversations(COURSE, conversations(COURSE, 1));
        stubQuestionCycle(10, cycleMessages(10, SUBSTANTIVE_ANSWER));
        when(chatService.generateUtility(anyString())).thenReturn(null);

        service.onStudentQuestionAnswered(STUDENT, COURSE, CLASS);

        ArgumentCaptor<AdaptiveLearningReview> captor = ArgumentCaptor.forClass(AdaptiveLearningReview.class);
        verify(reviewRepository).save(captor.capture());
        AdaptiveLearningReview review = captor.getValue();
        assertThat(review.getStatus()).isEqualTo("PENDING");
        assertThat(review.getEvaluationError()).isNotBlank();
        assertThat(review.getSuggestedSupportLevel()).isEqualTo("STANDARD");
    }

    @Test
    void rosterIncludesUnlabeledStudentsWithZeroPercentAndCycleProgress() {
        com.ragapi.entity.CourseEnrollment first = new com.ragapi.entity.CourseEnrollment();
        first.setStudentId(STUDENT);
        first.setStudentName("Nguyen Van A");
        first.setCourseId(COURSE);
        first.setClassId(CLASS);
        com.ragapi.entity.CourseEnrollment second = new com.ragapi.entity.CourseEnrollment();
        second.setStudentId("student-2");
        second.setStudentName("Tran Thi B");
        second.setCourseId(COURSE);
        second.setClassId(CLASS);
        when(enrollmentRepository.findByCourseIdAndClassId(COURSE, CLASS)).thenReturn(List.of(first, second));

        AdaptiveLearningReview latest = pendingReview();
        latest.setOverallPercent(64);
        when(reviewRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(COURSE, CLASS))
                .thenReturn(List.of(latest));

        AiConversation convA = new AiConversation();
        convA.setId("s1-conv");
        AiConversation convB = new AiConversation();
        convB.setId("s2-conv");
        when(conversationRepository.findByUserIdAndCourseId(STUDENT, COURSE)).thenReturn(List.of(convA));
        when(conversationRepository.findByUserIdAndCourseId("student-2", COURSE)).thenReturn(List.of(convB));
        when(messageRepository.countByConversationIdInAndRole(anyList(), eq("STUDENT")))
                .thenAnswer(invocation -> {
                    List<String> ids = invocation.getArgument(0);
                    return ids.contains("s2-conv") ? 3L : 10L;
                });
        when(directiveService.resolveSupportLevel("student-2", COURSE, CLASS)).thenReturn("STANDARD");

        var roster = service.listStudentLabels(COURSE, CLASS);

        assertThat(roster).hasSize(2);
        var labeled = roster.stream().filter(item -> item.getStudentId().equals(STUDENT)).findFirst().orElseThrow();
        assertThat(labeled.isLabeled()).isTrue();
        assertThat(labeled.getOverallPercent()).isEqualTo(64);
        assertThat(labeled.getTotalQuestions()).isEqualTo(10);
        var unlabeled = roster.stream().filter(item -> item.getStudentId().equals("student-2")).findFirst().orElseThrow();
        assertThat(unlabeled.isLabeled()).isFalse();
        assertThat(unlabeled.getOverallPercent()).isZero();
        assertThat(unlabeled.getTotalQuestions()).isEqualTo(3);
        assertThat(unlabeled.getQuestionsInCurrentCycle()).isEqualTo(3);
        assertThat(unlabeled.getCurrentSupportLevel()).isEqualTo("STANDARD");
        // Pending labels surface first for the teacher.
        assertThat(roster.get(0).getStudentId()).isEqualTo(STUDENT);
    }

    @Test
    void approveDecisionCreatesConfirmedDirective() {
        AdaptiveLearningReview review = pendingReview();
        when(reviewRepository.findById("rev-1")).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        PedagogicalDirective directive = new PedagogicalDirective();
        directive.setId("dir-1");
        when(directiveService.createDraft(any(PedagogicalDirectiveRequest.class), eq("teacher-1"), eq("teacher-1")))
                .thenReturn(directive);
        when(directiveService.confirm("dir-1", "teacher-1")).thenReturn(directive);

        AdaptiveLearningReviewDecisionRequest request = new AdaptiveLearningReviewDecisionRequest();
        request.setDecision("APPROVE");
        request.setTeacherFeedback("Tập trung vào đa hình.");
        AdaptiveLearningReview decided = service.decide("rev-1", "teacher-1", request);

        assertThat(decided.getStatus()).isEqualTo("APPROVED");
        assertThat(decided.getAppliedDirectiveId()).isEqualTo("dir-1");
        verify(directiveService).confirm("dir-1", "teacher-1");
    }

    @Test
    void rejectDecisionCreatesNoDirective() {
        AdaptiveLearningReview review = pendingReview();
        when(reviewRepository.findById("rev-1")).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(AdaptiveLearningReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AdaptiveLearningReviewDecisionRequest request = new AdaptiveLearningReviewDecisionRequest();
        request.setDecision("REJECT");
        AdaptiveLearningReview decided = service.decide("rev-1", "teacher-1", request);

        assertThat(decided.getStatus()).isEqualTo("REJECTED");
        verify(directiveService, never()).createDraft(any(), anyString(), anyString());
    }

    @Test
    void decideOnProcessedReviewThrows() {
        AdaptiveLearningReview review = pendingReview();
        review.setStatus("APPROVED");
        when(reviewRepository.findById("rev-1")).thenReturn(Optional.of(review));

        AdaptiveLearningReviewDecisionRequest request = new AdaptiveLearningReviewDecisionRequest();
        request.setDecision("APPROVE");
        assertThatThrownBy(() -> service.decide("rev-1", "teacher-1", request))
                .isInstanceOf(IllegalStateException.class);
    }

    private AdaptiveLearningReview pendingReview() {
        return AdaptiveLearningReview.builder()
                .id("rev-1")
                .studentId(STUDENT)
                .courseId(COURSE)
                .classId(CLASS)
                .questionCount(10)
                .completedSessionCount(10)
                .status("PENDING")
                .currentSupportLevel("STANDARD")
                .suggestedSupportLevel("HIGH_SUPPORT")
                .knowledgeGaps(List.of("Đa hình"))
                .teachingRecommendations(List.of("Ví dụ thực tế về đa hình"))
                .strengths(List.of())
                .evidence(List.of())
                .build();
    }
}
