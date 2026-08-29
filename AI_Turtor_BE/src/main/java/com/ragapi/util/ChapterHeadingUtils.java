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

    /**
     * Book/publisher metadata, not a studyable lesson. Used for tutor opening chips.
     */
    public static boolean isBookFrontMatterTitle(String title) {
        if (title == null || title.isBlank()) {
            return true;
        }
        String lower = title.trim().toLowerCase(Locale.ROOT)
                .replace('“', ' ')
                .replace('”', ' ')
                .replace('"', ' ')
                .replace('\'', ' ')
                .replaceAll("\\s+", " ")
                .trim();
        String stripped = lower.replaceFirst("^(?:\\d+(?:\\.\\d+)*\\s+)", "");

        if (stripped.matches("(?:table of )?contents")
                || stripped.equals("mục lục")
                || stripped.equals("muc luc")) {
            return true;
        }
        if (stripped.matches("preface|foreword|dedication|colophon|copyright|errata|index|bibliography|credits?")) {
            return true;
        }
        if (stripped.matches("lời nói đầu|loi noi dau|lời giới thiệu|loi gioi thieu|lời cảm ơn|loi cam on")) {
            return true;
        }
        if (stripped.startsWith("copyright ")
                || stripped.startsWith("about the author")
                || stripped.startsWith("about the editor")
                || stripped.startsWith("about the technical editor")
                || stripped.startsWith("about the reviewer")
                || stripped.startsWith("about the publisher")
                || stripped.startsWith("acknowledg")
                || stripped.startsWith("a timeline of")
                || stripped.equals("title page")
                || stripped.equals("main material")
                || stripped.matches("how to use this (?:book|guide).*")
                || stripped.equals("who this book is for")) {
            return true;
        }
        return false;
    }

    public static boolean isStudySuggestionTitle(String title) {
        return isPlausibleChapterTitle(title) && !isBookFrontMatterTitle(title);
    }

    /**
     * A heading that is a definition sentence, not a study unit ("A string is a sequence").
     */
    public static boolean isSentenceLikeHeading(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String trimmed = title.trim().replaceAll("\\s+", " ");
        return trimmed.matches("(?i)^(?:\\d+(?:\\.\\d+)*\\s+)?(?:a|an|the)\\s+.+\\s+(?:is|are|was|were)\\b.*");
    }

    public static boolean isCourseOverviewChip(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String lower = title.trim().toLowerCase(Locale.ROOT);
        return lower.contains("gồm những nội dung nào")
                || lower.contains("gom nhung noi dung nao")
                || lower.contains("nên học gì trước")
                || lower.contains("nen hoc gi truoc")
                || lower.contains("tóm tắt lộ trình môn")
                || lower.contains("tom tat lo trinh mon");
    }

    /** Clickable tutor opening chip: a real unit to start studying, not TOC noise. */
    public static boolean isStudyUnitTitle(String title) {
        return isStudySuggestionTitle(title)
                && !isSentenceLikeHeading(title)
                && !isCourseOverviewChip(title);
    }
}
