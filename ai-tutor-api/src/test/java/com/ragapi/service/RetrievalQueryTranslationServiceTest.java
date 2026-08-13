package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RetrievalQueryTranslationServiceTest {

    private OpenRouterChatService chatService;
    private RetrievalQueryTranslationService service;

    @BeforeEach
    void setUp() {
        chatService = mock(OpenRouterChatService.class);
        service = new RetrievalQueryTranslationService(chatService);
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "targetLanguage", "English");
    }

    @Test
    void rewritesVietnameseMathQueryWithoutTermHardcoding() throws Exception {
        when(chatService.generateUtility(contains("Hàm mệnh đề là gì?")))
                .thenReturn("propositional function predicate truth value");

        String result = service.expandForRetrieval("Hàm mệnh đề là gì?", "MAD101");

        assertTrue(result.startsWith("Hàm mệnh đề là gì? | "));
        assertTrue(result.contains("propositional function"));
    }

    @Test
    void cachesRewriteForRepeatedQuestion() throws Exception {
        when(chatService.generateUtility(contains("Lượng từ là gì?")))
                .thenReturn("quantifier universal existential");

        String first = service.expandForRetrieval("Lượng từ là gì?", "MAD101");
        String second = service.expandForRetrieval("Lượng từ là gì?", "MAD101");

        assertEquals(first, second);
        verify(chatService, times(1)).generateUtility(contains("Lượng từ là gì?"));
    }

    @Test
    void leavesEnglishQueryUntouched() {
        assertEquals("What is a proposition?",
                service.expandForRetrieval("What is a proposition?", "MAD101"));
    }
}
