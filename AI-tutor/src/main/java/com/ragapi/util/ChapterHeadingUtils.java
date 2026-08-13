package com.ragapi.util;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Filters PDF-extraction noise from plausible course chapter headings.
 */
public final class ChapterHeadingUtils {

    private static final Pattern HAS_SUBSTANTIVE_WORD = Pattern.compile("\\p{L}{4,}");
    private static final Pattern STARTS_WITH_LETTER = Pattern.compile("^(?:\\d{1,2}(?:\\.\\d+)*\\s+)?\\p{L}.*");

    private ChapterHeadingUtils() {
    }

    public static boolean isPlausibleChapterTitle(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String trimmed = title.trim();
        if (trimmed.length() < 4 || trimmed.length() > 120) {
            return false;
        }
        if (!STARTS_WITH_LETTER.matcher(trimmed).matches()) {
            return false;
        }
        if (!HAS_SUBSTANTIVE_WORD.matcher(trimmed).find()) {
            return false;
        }

        long letters = trimmed.chars().filter(Character::isLetter).count();
        long digits = trimmed.chars().filter(Character::isDigit).count();
        if (letters < 4) {
            return false;
        }
        if (digits > 0 && digits >= letters) {
            return false;
        }

        String[] tokens = trimmed.split("\\s+");
        if (tokens.length == 0) {
            return false;
        }

        int singleDigitTokens = 0;
        int numericTokens = 0;
        for (String token : tokens) {
            if (token.matches("\\d")) {
                singleDigitTokens++;
            }
            if (token.matches("\\d+(?:\\.\\d+)?")) {
                numericTokens++;
            }
        }
        if (singleDigitTokens >= 3) {
            return false;
        }
        if (tokens.length >= 4 && numericTokens >= (tokens.length + 1) / 2) {
            return false;
        }

        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.matches("^(?:read\\s+only|free\\s+blocks?)(?:\\s+\\d+)*$")) {
            return false;
        }

        return true;
    }
}
