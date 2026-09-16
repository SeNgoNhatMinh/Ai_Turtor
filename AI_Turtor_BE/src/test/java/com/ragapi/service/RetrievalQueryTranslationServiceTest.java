package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RetrievalQueryTranslationServiceTest {

    @Mock
    private OpenRouterChatService chatService;

    @Mock
    private SharedRedisCacheService sharedRedisCache;

    @InjectMocks
    private RetrievalQueryTranslationService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "skipWhenOllamaOnly", true);
        ReflectionTestUtils.setField(service, "targetLanguage", "English");
    }

    @Test
    void expandForRetrieval_skipsLlmWhenKeywordExpansionAlreadyAddedEnglishTerms() {
        String expanded = "JSP hoạt động thế nào? jsp java server pages jsp lifecycle servlet class compilation web container";

        String result = service.expandForRetrieval(expanded, "CEA201", true);

        assertThat(result).isEqualTo(expanded);
        verify(chatService, never()).generateUtility(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void expandForRetrieval_skipsWhenOnlyOllamaIsActive() {
        org.mockito.Mockito.when(chatService.isOllamaOnlyActive()).thenReturn(true);

        String question = "JSP hoạt động thế nào?";
        String result = service.expandForRetrieval(question, "PRJ301", false);

        assertThat(result).isEqualTo(question);
        verify(chatService, never()).generateUtility(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void cacheKeyIgnoresCasePunctuationWhitespaceAndVietnameseAccents() {
        when(sharedRedisCache.getString(eq("retrieval-query-translation"), anyString()))
                .thenReturn(Optional.empty());

        service.expandForRetrieval("JSP hoạt động thế nào?", "PRJ301", false);
        service.expandForRetrieval("  jsp HOAT DONG THE NAO!!! ", "prj301", false);

        var keyCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(sharedRedisCache, times(2))
                .getString(eq("retrieval-query-translation"), keyCaptor.capture());
        assertThat(keyCaptor.getAllValues()).containsExactly(
                "prj301|jsp hoat dong the nao",
                "prj301|jsp hoat dong the nao"
        );
    }
}
