package com.ragapi.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Filters PDF-extraction noise from plausible course chapter headings.
 */
public final class ChapterHeadingUtils {

    private static final Pattern HAS_SUBSTANTIVE_WORD = Pattern.compile("\\p{L}{4,}");
    private static final Pattern STARTS_WITH_LETTER = Pattern.compile("^(?:\\d{1,2}(?:\\.\\d+)*\\s+)?\\p{L}.*");
    private static final Pattern INTERNAL_KNOWLEDGE_LABEL = Pattern.compile(
            "(?i)(?:senior-approved(?:\\s+knowledge|\\s+v2(?:\\s+gold\\s+q&a)?)?|gold\\s+q&a)\\s*:\\s*"
    );
    private static final Pattern STRUCTURAL_PREFIX = Pattern.compile(
            "(?i)^(?:chapter|chương|chuong|part|phần|phan|section|mục|muc)\\s+"
                    + "(?:\\d+(?:\\.\\d+)*|[ivxlcdm]+)\\s*[:.\\-–—]\\s*"
    );
    private static final Pattern OUTLINE_NUMBER_PREFIX = Pattern.compile(
            "^\\d+(?:\\.\\d+)*\\s+(?=\\p{L})"
    );
    private static final Pattern LEADING_FILLER = Pattern.compile(
            "(?i)^(?:what(?:'s| is| are)|an introduction to|introduction to|introducing|"
                    + "understanding|overview of|a guide to|guide to|using)\\s+"
    );
    private static final Pattern CHAPTER_WORD_NUMBER = Pattern.compile(
            "(?i)^(?:chapter|chương|chuong|ch\\.)\\s*:?\\s*(\\d+)\\b"
    );
    private static final Pattern CHAPTER_ROMAN_ONE = Pattern.compile(
            "(?i)^(?:chapter|chương|chuong)\\s+i\\b"
    );
    private static final Pattern LEADING_OUTLINE_NUMBER = Pattern.compile(
            "^(\\d+)(?:\\.\\d+)*\\b"
    );
    private static final Pattern TRAILING_BACK_MATTER = Pattern.compile(
            "(?i)^(?:appendix|phụ lục|phu luc|apêndice)\\b.*"
                    + "|(?i)^(?:answers?(?:\\s+to)?|solutions?(?:\\s+to)?|đáp án|dap an|lời giải|loi giai)\\b.*"
                    + "|(?i)^(?:further reading|recommended reading|tài liệu tham khảo|tai lieu tham khao)\\b.*"
                    + "|(?i)^(?:chapter|chương|chuong)\\s+\\d+\\b.*\\b(?:appendix|phụ lục|phu luc|glossary|bibliography|references)\\b.*"
    );

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
        if (stripped.matches("preface|foreword|dedication|colophon|copyright|errata|index|bibliography|credits?"
                + "|glossary|references|afterword|epilogue|advertisement|cover|title page")) {
            return true;
        }
        // Lone book bookends — not a study unit. Keep "Introduction to Servlets", etc.
        if (stripped.matches("introduction|summary|overview|conclusion|giới thiệu|gioi thieu|tóm tắt|tom tat"
                + "|kết luận|ket luan|further reading|recommended reading|resources?")) {
            return true;
        }
        if (stripped.matches("lời nói đầu|loi noi dau|lời giới thiệu|loi gioi thieu|lời cảm ơn|loi cam on")) {
            return true;
        }
        if (stripped.equals("contributions")
                || stripped.equals("contributors")
                || stripped.startsWith("contributor list")
                || stripped.startsWith("contributors list")
                || stripped.startsWith("contribution list")
                || stripped.startsWith("list of contributors")
                || stripped.startsWith("list of contribution")
                || stripped.contains("contributor list")
                || stripped.contains("contributors list")
                || stripped.contains("list of contributors")
                || stripped.contains("contributors for python")
                || stripped.matches("(?:[a-z]\\.)?\\d+(?:\\.\\d+)*\\s+contributor.*")
                || stripped.matches("appendix\\s+[a-z0-9.]*\\s*contributor.*")
                || stripped.matches("phụ lục\\s*.*contributor.*")
                || stripped.matches("phu luc\\s*.*contributor.*")) {
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
                || stripped.equals("outline of the book")
                || stripped.startsWith("a roadmap for")
                || stripped.startsWith("roadmap for")
                || stripped.matches("why study\\b.*")
                || stripped.contains("internet and web resources")
                || stripped.contains("for readers and instructors")
                || stripped.startsWith("how to use this")
                || stripped.startsWith("how to read this")
                || stripped.startsWith("organization of this book")
                || stripped.startsWith("to the student")
                || stripped.startsWith("to the instructor")
                || stripped.equals("who this book is for")
                || stripped.equals("who this book is not for")
                || stripped.startsWith("who this book is ")
                || stripped.startsWith("what this book")
                || stripped.startsWith("what you will")
                || stripped.startsWith("what this book covers")
                || stripped.startsWith("how this book")
                || stripped.contains("used in this book")
                || stripped.endsWith(" in this book")
                || stripped.contains("typographical convention")
                || stripped.matches("conventions?")
                || stripped.startsWith("advertisement")
                || stripped.startsWith("praise for")
                || stripped.startsWith("also available")
                || stripped.startsWith("other books")
                || stripped.startsWith("related titles")
                // Book part dividers / cover titles, not study units.
                || stripped.matches("part\\s+(?:[ivxlcdm]+|\\d+)\\b.*")
                || stripped.matches("phần\\s+(?:[ivxlcdm]+|\\d+)\\b.*")
                || stripped.matches("phan\\s+(?:[ivxlcdm]+|\\d+)\\b.*")
                || stripped.startsWith("professional:")
                || stripped.startsWith("professional java")
                || stripped.contains("®")
                || stripped.matches(".*\\bfor web applications\\b.*")
                || stripped.matches(".*\\bbeginner(?:'s)? guide\\b.*")
                || stripped.matches(".*\\bcomplete reference\\b.*")) {
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

    /** Titles the review workflow writes onto indexed notes. They are not textbook chapters. */
    public static boolean isInternalKnowledgeTitle(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String lower = title.trim().toLowerCase(Locale.ROOT);
        return lower.startsWith("senior-approved")
                || lower.startsWith("gold q&a")
                || lower.startsWith("gold qa");
    }

    /** Removes the review-workflow label. A blank remainder becomes a neutral supplement label. */
    public static String studentFacingTitle(String title) {
        if (title == null || title.isBlank()) {
            return "";
        }
        String stripped = INTERNAL_KNOWLEDGE_LABEL.matcher(title).replaceAll("")
                .replaceAll("\\s{2,}", " ")
                .trim();
        if (stripped.isBlank() || isInternalKnowledgeTitle(stripped)) {
            return "Kiến thức bổ sung";
        }
        return stripped;
    }

    /**
     * Book-index heading rewritten as the subject a student can read.
     * "Chapter 19: Introducing Java Persistence API and Hibernate ORM"
     * becomes "Java Persistence API and Hibernate ORM".
     * The original heading stays on the lesson for retrieval.
     */
    public static String plainStudyTitle(String title) {
        if (title == null || title.isBlank()) {
            return "";
        }
        String current = studentFacingTitle(title);
        if ("Kiến thức bổ sung".equals(current)) {
            return current;
        }
        String previous;
        do {
            previous = current;
            current = STRUCTURAL_PREFIX.matcher(current).replaceFirst("").trim();
        } while (!current.equals(previous) && !current.isBlank());
        current = OUTLINE_NUMBER_PREFIX.matcher(current).replaceFirst("").trim();
        String withoutFiller = LEADING_FILLER.matcher(current).replaceFirst("").trim();
        if (withoutFiller.length() >= 3 && withoutFiller.codePoints().anyMatch(Character::isLetter)) {
            current = withoutFiller;
        }
        current = current.replaceAll("[?？]\\s*$", "").replaceAll("\\s{2,}", " ").trim();
        if (current.length() < 3) {
            return title.trim();
        }
        return current;
    }

    /** Clickable tutor opening chip: a real unit to start studying, not TOC noise. */
    public static boolean isStudyUnitTitle(String title) {
        return isStudySuggestionTitle(title)
                && !isSentenceLikeHeading(title)
                && !isCourseOverviewChip(title);
    }

    /**
     * Study chips start at chapter 1 and stop before back matter.
     * Titles before the first chapter numbered 1 or higher are the book opening.
     * A trailing run of appendices, answer keys, and reference lists is dropped.
     * When nothing is numbered, the list is kept aside from that trailing run.
     */
    public static List<String> studySuggestionRange(List<String> titles) {
        if (titles == null || titles.isEmpty()) {
            return List.of();
        }
        int start = 0;
        for (int i = 0; i < titles.size(); i++) {
            Integer number = studyChapterNumber(titles.get(i));
            if (number != null && number >= 1) {
                start = i;
                break;
            }
        }
        int end = titles.size();
        while (end > start && isTrailingBackMatter(titles.get(end - 1))) {
            end--;
        }
        if (start >= end) {
            return List.of();
        }
        return List.copyOf(new ArrayList<>(titles.subList(start, end)));
    }

    /**
     * Top-level chapter number from "Chapter 1", "Chương 1", "Chapter I", or "1.2 …".
     * Returns null when the title is not numbered.
     */
    public static Integer studyChapterNumber(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        String trimmed = title.trim();
        Matcher word = CHAPTER_WORD_NUMBER.matcher(trimmed);
        if (word.find()) {
            return Integer.valueOf(word.group(1));
        }
        if (CHAPTER_ROMAN_ONE.matcher(trimmed).find()) {
            return 1;
        }
        Matcher leading = LEADING_OUTLINE_NUMBER.matcher(trimmed);
        if (leading.find()) {
            return Integer.valueOf(leading.group(1));
        }
        return null;
    }

    /** Appendix, answer key, or reference list that follows the last study chapter. */
    public static boolean isTrailingBackMatter(String title) {
        if (title == null || title.isBlank()) {
            return true;
        }
        if (isBookFrontMatterTitle(title)) {
            return true;
        }
        String stripped = title.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return TRAILING_BACK_MATTER.matcher(stripped).matches();
    }
}
