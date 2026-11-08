package com.ragapi.service.adaptive;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/** Small value helpers shared by the adaptive learning review pieces. */
public final class AdaptiveReviewValues {
    public static final Set<String> LEVELS = Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");

    private static final Pattern COMPLETE_REASONING_BLOCK = Pattern.compile(
            "(?is)<(?:think|thinking|analysis|reasoning|redacted_reasoning)>.*?</(?:think|thinking|analysis|reasoning|redacted_reasoning)>"
    );
    private static final Pattern ORPHAN_REASONING_TAG = Pattern.compile(
            "(?is)</?(?:think|thinking|analysis|reasoning|redacted_reasoning)>"
    );
    private static final Pattern MARKDOWN_FENCE = Pattern.compile(
            "(?is)```(?:json|javascript|js)?\\s*|```"
    );
    private static final Pattern SPECIAL_TOKENS = Pattern.compile(
            "(?is)<\\|/?[a-z0-9_]+\\|>"
    );

    private AdaptiveReviewValues() {}

    /**
     * Pulls the first JSON object out of a utility-LLM reply. Models often wrap
     * the payload in {@code ```json} fences, {@code <think>} blocks, or special
     * tokens — strip those tags before looking for {@code {...}}.
     */
    public static String extractJson(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("Empty LLM response");
        String cleaned = raw.trim().replaceFirst("^\uFEFF", "");
        cleaned = COMPLETE_REASONING_BLOCK.matcher(cleaned).replaceAll("\n").trim();
        cleaned = ORPHAN_REASONING_TAG.matcher(cleaned).replaceAll(" ").trim();
        cleaned = SPECIAL_TOKENS.matcher(cleaned).replaceAll(" ").trim();
        cleaned = MARKDOWN_FENCE.matcher(cleaned).replaceAll("\n").trim();

        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("LLM did not return JSON");
        }
        return cleaned.substring(start, end + 1).trim();
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
