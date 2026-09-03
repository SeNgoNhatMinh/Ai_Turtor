package com.ragapi.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Local models sometimes narrate the system prompt instead of answering.
 * Those lines must never reach the student chat.
 */
public final class PromptLeakFilter {

    private static final Pattern LEAK_LINE = Pattern.compile(
            "(?i)(?:the prompt says|as per instruction|as instructed|i'?ll omit|i will omit|"
                    + "i don'?t have a numbered|do not have a numbered|numbered path provided|"
                    + "omit as per|wait,?\\s+the prompt|response format|otherwise omit|"
                    + "to be safe,?\\s+or i can|name the next bài|do not output this heading|"
                    + "copy that quiz shape|local model:|never mention routing|"
                    + "i can just (?:include|leave|omit|not include)|leave it blank as instructed|"
                    + "or i can just include the heading|include the heading|"
                    + "actually,?\\s+the prompt|numbered lesson path)"
    );
    private static final Pattern QUOTED_HEADING = Pattern.compile(
            "^\\s*[-*+]?\\s*[\"'`“”]+#{1,6}\\s*"
    );
    private static final Pattern PAREN_INSTRUCTION = Pattern.compile(
            "(?is)\\(\\s*(?:Omit as per|Wait,?\\s+the prompt|The prompt says|as per instruction|"
                    + "Actually,?\\s+the prompt)[\\s\\S]*?\\)"
    );
    private static final Pattern NEXT_HEADING = Pattern.compile(
            "(?im)^#{1,6}\\s*bài tiếp theo\\s*$"
    );
    private static final Pattern ANY_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");
    private static final Pattern VALID_NEXT_BULLET = Pattern.compile(
            "(?im)^\\s*[-*+]?\\s*(?:bài|bai)\\s+\\d+\\s*[:：.\\-\u2013\u2014]"
    );

    private PromptLeakFilter() {
    }

    public static boolean isLeakLine(String line) {
        if (line == null) {
            return false;
        }
        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        if (LEAK_LINE.matcher(trimmed).find()) {
            return true;
        }
        return QUOTED_HEADING.matcher(trimmed).find();
    }

    public static String strip(String answer) {
        if (answer == null || answer.isBlank()) {
            return answer;
        }
        String withoutParens = PAREN_INSTRUCTION.matcher(answer).replaceAll("");
        StringBuilder kept = new StringBuilder();
        for (String line : withoutParens.split("\\R", -1)) {
            if (isLeakLine(line)) {
                continue;
            }
            if (!kept.isEmpty()) {
                kept.append('\n');
            }
            kept.append(line);
        }
        return dropBrokenNextLesson(kept.toString().replaceAll("\\n{3,}", "\n\n").trim());
    }

    public static boolean hasValidNextLesson(String answer) {
        Section section = findNextLessonSection(answer);
        return section != null && VALID_NEXT_BULLET.matcher(section.body).find();
    }

    public static String dropBrokenNextLesson(String answer) {
        Section section = findNextLessonSection(answer);
        if (section == null) {
            return answer;
        }
        if (VALID_NEXT_BULLET.matcher(section.body).find()) {
            return answer;
        }
        String without = answer.substring(0, section.headingStart) + answer.substring(section.end);
        return without.replaceAll("\\n{3,}", "\n\n").trim();
    }

    public static String dropNextLesson(String answer) {
        Section section = findNextLessonSection(answer);
        if (section == null) {
            return answer;
        }
        String without = answer.substring(0, section.headingStart) + answer.substring(section.end);
        return without.replaceAll("\\n{3,}", "\n\n").trim();
    }

    public static String insertNextLesson(String answer, String bullet) {
        if (bullet == null || bullet.isBlank()) {
            return answer;
        }
        String safe = answer == null ? "" : answer;
        String block = "## Bài tiếp theo\n" + bullet.trim() + "\n";
        if (hasValidNextLesson(safe)) {
            return safe;
        }
        safe = dropBrokenNextLesson(safe);
        Matcher sources = Pattern.compile("(?im)^#{1,6}\\s*nguồn tài liệu đã dùng\\s*$").matcher(safe);
        if (sources.find()) {
            return (safe.substring(0, sources.start()).stripTrailing()
                    + "\n\n" + block + "\n"
                    + safe.substring(sources.start())).replaceAll("\\n{3,}", "\n\n").trim();
        }
        return (safe.stripTrailing() + "\n\n" + block).replaceAll("\\n{3,}", "\n\n").trim();
    }

    /** Always use the stored-path bullet, even if the model already wrote a different Bài. */
    public static String replaceNextLesson(String answer, String bullet) {
        return insertNextLesson(dropNextLesson(answer), bullet);
    }

    /**
     * Normal Q&amp;A must not keep a numbered curriculum. Those headings belong only to
     * LEARNING_PATH / LESSON_TEACH turns.
     */
    public static String stripNumberedCurriculum(String answer) {
        if (answer == null || answer.isBlank()) {
            return answer;
        }
        String result = answer;
        result = dropHeadingSection(result, "(?im)^#{1,6}\\s*lộ trình học\\s*$");
        result = dropHeadingSection(result, "(?im)^#{1,6}\\s*bắt đầu thế nào\\s*$");
        result = dropHeadingSection(result, "(?im)^#{1,6}\\s*bài tiếp theo\\s*$");
        return result.replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static String dropHeadingSection(String answer, String headingRegex) {
        Matcher heading = Pattern.compile(headingRegex).matcher(answer);
        if (!heading.find()) {
            return answer;
        }
        int start = heading.start();
        String rest = answer.substring(heading.end());
        Matcher next = ANY_HEADING.matcher(rest);
        int end = next.find() ? heading.end() + next.start() : answer.length();
        String without = answer.substring(0, start) + answer.substring(end);
        return without.replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static Section findNextLessonSection(String answer) {
        if (answer == null || answer.isBlank()) {
            return null;
        }
        Matcher heading = NEXT_HEADING.matcher(answer);
        if (!heading.find()) {
            return null;
        }
        int bodyStart = heading.end();
        String rest = answer.substring(bodyStart);
        Matcher next = ANY_HEADING.matcher(rest);
        int end = next.find() ? bodyStart + next.start() : answer.length();
        return new Section(heading.start(), end, answer.substring(bodyStart, end));
    }

    private record Section(int headingStart, int end, String body) {
    }
}
