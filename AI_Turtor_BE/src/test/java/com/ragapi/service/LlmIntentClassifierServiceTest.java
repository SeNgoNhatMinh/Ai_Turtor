package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.argThat;

class LlmIntentClassifierServiceTest {

    private OpenRouterChatService chatService;
    private LlmIntentClassifierService service;

    @BeforeEach
    void setUp() {
        chatService = mock(OpenRouterChatService.class);
        service = new LlmIntentClassifierService(chatService);
        ReflectionTestUtils.setField(service, "enabled", true);
    }

    @Test
    void parsesValidatedSemanticClassification() {
        when(chatService.generateUtility(anyString())).thenReturn("""
                {"mode":"RAG","subIntent":"EXPLAIN_CONCEPT","domain":"AI_ML",
                 "confidence":0.91,"reason":"A bare machine-learning concept"}
                """);

        var result = service.classify("Forward Propagation", "", "AIL303");

        assertTrue(result.isPresent());
        assertEquals("RAG", result.get().getMode());
        assertEquals("EXPLAIN_CONCEPT", result.get().getSubIntent());
        assertTrue(result.get().getRequiresCourseMaterial());
        assertEquals("LLM", result.get().getRoutingStrategy());
    }

    @Test
    void conversationalIntentDoesNotRequireCourseRetrieval() {
        when(chatService.generateUtility(anyString())).thenReturn("""
                ```json
                {"mode":"RAG","subIntent":"CONVERSATIONAL","domain":"GENERAL_STUDY",
                 "confidence":0.84,"reason":"Student is sharing how they feel"}
                ```
                """);

        var result = service.classify("Hôm nay mình hơi mệt, học chậm với mình nhé", "", "PRJ301");

        assertTrue(result.isPresent());
        assertFalse(result.get().getRequiresCourseMaterial());
    }

    @Test
    void rejectsMalformedOrUnsupportedOutput() {
        when(chatService.generateUtility(anyString()))
                .thenReturn("{\"mode\":\"CHAT\",\"subIntent\":\"UNKNOWN\"}");

        assertTrue(service.classify("some ambiguous message", "", "PRJ301").isEmpty());
    }

    @Test
    void canBeDisabledForOperationalFallback() {
        ReflectionTestUtils.setField(service, "enabled", false);

        assertTrue(service.classify("anything", "", "PRJ301").isEmpty());
    }

    @Test
    void classifierPromptIncludesRecentChatForFollowUps() {
        when(chatService.generateUtility(anyString())).thenReturn("""
                {"mode":"RAG","subIntent":"LESSON_TEACH","domain":"WEB",
                 "confidence":0.9,"reason":"Follow-up in the current Servlet lesson"}
                """);

        String history = "- Student: Bắt đầu bài 1: Servlet là gì?\n- Tutor: Servlet nhận request";
        var result = service.classify("còn response thì sao?", "", "PRJ301", history);

        assertTrue(result.isPresent());
        assertEquals("LESSON_TEACH", result.get().getSubIntent());
        verify(chatService).generateUtility(argThat(prompt ->
                prompt.contains("Bắt đầu bài 1: Servlet là gì?")
                        && prompt.contains("còn response thì sao?")));
    }

    @Test
    void skipsLlmWhenOllamaOnlyIsActive() {
        when(chatService.isOllamaOnlyActive()).thenReturn(true);

        assertTrue(service.classify("Controller trong MVC dùng để làm gì?", "", "PRJ301").isEmpty());
        verify(chatService, org.mockito.Mockito.never()).generateUtility(anyString());
    }
}
