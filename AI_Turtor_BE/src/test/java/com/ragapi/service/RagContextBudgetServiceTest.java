package com.ragapi.service;

import com.ragapi.service.ElasticVectorService.SearchChunk;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RagContextBudgetServiceTest {

    private final RagContextBudgetService service = new RagContextBudgetService();

    @Test
    void applyBudget_keepsHighestPriorityChunksWithinLimit() {
        ReflectionTestUtils.setField(service, "maxContextChars", 1000);
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

    private SearchChunk chunk(String content, double score) {
        return new SearchChunk(content, score, "mat-1", "CEA201", "CEA201-01", "teacher-1", "COURSE");
    }
}
