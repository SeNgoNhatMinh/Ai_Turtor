package com.ragapi.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Local models often emit A/B/C for "## Kiểm tra hiểu" but omit {@code Đáp án:}.
 * The student UI grades from that line, so we recover a key from loose wording
 * or a two-line LLM patch and insert it into the markdown.
 */
public final class UnderstandingCheckKeyCompleter {

    private static final Pattern CHECK_HEADING = Pattern.compile(
            "(?ium)^#{1,6}\\s*(?:kiểm tra hiểu|understanding check)\\s*$");
    private static final Pattern NEXT_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");
    private static final Pattern OPTIONS = Pattern.compile(
            "(?i)(?:^|\\s)(?:\\(([A-D])\\)|([A-D])\\.)\\s+");
    private static final Pattern ANSWER_KEY = Pattern.compile(
            "(?iu)(?:đáp án|dap an|(?:the\\s+)?(?:correct\\s+)?answer)"
                    + "(?:\\s+đúng)?\\s*(?:là|is|:|：|-)?\\s*([A-D])\\b");
    private static final Pattern CANONICAL_ANSWER_LINE = Pattern.compile(
            "(?ium)^\\s*(?:đáp án|dap an|(?:the\\s+)?(?:correct\\s+)?answer)"
                    + "\\s*(?:đúng\\s*)?(?:là|is|:|：|-)?\\s*([A-D])\\b");
    private static final Pattern LEAKED = Pattern.compile(
            "(?iu)nếu bạn chọn(?:\\s+đáp án)?\\s+([A-D])\\b");
    private static final Pattern CHOOSE = Pattern.compile(
            "(?iu)(?:chọn|choose|pick)\\s+(?:đáp án\\s+)?([A-D])\\b");
    private static final Pattern LONE_KEY = Pattern.compile("(?im)^\\s*([A-D])\\s*[.)]?\\s*$");
    private static final Pattern EXPLAIN = Pattern.compile(
            "(?ium)^\\s*(?:giải thích|giai thich|explanation|lý do|ly do)\\s*[:：]\\s*(.+)$");

    private UnderstandingCheckKeyCompleter() {
    }

    public static String completeLocally(String answer) {
        Section section = findSection(answer);
        if (section == null || !hasOptions(section.body) || hasCanonicalAnswerLine(section.body)) {
            return answer;
        }
        String key = extractKey(section.body);
        if (key == null) {
            return answer;
        }
        return insertAnswerLine(answer, section, key, extractExplanation(section.body));
    }

    public static boolean missingAnswerKey(String answer) {
        Section section = findSection(answer);
        if (section == null || !hasOptions(section.body)) {
            return false;
        }
        return extractKey(section.body) == null;
    }

    public static String patchPrompt(String answer) {
        Section section = findSection(answer);
        String body = section == null ? "" : section.body;
        return """
                The multiple-choice check below is missing its answer key.
                Reply with EXACTLY two lines and nothing else:
                Đáp án: <A or B or C>
                Giải thích: <one short Vietnamese sentence>

                QUIZ:
                %s
                """.formatted(body.isBlank() ? "(empty)" : body);
    }

    public static String applyPatch(String answer, String patch) {
        if (answer == null || answer.isBlank() || patch == null || patch.isBlank()) {
            return answer;
        }
        Section section = findSection(answer);
        if (section == null || (hasCanonicalAnswerLine(section.body) && extractKey(section.body) != null)) {
            return answer;
        }
        String key = extractKey(patch);
        if (key == null) {
            return answer;
        }
        return insertAnswerLine(answer, section, key, extractExplanation(patch));
    }

    private static Section findSection(String answer) {
        if (answer == null || answer.isBlank()) {
            return null;
        }
        Matcher heading = CHECK_HEADING.matcher(answer);
        if (!heading.find()) {
            return null;
        }
        int bodyStart = heading.end();
        while (bodyStart < answer.length() && answer.charAt(bodyStart) == '\n') {
            bodyStart++;
        }
        String rest = answer.substring(bodyStart);
        Matcher next = NEXT_HEADING.matcher(rest);
        int bodyEnd = next.find() ? bodyStart + next.start() : answer.length();
        return new Section(heading.start(), bodyStart, bodyEnd, answer.substring(bodyStart, bodyEnd).trim());
    }

    private static boolean hasOptions(String body) {
        Matcher matcher = OPTIONS.matcher(body);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count >= 2;
    }

    private static boolean hasCanonicalAnswerLine(String body) {
        return CANONICAL_ANSWER_LINE.matcher(body).find();
    }

    static String extractKey(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher answer = ANSWER_KEY.matcher(text);
        if (answer.find()) {
            return answer.group(1).toUpperCase();
        }
        Matcher leaked = LEAKED.matcher(text);
        if (leaked.find()) {
            return leaked.group(1).toUpperCase();
        }
        Matcher choose = CHOOSE.matcher(text);
        if (choose.find()) {
            return choose.group(1).toUpperCase();
        }
        Matcher lone = LONE_KEY.matcher(text);
        String lastLone = null;
        while (lone.find()) {
            lastLone = lone.group(1).toUpperCase();
        }
        return lastLone;
    }

    private static String extractExplanation(String text) {
        if (text == null) {
            return "";
        }
        Matcher matcher = EXPLAIN.matcher(text);
        String last = "";
        while (matcher.find()) {
            last = matcher.group(1).trim();
        }
        return last;
    }

    private static String insertAnswerLine(String answer, Section section, String key, String explanation) {
        StringBuilder insert = new StringBuilder();
        if (!section.body.isBlank() && !section.body.endsWith("\n")) {
            insert.append('\n');
        }
        insert.append("Đáp án: ").append(key);
        if (explanation != null && !explanation.isBlank() && !EXPLAIN.matcher(section.body).find()) {
            insert.append('\n').append("Giải thích: ").append(explanation.trim());
        }
        insert.append('\n');
        return answer.substring(0, section.bodyEnd) + insert + answer.substring(section.bodyEnd);
    }

    private record Section(int headingStart, int bodyStart, int bodyEnd, String body) {
    }
}
