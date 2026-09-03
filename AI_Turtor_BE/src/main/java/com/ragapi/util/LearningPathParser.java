package com.ragapi.util;

import com.ragapi.dto.SuggestionItem;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses numbered "Bài N: title" lessons from a tutor roadmap answer
 * so the UI can offer clickable next steps. Not a hardcoded curriculum.
 */
public final class LearningPathParser {

    private static final Pattern BAI_LINE = Pattern.compile(
            "(?i)^(?:\\d+[.)]\\s*)?(?:bắt đầu\\s+|bat dau\\s+)?(?:bài|bai)\\s+(\\d+)\\s*[:：.\\-]\\s*(.+)$"
    );
    private static final Pattern CURRENT_LESSON = Pattern.compile(
            "(?i)(?:bắt đầu bài|bat dau bai|học ngay bài|hoc ngay bai)\\s+(\\d+)"
    );
    private static final Pattern LESSON_FOCUS = Pattern.compile(
            "(?i)(?:bắt đầu bài|bat dau bai|học ngay bài|hoc ngay bai)\\s+\\d+\\s*[:：.\\-]\\s*(.+)"
    );
    private static final int MAX_LESSONS = 8;

    private LearningPathParser() {
    }

    public static List<SuggestionItem> parseLessonSuggestions(String answer) {
        if (answer == null || answer.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<SuggestionItem> items = new ArrayList<>();
        for (String line : splitLessonLines(answer)) {
            Matcher matcher = BAI_LINE.matcher(normalizeLessonLine(line));
            if (!matcher.matches()) {
                continue;
            }
            String number = matcher.group(1);
            String title = stripMarkdown(matcher.group(2));
            if (title.isBlank()) {
                continue;
            }
            if (!seen.add(number)) {
                continue;
            }
            String prompt = "Bắt đầu bài " + number + ": " + title;
            items.add(new SuggestionItem(
                    prompt,
                    "Lộ trình học từ tài liệu môn học",
                    List.of("Chọn bài này để AI Tutor hướng dẫn từng bước."),
                    "AI"
            ));
            if (items.size() >= MAX_LESSONS) {
                break;
            }
        }
        return List.copyOf(items);
    }

    public static List<String> lessonStarterTexts(List<SuggestionItem> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return items.stream()
                .map(SuggestionItem::getTitle)
                .filter(title -> title != null && !title.isBlank())
                .limit(MAX_LESSONS)
                .toList();
    }

    /**
     * Use the lesson title for vector retrieval instead of the "Bắt đầu bài N" wrapper.
     */
    public static String retrievalFocus(String question) {
        return retrievalFocus(question, null);
    }

    public static Integer currentLessonNumber(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        Matcher matcher = CURRENT_LESSON.matcher(question.trim());
        if (!matcher.find()) {
            return null;
        }
        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /**
     * Canonical numbered path from a tutor session, injected into learner memory
     * so LESSON_TEACH stays on the roadmap instead of inventing another chapter.
     */
    public static String activePathContext(List<String> suggestedTopics) {
        if (suggestedTopics == null || suggestedTopics.isEmpty()) {
            return "";
        }
        return activePathContext(String.join("\n", suggestedTopics));
    }

    public static String activePathContext(String context) {
        List<SuggestionItem> lessons = parseLessonSuggestions(context);
        if (lessons.size() < 2) {
            return "";
        }
        StringBuilder block = new StringBuilder(
                "- Active numbered lesson path (copy the next Bài title exactly; do not invent a different chapter):\n");
        for (SuggestionItem item : lessons) {
            Matcher matcher = BAI_LINE.matcher(normalizeLessonLine(item.getTitle()));
            if (!matcher.matches()) {
                continue;
            }
            String title = stripMarkdown(matcher.group(2));
            if (title.isBlank()) {
                continue;
            }
            block.append("  Bài ").append(matcher.group(1)).append(": ").append(title).append('\n');
        }
        return block.toString().stripTrailing();
    }

    public static boolean hasNumberedPath(String context) {
        return parseLessonSuggestions(context).size() >= 2;
    }

    /**
     * Next numbered lesson after the student's current "Bắt đầu bài N", taken from
     * a prior roadmap in conversation/memory. Returns a markdown bullet or null.
     */
    public static String nextLessonBullet(String question, String context) {
        Integer current = currentLessonNumber(question);
        if (current == null || current < 1) {
            return null;
        }
        int wanted = current + 1;
        for (SuggestionItem item : parseLessonSuggestions(context)) {
            Matcher matcher = BAI_LINE.matcher(normalizeLessonLine(item.getTitle()));
            if (!matcher.matches()) {
                continue;
            }
            if (Integer.parseInt(matcher.group(1)) != wanted) {
                continue;
            }
            String title = stripMarkdown(matcher.group(2));
            if (title.isBlank()) {
                continue;
            }
            return "- Bài " + wanted + ": " + title;
        }
        return null;
    }

    /**
     * For short in-lesson follow-ups, prepend the session topic so retrieval stays on the lesson.
     * New topic-study questions never mix in the previous topic.
     */
    public static String retrievalFocus(String question, String sessionTopic) {
        if (question == null || question.isBlank()) {
            return question;
        }
        String focus = question.trim();
        Matcher matcher = LESSON_FOCUS.matcher(focus);
        if (matcher.find()) {
            String lessonTitle = stripMarkdown(matcher.group(1));
            if (!lessonTitle.isBlank()) {
                focus = lessonTitle;
            }
        }
        if (sessionTopic == null || sessionTopic.isBlank()) {
            return focus;
        }
        if (StudentChatIntentDetector.isTopicStudyStart(question)) {
            return focus;
        }
        if (!StudentChatIntentDetector.isDependentFollowUp(question)) {
            return focus;
        }
        String topic = sessionTopic.trim();
        if (focus.toLowerCase().contains(topic.toLowerCase())) {
            return focus;
        }
        return topic + " " + focus;
    }

    private static String[] splitLessonLines(String answer) {
        String expanded = answer.replaceAll(
                "(?i)(?<=\\S)\\s+(?=\\d+[.)]\\s*(?:bài|bai)\\s+\\d+)",
                "\n"
        );
        expanded = expanded.replaceAll(
                "(?i)(?<=\\S)\\s+(?:[-*+]\\s+)?(?=(?:bài|bai)\\s+\\d+\\s*[:：.\\-])",
                "\n"
        );
        return expanded.split("\\R");
    }

    private static String normalizeLessonLine(String line) {
        if (line == null) {
            return "";
        }
        return stripMarkdown(line)
                .replaceFirst("^[\\s>*-]+", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static String stripMarkdown(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replaceAll("[*_`]+", "")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
