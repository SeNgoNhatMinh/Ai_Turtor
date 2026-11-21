package com.ragapi.harness.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Last-line guard for {@link TutorAddress#RULE}: removes source lead-ins such as
 * "Từ trong chương 4," and pronoun openers such as "Em cần ..." from student-facing prose.
 * Fenced code blocks and inline code are never touched.
 */
public final class StudentVoiceFilter {

    private static final int FLAGS = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;

    /** Start of a sentence: line start (after a bullet / number / heading marker) or after . ! ? */
    private static final String SENTENCE_START =
            "(^\\s*(?:[-*+]\\s+|\\d+[.)]\\s+|#{1,6}\\s+(?:\\d+\\.\\s*)?)?|[.!?]\\s+)";

    private static final String SOURCE_NOUN =
            "(?:chương|giáo trình|tài liệu(?:\\s+môn\\s+học)?|sách|bài học|slide)";

    /** "Từ trong chương 4,", "Theo tài liệu:", "Dựa trên giáo trình,", "Trong chương 3 có nói," ... */
    private static final Pattern SOURCE_LEAD_IN = Pattern.compile(
            SENTENCE_START
                    + "(?:từ\\s+trong|từ|theo(?:\\s+như)?|trong|dựa\\s+(?:trên|vào)|như\\s+(?:trong|đã\\s+nêu\\s+trong))\\s+"
                    + "(?:nội\\s+dung\\s+)?" + SOURCE_NOUN
                    + "(?:\\s+(?:số\\s+)?[\\p{N}IVXivx]+[\\p{N}.]*)?"
                    + "(?:\\s+(?:có\\s+nói|cho\\s+biết|đã\\s+nêu|đề\\s+cập|nêu\\s+rõ|nói\\s+rằng|ghi\\s+rằng|thì))?"
                    + "(?:\\s+rằng)?\\s*[,:]\\s*",
            FLAGS | Pattern.MULTILINE);

    /** "Chương 4 cho biết:", "Tài liệu nêu rằng," ... */
    private static final Pattern SOURCE_SUBJECT_LEAD_IN = Pattern.compile(
            SENTENCE_START
                    + SOURCE_NOUN + "(?:\\s+(?:số\\s+)?[\\p{N}IVXivx]+[\\p{N}.]*)?\\s+"
                    + "(?:cho\\s+biết|có\\s+nói|đã\\s+nêu|nêu|đề\\s+cập|giải\\s+thích|nói)(?:\\s+rằng)?\\s*[,:]\\s*",
            FLAGS | Pattern.MULTILINE);

    /** "Em cần ...", "Bạn có thể ...", "Chúng ta hãy ..." -> "Cần ...", "Có thể ...", "Hãy ..." */
    private static final Pattern PRONOUN_OPENER = Pattern.compile(
            SENTENCE_START
                    + "(?:các\\s+em|các\\s+bạn|chúng\\s+ta|em|bạn|mình|ta)\\s+"
                    + "(?=(?:có\\s+thể|cần|nên|hãy|phải|sẽ|chỉ\\s+cần|đừng|không\\s+nên|cũng\\s+cần|lưu\\s+ý|chú\\s+ý|thử)(?!\\p{L}))",
            FLAGS | Pattern.MULTILINE);

    /** "Em ơi,", "Bạn ơi!", "Chào em,", "Xin chào các bạn." at the start of a sentence. */
    private static final Pattern VOCATIVE_OPENER = Pattern.compile(
            SENTENCE_START
                    + "(?:(?:xin\\s+)?chào\\s+(?:các\\s+)?(?:em|bạn)|(?:các\\s+)?(?:em|bạn)\\s+ơi)\\s*[,!.:]?\\s*",
            FLAGS | Pattern.MULTILINE);

    /** Vocatives inside a sentence: ", em ơi", " nhé em", ", bạn nhé" -> dropped (keeping "nhé"). */
    private static final Pattern VOCATIVE_INLINE = Pattern.compile(
            "\\s*,?\\s+(?:các\\s+)?(?:em|bạn)\\s+ơi(?=\\s*[,.!?:]|\\s*$)",
            FLAGS | Pattern.MULTILINE);
    private static final Pattern VOCATIVE_TAIL = Pattern.compile(
            "(?:,\\s*(?:các\\s+)?(?:em|bạn)(?=\\s+nhé)|(?<=nhé)\\s+(?:các\\s+)?(?:em|bạn))(?=\\s*[,.!?]|\\s+nhé|\\s*$)",
            FLAGS | Pattern.MULTILINE);

    private static final Pattern FENCE = Pattern.compile("(?ms)^\\s*```.*?^\\s*```[^\\n]*$");
    private static final Pattern INLINE_CODE = Pattern.compile("`[^`\\n]+`");

    private StudentVoiceFilter() {
    }

    public static String clean(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return markdown;
        }
        StringBuilder out = new StringBuilder();
        Matcher fence = FENCE.matcher(markdown);
        int cursor = 0;
        while (fence.find()) {
            out.append(cleanProse(markdown.substring(cursor, fence.start())));
            out.append(fence.group());
            cursor = fence.end();
        }
        out.append(cleanProse(markdown.substring(cursor)));
        return out.toString();
    }

    private static String cleanProse(String text) {
        if (text.isBlank()) {
            return text;
        }
        // Protect inline code so identifiers such as `em` are never rewritten.
        java.util.List<String> codes = new java.util.ArrayList<>();
        Matcher inline = INLINE_CODE.matcher(text);
        StringBuilder masked = new StringBuilder();
        while (inline.find()) {
            codes.add(inline.group());
            inline.appendReplacement(masked, Matcher.quoteReplacement("\u0000" + (codes.size() - 1) + "\u0000"));
        }
        inline.appendTail(masked);

        String result = masked.toString();
        result = dropAndCapitalize(SOURCE_LEAD_IN, result);
        result = dropAndCapitalize(SOURCE_SUBJECT_LEAD_IN, result);
        result = dropAndCapitalize(VOCATIVE_OPENER, result);
        result = VOCATIVE_INLINE.matcher(result).replaceAll("");
        result = VOCATIVE_TAIL.matcher(result).replaceAll("");
        result = dropAndCapitalize(PRONOUN_OPENER, result);

        for (int i = 0; i < codes.size(); i++) {
            result = result.replace("\u0000" + i + "\u0000", codes.get(i));
        }
        return result;
    }

    /** Keeps the sentence-start prefix (group 1), drops the match, and capitalizes the next letter. */
    private static String dropAndCapitalize(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        StringBuilder out = new StringBuilder();
        int cursor = 0;
        while (matcher.find()) {
            if (matcher.end() == matcher.start() + (matcher.group(1) == null ? 0 : matcher.group(1).length())) {
                continue;
            }
            out.append(text, cursor, matcher.start());
            out.append(matcher.group(1) == null ? "" : matcher.group(1));
            cursor = matcher.end();
            if (cursor < text.length() && Character.isLetter(text.charAt(cursor))) {
                out.append(Character.toUpperCase(text.charAt(cursor)));
                cursor++;
            }
        }
        out.append(text.substring(cursor));
        return out.toString();
    }
}
