package com.ragapi.util;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Lightweight lexical overlap checks so semantically similar but topically
 * different questions (for example Servlet vs JSP) do not share cached answers.
 */
public final class QuestionOverlapUtil {

    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help", "ban", "toi", "tôi",
            "duoc", "được", "khong", "không", "nhu", "như"
    );

    private QuestionOverlapUtil() {
    }

    /**
     * Canonical form for duplicate academic questions: accents stripped, punctuation
     * removed and whitespace collapsed.
     */
    public static String canonicalQuestionKey(String question) {
        if (question == null || question.isBlank()) {
            return "";
        }
        return TextSanitizer.normalizeAccentInsensitive(question)
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * True when two Senior/student questions are the same academic item (exact after
     * canonicalization, or high token overlap). Questions that merely share a broad
     * course keyword remain separate.
     */
    public static boolean isSameAcademicQuestion(String left, String right) {
        String leftKey = canonicalQuestionKey(left);
        String rightKey = canonicalQuestionKey(right);
        if (leftKey.isEmpty() || rightKey.isEmpty()) {
            return false;
        }
        if (leftKey.equals(rightKey)) {
            return true;
        }
        return areSimilarQuestions(left, right, 0.55)
                && keywordOverlapRatio(left, right) >= 0.50;
    }

    public static boolean areSimilarQuestions(String left, String right, double minOverlap) {
        Set<String> leftTokens = meaningfulTokens(left);
        Set<String> rightTokens = meaningfulTokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return false;
        }
        int intersection = 0;
        for (String token : leftTokens) {
            if (rightTokens.contains(token)) {
                intersection++;
            }
        }
        int union = leftTokens.size() + rightTokens.size() - intersection;
        double overlap = union == 0 ? 0.0 : (double) intersection / union;
        if (overlap >= minOverlap) {
            return true;
        }
        int smaller = Math.min(leftTokens.size(), rightTokens.size());
        return smaller >= 2 && intersection >= Math.ceil(smaller * 0.75);
    }

    public static double keywordOverlapRatio(String left, String right) {
        Set<String> leftTokens = meaningfulTokens(left);
        Set<String> rightTokens = meaningfulTokens(right);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return 0.0;
        }
        int intersection = 0;
        for (String token : leftTokens) {
            if (rightTokens.contains(token)) {
                intersection++;
            }
        }
        int union = leftTokens.size() + rightTokens.size() - intersection;
        return union == 0 ? 0.0 : (double) intersection / union;
    }

    /**
     * Directional coverage of the query by a larger body of text. Unlike Jaccard,
     * this remains high when a short concept query occurs inside a long approved answer.
     */
    public static double queryKeywordCoverageRatio(String query, String text) {
        Set<String> queryTokens = meaningfulTokens(query);
        Set<String> textTokens = meaningfulTokens(text);
        if (queryTokens.isEmpty() || textTokens.isEmpty()) {
            return 0.0;
        }
        int matched = 0;
        for (String token : queryTokens) {
            if (textTokens.contains(token)) {
                matched++;
            }
        }
        return (double) matched / queryTokens.size();
    }

    public static double sourceOverlapRatio(java.util.List<String> left, java.util.List<String> right) {
        Set<String> leftSources = normalizeSources(left);
        Set<String> rightSources = normalizeSources(right);
        if (leftSources.isEmpty() || rightSources.isEmpty()) {
            return 0.0;
        }
        int intersection = 0;
        for (String source : leftSources) {
            if (rightSources.contains(source)) {
                intersection++;
            }
        }
        int union = leftSources.size() + rightSources.size() - intersection;
        return union == 0 ? 0.0 : (double) intersection / union;
    }

    private static Set<String> meaningfulTokens(String text) {
        Set<String> tokens = new HashSet<>();
        if (text == null || text.isBlank()) {
            return tokens;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(text).toLowerCase(Locale.ROOT);
        for (String raw : normalized.split("[^\\p{L}\\p{N}]+")) {
            String token = raw.trim();
            if (token.length() < 2 || STOP_WORDS.contains(token)) {
                continue;
            }
            tokens.add(token);
        }
        return tokens;
    }

    private static Set<String> normalizeSources(java.util.List<String> sources) {
        Set<String> normalized = new HashSet<>();
        if (sources == null) {
            return normalized;
        }
        for (String source : sources) {
            if (source == null || source.isBlank()) {
                continue;
            }
            normalized.add(source.trim().toLowerCase(Locale.ROOT));
        }
        return normalized;
    }
}
