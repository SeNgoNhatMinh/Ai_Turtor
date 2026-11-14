package com.ragapi.service.behavior;

import com.ragapi.util.EmbeddingSimilarityUtil;

import java.text.Normalizer;
import java.util.*;

/** Text normalization and similarity shared by the behavior services. */
final class BehaviorText {

    private BehaviorText() {}

    static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static <T> List<T> safe(List<T> value) {
        return value == null ? List.of() : value;
    }

    /** Trimmed, de-duplicated (case-insensitive), length-capped list. */
    static List<String> cleanList(List<String> values, int maxItems, int maxLength) {
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String value : safe(values)) {
            if (value == null) continue;
            String text = value.trim().replaceAll("\\s+", " ");
            if (text.isEmpty()) continue;
            if (text.length() > maxLength) text = text.substring(0, maxLength).trim();
            unique.putIfAbsent(text.toLowerCase(Locale.ROOT), text);
            if (unique.size() >= maxItems) break;
        }
        return new ArrayList<>(unique.values());
    }

    /** Newest values first, then the older ones, without duplicates. */
    static List<String> mergeNewestFirst(List<String> newest, List<String> older, int maxItems, int maxLength) {
        List<String> combined = new ArrayList<>(safe(newest));
        combined.addAll(safe(older));
        return cleanList(combined, maxItems, maxLength);
    }

    static String normalizedKey(String text) {
        if (text == null) return "";
        String folded = Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd');
        return folded.replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** Cosine on embeddings when both exist, otherwise token overlap (Jaccard). */
    static double similarity(List<Float> leftEmbedding, String leftText,
                             List<Float> rightEmbedding, String rightText) {
        if (leftEmbedding != null && !leftEmbedding.isEmpty()
                && rightEmbedding != null && leftEmbedding.size() == rightEmbedding.size()) {
            return EmbeddingSimilarityUtil.cosineSimilarity(leftEmbedding, rightEmbedding);
        }
        return lexicalSimilarity(leftText, rightText);
    }

    static double lexicalSimilarity(String left, String right) {
        Set<String> leftTokens = tokens(left);
        Set<String> rightTokens = tokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) return 0.0;
        Set<String> intersection = new HashSet<>(leftTokens);
        intersection.retainAll(rightTokens);
        Set<String> union = new HashSet<>(leftTokens);
        union.addAll(rightTokens);
        return (double) intersection.size() / union.size();
    }

    private static Set<String> tokens(String text) {
        Set<String> result = new HashSet<>();
        for (String token : normalizedKey(text).split(" ")) {
            if (token.length() >= 2) result.add(token);
        }
        return result;
    }
}
