package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentQuestionNormalizationServiceTest {

    @Mock
    private OpenRouterChatService chatService;

    @InjectMocks
    private StudentQuestionNormalizationService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "llmEnabled", true);
        ReflectionTestUtils.setField(service, "maxLength", 500);
    }

    @Test
    void normalize_usesLlmToInferGreetingTypo() {
        when(chatService.generateUtility(anyString())).thenReturn("xin chào");

        assertThat(service.normalize("xic chao")).isEqualTo("xin chào");
        verify(chatService).generateUtility(org.mockito.ArgumentMatchers.contains("xic chao"));
    }

    @Test
    void normalize_keepsOriginalWhenLlmFails() {
        when(chatService.generateUtility(anyString())).thenReturn(null);

        assertThat(service.normalize("xic chao")).isEqualTo("xic chao");
    }

    @Test
    void normalize_rejectsUnsafeRewrite() {
        when(chatService.generateUtility(anyString())).thenReturn("Đây là một câu trả lời dài hoàn toàn khác nghĩa");

        assertThat(service.normalize("Servlet la gi")).isEqualTo("Servlet la gi");
    }

    @Test
    void normalize_skipsLlmWhenVietnameseDiacriticsAreAlreadyPresent() {
        String question = "Sự khác biệt giữa Java EE 7 và Java SE 7";

        assertThat(service.normalize(question)).isEqualTo(question);
        verify(chatService, never()).generateUtility(anyString());
    }

    @Test
    void normalize_skipsLlmWhenDisabled() {
        ReflectionTestUtils.setField(service, "llmEnabled", false);

        assertThat(service.normalize("xic chao")).isEqualTo("xic chao");
        verify(chatService, never()).generateUtility(anyString());
    }
}
