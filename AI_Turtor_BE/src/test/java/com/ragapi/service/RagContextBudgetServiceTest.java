package com.ragapi.service;

import com.ragapi.service.ElasticVectorService.SearchChunk;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RagContextBudgetServiceTest {

    @Mock
    private OpenRouterChatService chatService;

    @Test
    void applyBudget_keepsHighestPriorityChunksWithinLimit() {
        when(chatService.isOllamaOnlyActive()).thenReturn(false);
        RagContextBudgetService service = new RagContextBudgetService(chatService);
        ReflectionTestUtils.setField(service, "maxContextChars", 1000);
        ReflectionTestUtils.setField(service, "ollamaMaxContextChars", 600);
        List<SearchChunk> chunks = List.of(
                chunk("a".repeat(600), 0.9),
                chunk("b".repeat(600), 0.8),
                chunk("c".repeat(600), 0.7)
        );

        List<SearchChunk> selected = service.applyBudget(chunks);

        assertThat(selected).hasSize(2);
        assertThat(selected.get(0).content()).hasSize(600);
        assertThat(selected.get(1).content()).hasSize(400);
    }

    @Test
    void applyBudget_usesTighterLimitWhenOllamaOnly() {
        when(chatService.isOllamaOnlyActive()).thenReturn(true);
        RagContextBudgetService service = new RagContextBudgetService(chatService);
        ReflectionTestUtils.setField(service, "maxContextChars", 12000);
        ReflectionTestUtils.setField(service, "ollamaMaxContextChars", 1000);
        List<SearchChunk> chunks = List.of(
                chunk("a".repeat(800), 0.9),
                chunk("b".repeat(800), 0.8)
        );

        List<SearchChunk> selected = service.applyBudget(chunks);

        assertThat(selected).hasSize(2);
        assertThat(selected.get(0).content()).hasSize(800);
        assertThat(selected.get(1).content()).hasSize(200);
    }

    private SearchChunk chunk(String content, double score) {
        return new SearchChunk(content, score, "mat-1", "CEA201", "CEA201-01", "teacher-1", "COURSE");
    }
}
