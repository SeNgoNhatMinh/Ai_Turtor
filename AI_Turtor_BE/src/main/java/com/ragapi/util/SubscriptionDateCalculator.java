package com.ragapi.util;

import java.time.LocalDateTime;

public final class SubscriptionDateCalculator {
    private SubscriptionDateCalculator() {
    }

    public static LocalDateTime calculateEndAt(LocalDateTime startAt, int durationDays) {
        if (startAt == null) {
            throw new IllegalArgumentException("startAt is required");
        }
        if (durationDays <= 0) {
            throw new IllegalArgumentException("durationDays must be positive");
        }
        return startAt.plusDays(durationDays);
    }
}






