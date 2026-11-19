package com.ragapi.harness.retrieval;

import com.ragapi.service.llm.OpenRouterChatService;
import com.ragapi.service.cache.SharedRedisCacheService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseRetrievalQueryServiceTest {

    @Test
    void bothParaphrasesKeepTheirWordingAndUseTheRewrittenSearchText() {
        OpenRouterChatService chatService = mock(OpenRouterChatService.class);
        SharedRedisCacheService cache = mock(SharedRedisCacheService.class);
        when(cache.getString(anyString(), anyString())).thenReturn(Optional.empty());
        when(chatService.isOllamaOnlyActive()).thenReturn(false);
        when(chatService.generateUtility(contains("Con trỏ trong C là gì?")))
                .thenReturn("What is a pointer in C; memory address");
        when(chatService.generateUtility(contains("Biến tham chiếu này hoạt động thế nào?")))
                .thenReturn("How does a reference variable work; pointer; memory address");
        CourseRetrievalQueryService service = new CourseRetrievalQueryService(
                new LocalRetrievalQueryProcessor(),
                chatService,
                cache,
                null
        );
        ReflectionTestUtils.setField(service, "translationEnabled", true);
        ReflectionTestUtils.setField(service, "skipTranslationWhenOllamaOnly", false);
        ReflectionTestUtils.setField(service, "translationTargetLanguage", "English");
        ReflectionTestUtils.setField(service, "translationCacheTtlHours", 24L);

        var named = service.resolve("Con trỏ trong C là gì?", "PRF192", null, null);
        var paraphrased = service.resolve("Biến tham chiếu này hoạt động thế nào?", "PRF192", null, null);

        assertThat(named.focus()).isEqualTo("Con trỏ trong C là gì?");
        assertThat(named.keywordQuery()).startsWith("Con trỏ trong C là gì?");
        assertThat(named.keywordQuery()).contains("memory address");
        assertThat(paraphrased.focus()).isEqualTo("Biến tham chiếu này hoạt động thế nào?");
        assertThat(paraphrased.keywordQuery()).startsWith("Biến tham chiếu này hoạt động thế nào?");
        assertThat(paraphrased.keywordQuery()).contains("pointer");
        assertThat(named.technicalTerms()).isEmpty();
        assertThat(paraphrased.technicalTerms()).isEmpty();
    }
}
