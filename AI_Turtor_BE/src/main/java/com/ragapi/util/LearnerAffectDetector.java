package com.ragapi.util;

import java.util.Locale;

/**
 * Rule-based temporary interaction signals. These are uncertain conversational
 * cues, never academic ability judgments.
 */
public final class LearnerAffectDetector {

    private LearnerAffectDetector() {
    }

    public static String detect(String question, String recentHistory, String understandingSignals) {
        String text = ((question == null ? "" : question) + "\n"
                + (recentHistory == null ? "" : recentHistory) + "\n"
                + (understandingSignals == null ? "" : understandingSignals))
                .toLowerCase(Locale.ROOT);

        if (containsAny(text, "chán", "nhàm", "mệt quá", "bored", "skip đi")) {
            return "BORED";
        }
        if (containsAny(text, "bực", "ức", "đau đầu", "frustrated", "khó chịu", "bỏ đi")) {
            return "FRUSTRATED";
        }
        if (containsAny(text, "lo", "sợ", "áp lực", "anxious", "panic")) {
            return "ANXIOUS";
        }
        if (containsAny(text, "không hiểu", "chưa hiểu", "confused", "lại đi", "giải thích lại",
                "em lạc", "bối rối")) {
            return "CONFUSED";
        }
        if (containsAny(text, "tò mò", "tại sao", "what if", "deep dive", "curious", "hơn nữa")) {
            return "CURIOUS";
        }
        if (containsAny(text, "em hiểu rồi", "ok ạ", "đã rõ", "confident", "làm được")) {
            return "CONFIDENT";
        }
        if (understandingSignals != null) {
            String signals = understandingSignals.toLowerCase(Locale.ROOT);
            long wrong = countOccurrences(signals, "sai") + countOccurrences(signals, "wrong");
            long correct = countOccurrences(signals, "đúng") + countOccurrences(signals, "correct");
            if (wrong >= 2 && wrong > correct) return "CONFUSED";
            if (correct >= 2 && correct > wrong) return "CONFIDENT";
        }
        return "NEUTRAL";
    }

    private static boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }

    private static long countOccurrences(String text, String needle) {
        if (text == null || needle == null || needle.isEmpty()) return 0;
        long count = 0;
        int index = 0;
        while ((index = text.indexOf(needle, index)) >= 0) {
            count++;
            index += needle.length();
        }
        return count;
    }
}
