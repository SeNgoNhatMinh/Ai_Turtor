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
            "(?im)^[\\s>*-]*(?:\\d+[.)]\\s*)?(?:Bài|Bai)\\s+(\\d+)\\s*[:：.\\-]\\s*(.+?)\\s*$"
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
        for (String line : answer.split("\\R")) {
            Matcher matcher = BAI_LINE.matcher(line.trim());
            if (!matcher.matches()) {
                continue;
            }
            String number = matcher.group(1);
            String title = stripMarkdown(matcher.group(2));
            if (title.isBlank()) {
                continue;
            }
            String prompt = "Bắt đầu bài " + number + ": " + title;
            if (!seen.add(prompt.toLowerCase())) {
                continue;
            }
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
