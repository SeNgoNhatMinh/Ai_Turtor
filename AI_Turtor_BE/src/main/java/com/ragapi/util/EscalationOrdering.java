package com.ragapi.util;

import com.ragapi.entity.QuestionEscalation;

import java.time.LocalDateTime;
import java.util.Comparator;

public final class EscalationOrdering {
    private EscalationOrdering() {
    }

    public static Comparator<QuestionEscalation> newestFirst() {
        return (left, right) -> recency(right).compareTo(recency(left));
    }

    private static LocalDateTime recency(QuestionEscalation item) {
        if (item == null) return LocalDateTime.MIN;
        if (item.getCreatedAt() != null) return item.getCreatedAt();
        if (item.getUpdatedAt() != null) return item.getUpdatedAt();
        if (item.getQuestionAskedAt() != null) return item.getQuestionAskedAt();
        return LocalDateTime.MIN;
    }
}
