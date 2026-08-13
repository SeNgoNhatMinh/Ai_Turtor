package com.ragapi.service;

import com.ragapi.dto.SubmitQuizRequest;
import com.ragapi.dto.TeacherReviewQuizRequest;
import com.ragapi.entity.QuizSession;
import com.ragapi.repository.QuizAssignmentRepository;
import com.ragapi.repository.QuizSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock QuizSessionRepository sessionRepository;
    @Mock QuizAssignmentRepository assignmentRepository;
    @Mock ElasticVectorService vectorService;
    @Mock CourseMaterialFallbackSearchService fallbackSearchService;
    @Mock RerankService rerankService;
    @Mock OpenRouterChatService chatService;
    @Mock StudentCourseMemoryService memoryService;

    private QuizService service;

    @BeforeEach
    void setUp() {
        service = new QuizService(sessionRepository, assignmentRepository, vectorService,
                fallbackSearchService, rerankService, chatService, memoryService);
    }

    @Test
    void assignedSubmitBecomesPendingTeacherReview() {
        QuizSession session = assignedSession("GENERATED", null);
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        when(sessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QuizSession saved = service.submitQuiz("QUIZ-1", submitRequest());

        assertEquals("SUBMITTED", saved.getStatus());
        assertEquals("PENDING", saved.getTeacherReviewStatus());
        assertEquals(1, saved.getScore());
    }

    @Test
    void quizCannotBeSubmittedTwice() {
        QuizSession session = assignedSession("SUBMITTED", "PENDING");
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        assertThrows(IllegalArgumentException.class, () -> service.submitQuiz("QUIZ-1", submitRequest()));
    }

    @Test
    void teacherManualOnlineQuizStoresSelectionWithoutLeakingKeyOrAutoScore() {
        QuizSession session = assignedSession("GENERATED", null);
        session.setGradingMode("TEACHER_MANUAL");
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        when(sessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QuizSession saved = service.submitQuiz("QUIZ-1", submitRequest());
        QuizSession studentView = service.toStudentView(saved);

        assertEquals("PENDING", saved.getTeacherReviewStatus());
        assertNull(saved.getScore());
        assertNull(saved.getPercentage());
        assertNull(studentView.getQuestions().get(0).getCorrectAnswer());
        assertEquals(0, studentView.getAnswers().size());
    }

    @Test
    void foreignTeacherCannotReviewAttempt() {
        QuizSession session = assignedSession("SUBMITTED", "PENDING");
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        assertThrows(SecurityException.class, () -> service.teacherReviewQuiz(
                "QUIZ-1", new TeacherReviewQuizRequest(1, "ok"), "TEACHER-OTHER", "TEACHER"));
    }

    @Test
    void ownerTeacherCanReviewPendingAttempt() {
        QuizSession session = assignedSession("SUBMITTED", "PENDING");
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        when(sessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QuizSession reviewed = service.teacherReviewQuiz(
                "QUIZ-1", new TeacherReviewQuizRequest(0, "Review complete"), "TEACHER-1", "TEACHER");

        assertEquals("REVIEWED", reviewed.getTeacherReviewStatus());
        assertEquals(0, reviewed.getTeacherReviewedScore());
    }

    @Test
    void listAttemptsFiltersAndReturnsFinalScore() {
        QuizSession pending = assignedSession("SUBMITTED", "PENDING");
        QuizSession reviewed = assignedSession("SUBMITTED", "REVIEWED");
        reviewed.setId("QUIZ-2");
        reviewed.setTeacherReviewedScore(0);
        when(sessionRepository.findByTeacherIdOrderBySubmittedAtDesc("TEACHER-1"))
                .thenReturn(List.of(pending, reviewed));

        var page = service.listTeacherQuizAttempts(
                "TEACHER-1", "TEACHER-1", "TEACHER",
                "SUBMITTED", "REVIEWED", null, null, null, null, 0, 20);

        assertEquals(1, page.getTotalElements());
        assertEquals("QUIZ-2", page.getAttempts().get(0).getQuizSessionId());
        assertEquals(0, page.getAttempts().get(0).getFinalScore());
        assertEquals(0.0, page.getAttempts().get(0).getFinalPercentage());
    }

    private QuizSession assignedSession(String status, String reviewStatus) {
        return QuizSession.builder()
                .id("QUIZ-1")
                .studentId("STUDENT-1")
                .teacherId("TEACHER-1")
                .courseId("PRO192")
                .classId("SE1840")
                .assignmentId("ASSIGNMENT-1")
                .quizType("ASSIGNED")
                .status(status)
                .teacherReviewStatus(reviewStatus)
                .score(1)
                .maxScore(1)
                .percentage(100.0)
                .questions(List.of(QuizSession.QuizQuestion.builder()
                        .questionId("Q1").correctAnswer("A").build()))
                .createdAt(LocalDateTime.now())
                .submittedAt(LocalDateTime.now())
                .build();
    }

    private SubmitQuizRequest submitRequest() {
        return new SubmitQuizRequest(List.of(new SubmitQuizRequest.QuizAnswerSubmission("Q1", "A")));
    }
}
