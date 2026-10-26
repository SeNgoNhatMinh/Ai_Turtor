package com.ragapi.service.adaptive;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/** Small value helpers shared by the adaptive learning review pieces. */
public final class AdaptiveReviewValues {
    public static final Set<String> LEVELS = Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");

    private AdaptiveReviewValues() {}

    public static String extractJson(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("Empty LLM response");
        String cleaned = raw.trim().replaceFirst("^\uFEFF", "");
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalArgumentException("LLM did not return JSON");
        return cleaned.substring(start, end + 1);
    }

    public static String normalizeLevel(Object value, String fallback) {
        String level = value == null ? "" : value.toString().trim().toUpperCase(Locale.ROOT);
        if (LEVELS.contains(level)) return level;
        String safeFallback = fallback == null ? "STANDARD" : fallback.trim().toUpperCase(Locale.ROOT);
        return LEVELS.contains(safeFallback) ? safeFallback : "STANDARD";
    }

    public static int number(Object value, int fallback) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); }
        catch (Exception ignored) { return fallback; }
    }

    public static String string(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    public static List<String> strings(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().filter(Objects::nonNull).map(String::valueOf)
                .map(String::trim).filter(item -> !item.isBlank()).limit(12).toList();
    }

    public static List<String> safeList(List<String> value) {
        return value == null ? List.of() : value;
    }

    public static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }

    public static String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : truncate(error.getMessage(), 250);
    }

    public static String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
