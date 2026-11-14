package com.ragapi.service.behavior.plan;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Drops contradictory styles so the tutor gets a small compatible set. */
public final class TeachingBehaviorConflictPolicy {

    public static final int MAX_SELECTED = 3;

    private static final Set<String> PACE_SLOW = Set.of("SLOW", "STEP", "TUNG BUOC", "TỪNG BƯỚC");
    private static final Set<String> PACE_FAST = Set.of("FAST", "NHANH", "CHALLENGE");

    private TeachingBehaviorConflictPolicy() {
    }

    public static List<SelectedTeachingBehavior> resolve(List<SelectedTeachingBehavior> ranked) {
        if (ranked == null || ranked.isEmpty()) return List.of();
        List<SelectedTeachingBehavior> kept = new ArrayList<>();
        Set<String> strategies = new LinkedHashSet<>();
        boolean slow = false;
        boolean fast = false;
        for (SelectedTeachingBehavior item : ranked) {
            if (kept.size() >= MAX_SELECTED) break;
            String strategy = normalize(item.strategy());
            String instruction = normalize(item.instruction());
            boolean itemSlow = containsAny(strategy + " " + instruction, PACE_SLOW);
            boolean itemFast = containsAny(strategy + " " + instruction, PACE_FAST);
            if (itemSlow && fast) continue;
            if (itemFast && slow) continue;
            if (strategy != null && !strategy.isBlank() && strategies.contains(strategy)) continue;
            if (looksLikeFullSolution(instruction)) continue;
            kept.add(item);
            if (strategy != null && !strategy.isBlank()) strategies.add(strategy);
            slow = slow || itemSlow;
            fast = fast || itemFast;
        }
        return List.copyOf(kept);
    }

    private static boolean looksLikeFullSolution(String text) {
        return text != null && (text.contains("full solution")
                || text.contains("dap an hoan chinh")
                || text.contains("lời giải hoàn chỉnh")
                || text.contains("copy-paste"));
    }

    private static boolean containsAny(String text, Set<String> tokens) {
        if (text == null || text.isBlank()) return false;
        for (String token : tokens) {
            if (text.contains(normalize(token))) return true;
        }
        return false;
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).trim();
    }
}
