package com.ragapi.harness.util;

import com.ragapi.harness.answer.generation.SupportLevelPrompt;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Guarantees exactly one "## Bài tập có hướng dẫn" section with fillable ____ blanks in a taught answer,
 * at every support level. The web client waits for this exercise and the quiz before it asks for a review.
 */
public final class GuidedPracticeGuard {

    private static final Pattern PRACTICE_HEADING = Pattern.compile(
            "(?imu)^#{1,6}\\s*(?:\\d+\\.\\s*)?bài tập có hướng dẫn\\s*$");
    private static final Pattern ANY_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");
    private static final Pattern SOURCES_HEADING = Pattern.compile(
            "(?imu)^#{1,6}\\s*(?:\\d+\\.\\s*)?nguồn tài liệu(?: đã dùng)?\\s*$");
    private static final Pattern BLANK = Pattern.compile("_{3,}");
    private static final Pattern LESSON_PREFIX = Pattern.compile(
            "(?iu)^\\s*(?:bắt đầu|đào sâu)\\s+bài\\s+\\d+\\s*[:：-]\\s*");
    /** Wording of the curriculum starter suggestions around the actual topic. */
    private static final Pattern REQUEST_PREFIX = Pattern.compile(
            "(?iu)^\\s*(?:tôi muốn tìm hiểu(?: về)?|giải thích(?: cho tôi)?(?: về)?|hướng dẫn tôi thực hành"
                    + "|cho tôi bài tập luyện tập về|kiểm tra kiến thức của tôi về|nay mình học|mình muốn học"
                    + "|em muốn học|ôn tập phần)\\s+");
    private static final Pattern NUMBERED_LESSON = Pattern.compile("(?iu)^\\s*(?:bài|chương|chapter)\\s+\\d+\\s*[:：.-]\\s*");
    private static final Pattern REQUEST_SUFFIX = Pattern.compile("(?iu)\\s+bằng ví dụ đơn giản\\s*$");
    private static final int MAX_TOPIC_LENGTH = 80;

    private GuidedPracticeGuard() {
    }

    public static boolean hasUsablePractice(String markdown) {
        String section = firstSection(markdown);
        return section != null && BLANK.matcher(section).find();
    }

    /**
     * Keeps the first usable practice section, drops duplicates or blank-less copies, and inserts a
     * level-appropriate fill-in exercise (before the sources heading) when the model wrote none.
     */
    public static String ensure(String markdown, String question, SupportLevelPrompt level) {
        if (markdown == null || markdown.isBlank()) {
            return markdown;
        }
        SupportLevelPrompt support = level == null ? SupportLevelPrompt.STANDARD : level;
        boolean usable = hasUsablePractice(markdown);
        String kept = usable ? firstSection(markdown) : null;
        String body = removeAllSections(markdown);
        String practice = usable ? kept.trim() : fallback(question, support);

        Matcher sources = SOURCES_HEADING.matcher(body);
        if (sources.find()) {
            return (body.substring(0, sources.start()).trim()
                    + "\n\n" + practice + "\n\n"
                    + body.substring(sources.start()).trim()).trim();
        }
        return body.trim() + "\n\n" + practice;
    }

    static String fallback(String question, SupportLevelPrompt level) {
        String topic = topicOf(question);
        StringBuilder lines = new StringBuilder();
        switch (level) {
            case HIGH_SUPPORT -> {
                lines.append("1. Ý chính của ").append(topic).append(": ____   (gợi ý: xem lại câu mở đầu phần giải thích)\n");
                lines.append("2. Ví dụ trong bài cho thấy ").append(topic).append(" giúp ____   (gợi ý: đọc lại từng dòng của ví dụ)\n");
            }
            case CHALLENGE -> {
                lines.append("1. Ý chính của ").append(topic).append(": ____\n");
                lines.append("2. Trường hợp áp dụng ").append(topic).append(": ____\n");
                lines.append("3. Một lỗi dễ mắc với ").append(topic).append(" là ____, vì ____\n");
                lines.append("4. Điểm khác giữa ").append(topic).append(" và khái niệm gần nhất trong bài: ____\n");
            }
            case STANDARD -> {
                lines.append("1. Ý chính của ").append(topic).append(": ____\n");
                lines.append("2. Trường hợp áp dụng ").append(topic).append(": ____\n");
                lines.append("3. Một lỗi dễ mắc với ").append(topic).append(" là ____   (gợi ý: xem lại phần lưu ý)\n");
            }
        }
        return "## Bài tập có hướng dẫn\n\n"
                + "Điền vào các chỗ trống dựa trên phần vừa học.\n\n"
                + "```\n" + lines.toString().trim() + "\n```";
    }

    static String topicOf(String question) {
        if (question == null || question.isBlank()) {
            return "Khái niệm vừa học";
        }
        String firstLine = question.strip().split("\\R", 2)[0];
        String topic = LESSON_PREFIX.matcher(firstLine).replaceFirst("");
        topic = REQUEST_PREFIX.matcher(topic).replaceFirst("");
        topic = NUMBERED_LESSON.matcher(topic).replaceFirst("")
                .replaceAll("[?？!.。]+$", "");
        topic = REQUEST_SUFFIX.matcher(topic).replaceFirst("")
                .replaceAll("[`*_#\"“”]", "")
                .trim();
        if (topic.isEmpty() || topic.length() > MAX_TOPIC_LENGTH) {
            return "Khái niệm vừa học";
        }
        return "\"" + topic + "\"";
    }

    private static String firstSection(String markdown) {
        if (markdown == null) {
            return null;
        }
        Matcher heading = PRACTICE_HEADING.matcher(markdown);
        if (!heading.find()) {
            return null;
        }
        int end = sectionEnd(markdown, heading.end());
        return markdown.substring(heading.start(), end);
    }

    private static String removeAllSections(String markdown) {
        String result = markdown;
        Matcher heading = PRACTICE_HEADING.matcher(result);
        while (heading.find()) {
            int end = sectionEnd(result, heading.end());
            result = (result.substring(0, heading.start()) + result.substring(end)).replaceAll("\\n{3,}", "\n\n");
            heading = PRACTICE_HEADING.matcher(result);
        }
        return result;
    }

    /** Next heading outside a code fence, or end of text. */
    private static int sectionEnd(String markdown, int from) {
        boolean inFence = false;
        int index = from;
        for (String line : markdown.substring(from).split("(?<=\\n)")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("```")) {
                inFence = !inFence;
            } else if (!inFence && index > from && ANY_HEADING.matcher(trimmed).lookingAt()) {
                return index;
            }
            index += line.length();
        }
        return markdown.length();
    }
}
