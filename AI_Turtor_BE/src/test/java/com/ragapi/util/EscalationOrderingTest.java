package com.ragapi.util;

import com.ragapi.entity.QuestionEscalation;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EscalationOrderingTest {

    @Test
    void newestCreatedRequestComesFirst() {
        QuestionEscalation older = QuestionEscalation.builder()
                .id("older")
                .createdAt(LocalDateTime.parse("2026-01-01T00:00:00"))
                .updatedAt(LocalDateTime.parse("2026-10-02T00:00:00"))
                .build();
        QuestionEscalation newer = QuestionEscalation.builder()
                .id("newer")
                .createdAt(LocalDateTime.parse("2026-10-01T00:00:00"))
                .updatedAt(LocalDateTime.parse("2026-10-01T00:00:00"))
                .build();
        List<QuestionEscalation> requests = new ArrayList<>(List.of(older, newer));

        requests.sort(EscalationOrdering.newestFirst());

        assertThat(requests).extracting(QuestionEscalation::getId).containsExactly("newer", "older");
    }

    @Test
    void fallsBackToUpdatedAtWhenCreatedAtIsMissing() {
        QuestionEscalation older = QuestionEscalation.builder()
                .id("older")
                .updatedAt(LocalDateTime.parse("2026-03-01T00:00:00"))
                .build();
        QuestionEscalation newer = QuestionEscalation.builder()
                .id("newer")
                .updatedAt(LocalDateTime.parse("2026-04-01T00:00:00"))
                .build();
        List<QuestionEscalation> requests = new ArrayList<>(List.of(older, newer));

        requests.sort(EscalationOrdering.newestFirst());

        assertThat(requests).extracting(QuestionEscalation::getId).containsExactly("newer", "older");
    }
}
