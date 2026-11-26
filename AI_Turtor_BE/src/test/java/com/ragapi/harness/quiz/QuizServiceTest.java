package com.ragapi.harness.quiz;
import com.ragapi.harness.memory.StudentCourseMemoryService;
import com.ragapi.harness.review.LearningEvidenceService;
import com.ragapi.service.llm.OpenRouterChatService;

import com.ragapi.harness.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.retrieval.CourseMaterialTextSearchService;
import com.ragapi.harness.retrieval.CourseSearchResultRankingService;
import com.ragapi.dto.GenerateQuizRequest;
import com.ragapi.dto.SubmitQuizRequest;
import com.ragapi.harness.entity.QuizSession;
import com.ragapi.harness.repository.QuizSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock QuizSessionRepository sessionRepository;
    @Mock CourseKnowledgeSearchGateway vectorService;
    @Mock CourseMaterialTextSearchService fallbackSearchService;
    @Mock CourseSearchResultRankingService rerankService;
    @Mock OpenRouterChatService chatService;
    @Mock StudentCourseMemoryService memoryService;
    @Mock LearningEvidenceService learningEvidenceService;

    private QuizService service;

    @BeforeEach
    void setUp() {
        service = new QuizService(sessionRepository, vectorService,
                fallbackSearchService, rerankService, chatService, memoryService, learningEvidenceService);
    }

    @Test
    void generateQuizKeepsOnlyQuestionsCopiedFromTheMatchingPassage() throws Exception {
        when(vectorService.searchWithScores(eq("JDBC"), eq("PRJ301"), isNull())).thenReturn(List.of(
                chunk("JavaServer Pages render HTML from a servlet container.", "jsp-material")
        ));
        when(vectorService.searchTextbookKeywordWithScores(eq("JDBC"), eq("PRJ301"), isNull(), anyInt()))
                .thenReturn(List.of(chunk(JDBC_PASSAGE, "jdbc-material")));
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(chatService.generateUtility(anyString())).thenReturn("""
                {"questions":[
                  {"type":"MULTIPLE_CHOICE","questionText":"JDBC dùng để làm gì?","options":["Kết nối ứng dụng Java với cơ sở dữ liệu","Vẽ giao diện","Biên dịch mã","Gửi email"],"correctAnswer":"A","explanation":"JDBC mở kết nối tới cơ sở dữ liệu.","evidenceQuote":"JDBC is a standard API for connecting Java applications to a relational database","sourcePassage":"P1"},
                  {"type":"MULTIPLE_CHOICE","questionText":"Spring Security dùng để làm gì?","options":["Xác thực người dùng","Vẽ giao diện","Biên dịch mã","Gửi email"],"correctAnswer":"Xác thực người dùng","explanation":"Dùng để xác thực người dùng.","evidenceQuote":"Spring Security authenticates users before they access a protected resource","sourcePassage":"P1"}
                ]}
                """);
        when(sessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QuizSession session = service.generateQuiz(
                "STUDENT-1",
                "PRJ301",
                new GenerateQuizRequest(null, "JDBC", "JDBC", 5)
        );

        assertEquals(1, session.getQuestions().size());
        assertEquals("JDBC dùng để làm gì?", session.getQuestions().get(0).getQuestionText());
        assertEquals("Kết nối ứng dụng Java với cơ sở dữ liệu", session.getQuestions().get(0).getCorrectAnswer());
        assertEquals(List.of("jdbc-material"), session.getQuestions().get(0).getSourceMaterialIds());
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(chatService, atLeastOnce()).generateUtility(prompt.capture());
        assertTrue(prompt.getValue().contains("JDBC is a standard API"));
        assertFalse(prompt.getValue().contains("Kien thuc hoc thuat"));
        verify(chatService, never()).generate(anyString());
    }

    @Test
    void generateQuizDoesNotCallTheModelWhenNoPassageContainsTheTopic() throws Exception {
        when(vectorService.searchWithScores(anyString(), anyString(), isNull())).thenReturn(List.of());
        when(vectorService.searchTextbookKeywordWithScores(anyString(), anyString(), isNull(), anyInt()))
                .thenReturn(List.of());
        when(fallbackSearchService.search(anyString(), anyString(), isNull(), anyInt()))
                .thenReturn(List.of(chunk("Chapter 1 introduces the Java EE platform.", "intro-material")));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.generateQuiz(
                "STUDENT-1",
                "PRJ301",
                new GenerateQuizRequest(null, "JDBC", null, 5)
        ));

        assertTrue(error.getMessage().contains("không tạo quiz ngoài tài liệu"));
        verify(chatService, never()).generateUtility(anyString());
        verify(chatService, never()).generate(anyString());
    }

    @Test
    void submittedQuizNeedsNoTeacherReviewAndShowsItsAnswers() {
        QuizSession session = assignedSession("GENERATED", null);
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        when(sessionRepository.save(any(QuizSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        QuizSession saved = service.submitQuiz("QUIZ-1", submitRequest());

        assertEquals("SUBMITTED", saved.getStatus());
        assertEquals("NOT_REQUIRED", saved.getTeacherReviewStatus());
        assertEquals(1, saved.getScore());
        assertNotNull(service.toStudentView(saved).getQuestions().get(0).getCorrectAnswer());
    }

    @Test
    void quizCannotBeSubmittedTwice() {
        QuizSession session = assignedSession("SUBMITTED", "PENDING");
        when(sessionRepository.findById("QUIZ-1")).thenReturn(Optional.of(session));
        assertThrows(IllegalArgumentException.class, () -> service.submitQuiz("QUIZ-1", submitRequest()));
    }

    private static final String JDBC_PASSAGE = """
            JDBC is a standard API for connecting Java applications to a relational database using drivers.
            A connection is opened before a statement can run.
            """;

    private static RetrievedCourseChunk chunk(String content, String materialId) {
        return new RetrievedCourseChunk(content, 0.8, materialId, "PRJ301", null, "teacher", "COURSE", "TEXTBOOK");
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
