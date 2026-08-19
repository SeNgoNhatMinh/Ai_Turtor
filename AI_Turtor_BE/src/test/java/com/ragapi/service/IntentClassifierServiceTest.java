package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IntentClassifierServiceTest {

    private IntentClassifierService service;

    @BeforeEach
    void setUp() {
        service = new IntentClassifierService();
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
    }

    @Test
    void servletConceptQuestion_routesToRag() {
        var result = service.classify("Servlet la gi?", "", "PRJ301");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("EXPLAIN_CONCEPT", result.getSubIntent());
        assertEquals("WEB", result.getDomain());
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

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("OFF_TOPIC", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
    }

    @Test
    void greeting_isMarkedConversational() {
        var result = service.classify("xin chào", "", "CEA201");

        assertEquals(IntentClassifierService.MODE_RAG, result.getMode());
        assertEquals("CONVERSATIONAL", result.getSubIntent());
        assertFalse(result.getRequiresCourseMaterial());
    }
}
