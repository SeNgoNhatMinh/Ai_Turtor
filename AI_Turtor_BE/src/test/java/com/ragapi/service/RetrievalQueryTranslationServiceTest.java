package com.ragapi.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RetrievalQueryTranslationServiceTest {

    @Mock
    private OpenRouterChatService chatService;

    @InjectMocks
    private RetrievalQueryTranslationService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "targetLanguage", "English");
    }

    @Test
    void expandForRetrieval_skipsLlmWhenKeywordExpansionAlreadyAddedEnglishTerms() {
        String expanded = "JSP hoạt động thế nào? jsp java server pages jsp lifecycle servlet class compilation web container";

        String result = service.expandForRetrieval(expanded, "CEA201", true);

        assertThat(result).isEqualTo(expanded);
        verify(chatService, never()).generateUtility(org.mockito.ArgumentMatchers.anyString());
    }
}
