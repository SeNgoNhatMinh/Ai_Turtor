package com.ragapi.service;

import com.ragapi.dto.IntentClassification;
import com.ragapi.dto.TutorIntentContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IntentClassifierServiceTest {

    private IntentClassifierService service;
    private LlmIntentClassifierService llmClassifier;

    @BeforeEach
    void setUp() {
        llmClassifier = mock(LlmIntentClassifierService.class);
        SharedRedisCacheService sharedRedisCache = mock(SharedRedisCacheService.class);
        when(llmClassifier.classify(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(sharedRedisCache.get(anyString(), anyString(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());
        service = new IntentClassifierService(llmClassifier, sharedRedisCache);
    }

    @Test
    void guideToWriteServletJsp_routesToCode() {
        var result = service.classify(
                "Huong dan toi viet 1 Servlet ket hop JSP",
                "",
                "PRJ301"
        );

        assertEquals(IntentClassifierService.MODE_CODE, result.getMode());
        assertEquals("GUIDE_SOLUTION", result.getSubIntent());
        assertEquals("WEB", result.getDomain());
    }

    @Test
    void servletLifecycleQuestion_routesToRag() {
        var result = service.classify(
                "Vòng đời của Servlet gồm các hàm nào (init, service, destroy)?",
                "",
                "PRJ301"
        );

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertEquals("WEB", result.getDomain());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void servletConceptQuestion_routesToRag() {
        var result = service.classify("Servlet la gi?", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertEquals("WEB", result.getDomain());
    }

    @Test
    void topicStudyStart_routesToLearningPathNotDefinition() {
        var result = service.classify("Nay mình học Java Servlet", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("LEARNING_PATH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void firstPersonTopicStudyStart_routesToLearningPath() {
        var result = service.classify(
                "H\u00f4m nay t\u00f4i mu\u1ed1n h\u1ecdc v\u1ec1 t\u00ednh \u0111a h\u00ecnh",
                "",
                "PRO192"
        );

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("LEARNING_PATH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void whatToStudyNext_staysOnCurrentTopicNotNumberedPath() {
        var result = service.classify("Mình nên ôn gì tiếp?", "", "PRO192");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertNotEquals("LEARNING_PATH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
    }

    @Test
    void numberedLessonStart_routesToLessonTeach() {
        var result = service.classify("Bắt đầu bài 1: Servlet là gì?", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("LESSON_TEACH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
    }

    @Test
    void deepDiveRequest_routesToLessonDeepPathNotNextBai() {
        var result = service.classify(
                "Gợi ý học chuyên sâu bài 3: Cache",
                "",
                "OSG202"
        );

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("LESSON_DEEP_PATH", result.getSubIntent());
        assertNotEquals("LESSON_TEACH", result.getSubIntent());
        assertNotEquals("LEARNING_PATH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
    }

    @Test
    void deepDiveTopic_routesToLessonTeach() {
        var result = service.classify(
                "Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu",
                "",
                "OSG202"
        );

        assertEquals("LESSON_TEACH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
    }

    @Test
    void naturalServletSpecificationFollowUp_routesToCourseRag() {
        var result = service.classify(
                "Servlet Specification giúp mình hiểu khái niệm của phần này với?",
                "",
                "PRJ301"
        );

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
    }

    @Test
    void studentAsksDoanCodeNay_routesToCodeWithoutPaste() {
        var result = service.classify("đoạn code này của em có đúng ko?", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_CODE, result.getMode());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void singleJspTagConceptQuestion_staysCourseRag() {
        var result = service.classify("Thẻ <jsp:include> dùng khi nào?", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertNotEquals(IntentClassifierService.MODE_CODE, result.getMode());
    }

    @Test
    void pastedJspxAskingWhatItPrints_routesToCodeNotRag() {
        var result = service.classify(
                """
                code này đúng chưa và nó xuất ra màn hình là gì ?
                <jsp:root xmlns:jsp="http://java.sun.com/JSP/Page" version="2.0">
                <jsp:scriptlet>counter++;</jsp:scriptlet>
                </jsp:root>
                """,
                "",
                "PRJ301"
        );

        assertEquals(IntentClassifierService.MODE_CODE, result.getMode());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void debugWithCodeSnippet_routesToCode() {
        var result = service.classify(
                "Code nay sai o dau?",
                "public class Demo { public static void main(String[] args) { System.out.println(arr[5]); } }",
                "PRJ301"
        );

        assertEquals(IntentClassifierService.MODE_CODE, result.getMode());
        assertEquals("DEBUG_CODE", result.getSubIntent());
    }

    @Test
    void classScheduleQuestion_isMarkedOffTopic() {
        var result = service.classify("mai mấy giờ học", "", "CEA201");

        assertEquals(IntentClassifierService.MODE_REFUSE, result.getMode());
        assertEquals("OFF_TOPIC", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
    }

    @Test
    void greeting_isMarkedConversational() {
        var result = service.classify("xin chào", "", "CEA201");

        assertEquals(IntentClassifierService.MODE_CURRICULUM, result.getMode());
        assertEquals(IntentClassifierService.MODE_CURRICULUM, result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
        verifyNoInteractions(llmClassifier);
    }

    @Test
    void incompleteInput_isRejectedWithoutCallingHostedLlm() {
        var result = service.classify("hôm nay tôi muốn...", "", "DBI202");

        assertEquals(IntentClassifierService.MODE_REFUSE, result.getMode());
        assertEquals("OFF_TOPIC", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
        assertEquals("LOCAL_VALIDATION", result.getRoutingStrategy());
        verifyNoInteractions(llmClassifier);
    }

    @Test
    void harnessAgentReadsContextAndKeepsCasualQuestionsLocal() {
        when(llmClassifier.classify(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.of(localAgentDecision("OFF_TOPIC")));

        var weather = service.classify("hôm nay trời có mưa ko", "", "PRJ301", servletLessonContext());
        var identity = service.classify("Mày biết tao là ai ko", "", "PRJ301", servletLessonContext());

        assertEquals(IntentClassifierService.MODE_REFUSE, weather.getMode());
        assertEquals("OFF_TOPIC", weather.getSubIntent());
        assertEquals(IntentClassifierService.MODE_REFUSE, identity.getMode());
        assertEquals("OFF_TOPIC", identity.getSubIntent());
        assertFalse(weather.getRequiresCourseMaterial());
        assertEquals("HARNESS_AGENT", weather.getRoutingStrategy());
        assertEquals("HARNESS_AGENT", identity.getRoutingStrategy());
        verify(llmClassifier, org.mockito.Mockito.atLeastOnce())
                .classify(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void harnessGuardRejectsAgentRouteThatWouldAnswerCasualQuestionsFromCourseMaterial() {
        when(llmClassifier.classify(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.of(IntentClassification.builder()
                        .mode(IntentClassifierService.MODE_RAG)
                        .subIntent("EXPLAIN_CONCEPT")
                        .requiresCourseMaterial(true)
                        .routingStrategy("LLM")
                        .confidence(0.8)
                        .domain("WEB")
                        .reason("mistook weather for a lesson")
                        .answerPolicy("Answer from course material")
                        .build()));

        var result = service.classify("mai có mưa ko", "", "PRJ301", servletLessonContext());

        assertEquals(IntentClassifierService.MODE_REFUSE, result.getMode());
        assertEquals("OFF_TOPIC", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
        assertEquals("HARNESS_GUARD", result.getRoutingStrategy());
    }

    @Test
    void obviousNonAcademicQuestion_usesLocalReplyWhenAgentIsUnavailable() {
        var result = service.classify("viết cho mình một bài thơ", "", "DBI202");

        assertEquals(IntentClassifierService.MODE_REFUSE, result.getMode());
        assertEquals("OFF_TOPIC", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
        verify(llmClassifier).classify(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void ambiguousQuestion_canBeDeferredToTheN8nAgent() {
        var result = service.classify("hôm nay trời có mưa ko", "", "PRJ301", servletLessonContext(), true);

        assertEquals("AGENT", result.getMode());
        assertEquals("NEEDS_AGENT", result.getSubIntent());
        assertEquals("NEEDS_AGENT", result.getRoutingStrategy());
        verifyNoInteractions(llmClassifier);
    }

    @Test
    void explicitAcademicQuestion_skipsHarnessAgent() {
        var result = service.classify("Servlet là gì?", "", "PRJ301");

        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
        verifyNoInteractions(llmClassifier);
    }

    @Test
    void bareTopicWithoutQuestionShape_usesSafeRagFallback() {
        var result = service.classify("Java Servlet", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("SAFE_RAG_FALLBACK", result.getRoutingStrategy());
    }

    @Test
    void bareConceptUsesSafeRagFallbackWhenSemanticClassifierIsUnavailable() {
        var result = service.classify("Forward Propagation", "", "AIL303");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("SAFE_RAG_FALLBACK", result.getRoutingStrategy());
    }

    private static IntentClassification localAgentDecision(String subIntent) {
        return IntentClassification.builder()
                .mode(IntentClassifierService.MODE_RAG)
                .subIntent(subIntent)
                .requiresCourseMaterial(false)
                .routingStrategy("LLM")
                .confidence(0.91)
                .domain("GENERAL_STUDY")
                .reason("Harness agent selected a local reply")
                .answerPolicy("Respond without course-material RAG.")
                .build();
    }

    private static final String SERVLET_LESSON_HISTORY = """
            - Student: Nay mình học Java Servlet
            - Tutor: Lộ trình Bài 1 Servlet là gì
            - Student: Bắt đầu bài 1: Servlet là gì?
            - Tutor: Servlet nhận request và trả response
            """;

    private static TutorIntentContext servletLessonContext() {
        return new TutorIntentContext(SERVLET_LESSON_HISTORY, "TEACH", "Java Servlet");
    }

    @Test
    void inLessonFollowUp_continuesCurrentLesson() {
        var result = service.classify("còn response thì sao?", "", "PRJ301", servletLessonContext());

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("LESSON_TEACH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
        assertEquals("WEB", result.getDomain());
    }

    @Test
    void inLessonExampleFollowUp_staysOnLesson() {
        var result = service.classify("ví dụ đi", "", "PRJ301", servletLessonContext());

        assertEquals("LESSON_TEACH", result.getSubIntent());
        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
    }

    @Test
    void coViDuKo_inLesson_staysOnLesson() {
        var result = service.classify("có ví dụ ko?", "", "PRJ301", servletLessonContext());

        assertEquals("LESSON_TEACH", result.getSubIntent());
        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void exampleFollowUpAfterConceptQuestion_doesNotRestartNumberedLesson() {
        var context = new TutorIntentContext("""
                - Student: Servlet Specification giúp mình hiểu khái niệm của phần này với?
                - Tutor: Servlet Specification là một phần của Java EE
                """, null, null);

        var result = service.classify("có ví dụ ko?", "", "PRJ301", context);

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertNotEquals("LESSON_TEACH", result.getSubIntent());
        assertTrue(result.getRequiresCourseMaterial());
    }

    @Test
    void scheduleQuestion_staysOffTopicEvenWithLessonHistory() {
        var result = service.classify("mai mấy giờ học", "", "CEA201", servletLessonContext());

        assertEquals("OFF_TOPIC", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
    }

    @Test
    void newTopicDuringLesson_startsANewLearningPath() {
        var result = service.classify("Nay mình học JDBC", "", "PRJ301", servletLessonContext());

        assertEquals("LEARNING_PATH", result.getSubIntent());
        assertEquals("RULE", result.getRoutingStrategy());
    }

    @Test
    void greeting_staysConversationalEvenWithLessonHistory() {
        var result = service.classify("xin chào", "", "CEA201", servletLessonContext());

        assertEquals(IntentClassifierService.MODE_CURRICULUM, result.getMode());
        assertEquals(IntentClassifierService.MODE_CURRICULUM, result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
        assertEquals("RULE", result.getRoutingStrategy());
        verifyNoInteractions(llmClassifier);
    }

    @Test
    void followUpWithoutLessonContext_doesNotForceLessonTeach() {
        var result = service.classify("thế còn phần kia thì sao?", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("SAFE_RAG_FALLBACK", result.getRoutingStrategy());
        assertNotEquals("LESSON_TEACH", result.getSubIntent());
    }
}
