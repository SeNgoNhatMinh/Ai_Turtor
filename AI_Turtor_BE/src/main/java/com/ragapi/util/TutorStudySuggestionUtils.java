package com.ragapi.util;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Opening chips for a tutor session: study units the student can click to start
 * the same "Nay mình học …" learning-path flow.
 */
public final class TutorStudySuggestionUtils {

    public static final List<String> NEW_COURSE_STARTERS = List.of(
            "Bắt đầu từ nội dung đầu môn",
            "Tóm tắt những gì môn này dạy",
            "Mình đang thắc mắc một khái niệm"
    );

    private TutorStudySuggestionUtils() {
    }

    public record RankedTitle(String title, int pageStart, int tocLevel) {
        public RankedTitle {
            title = title == null ? "" : title.trim();
            pageStart = Math.max(0, pageStart);
            tocLevel = Math.max(0, tocLevel);
        }
    }

    public static List<String> courseStarters(String courseId) {
        String course = courseId == null || courseId.isBlank() ? "môn này" : courseId.trim();
        return List.of("phần mở đầu môn " + course);
    }

    public static List<String> openingSuggestions(String courseId, List<String> weakTopics, List<RankedTitle> chapters) {
        return openingSuggestions(courseId, weakTopics, List.of(), chapters);
    }

    public static List<String> openingSuggestions(
            String courseId,
            List<String> weakTopics,
            List<String> recentQuestions,
            List<RankedTitle> chapters
    ) {
        LinkedHashSet<String> personal = new LinkedHashSet<>(askedTopicChips(recentQuestions));
        if (weakTopics != null) {
            weakTopics.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(topic -> !topic.isBlank())
                    .filter(ChapterHeadingUtils::isStudyUnitTitle)
                    .limit(2)
                    .forEach(personal::add);
        }
        if (!personal.isEmpty()) {
            return personal.stream().limit(4).toList();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        pickChapterSuggestions(chapters, 4).forEach(result::add);
        if (result.isEmpty()) {
            result.addAll(courseStarters(courseId));
        }
        return result.stream().limit(4).toList();
    }

    /** Recent student questions, newest first, as clickable path chips. */
    public static List<String> askedTopicChips(List<String> recentQuestions) {
        if (recentQuestions == null || recentQuestions.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (int i = recentQuestions.size() - 1; i >= 0 && result.size() < 4; i--) {
            String question = recentQuestions.get(i);
            if (question == null || question.isBlank()) {
                continue;
            }
            String trimmed = question.trim().replaceAll("\\s+", " ");
            if (trimmed.length() < 8 || ChapterHeadingUtils.isBookFrontMatterTitle(trimmed)) {
                continue;
            }
            if (trimmed.length() > 90) {
                trimmed = trimmed.substring(0, 87).trim() + "...";
            }
            result.add(trimmed);
        }
        return List.copyOf(result);
    }

    public static List<String> pickChapterSuggestions(List<RankedTitle> chapters, int limit) {
        if (chapters == null || chapters.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<RankedTitle> units = chapters.stream()
                .filter(Objects::nonNull)
                .filter(chapter -> ChapterHeadingUtils.isStudyUnitTitle(chapter.title()))
                .toList();
        List<RankedTitle> topLevel = units.stream()
                .filter(chapter -> chapter.tocLevel() <= 1 || looksNumberedLesson(chapter.title()))
                .toList();
        List<RankedTitle> chosen = topLevel.isEmpty() ? units : topLevel;
        return chosen.stream()
                .sorted(Comparator
                        .comparingInt((RankedTitle chapter) -> looksNumberedLesson(chapter.title()) ? 0 : 1)
                        .thenComparingInt(chapter -> chapter.tocLevel() > 0 ? chapter.tocLevel() : 99)
                        .thenComparingInt(chapter -> chapter.pageStart() > 0
                                ? chapter.pageStart()
                                : Integer.MAX_VALUE / 4)
                        .thenComparing(RankedTitle::title, String.CASE_INSENSITIVE_ORDER))
                .map(RankedTitle::title)
                .distinct()
                .limit(limit)
                .toList();
    }

    public static boolean needsSuggestionRefresh(List<String> current) {
        if (current == null || current.isEmpty()) {
            return true;
        }
        for (String item : current) {
            if (item == null || item.isBlank()) {
                continue;
            }
            String trimmed = item.trim();
            if (trimmed.toLowerCase(Locale.ROOT).matches("^(?:bắt đầu\\s+|bat dau\\s+)?(?:bài|bai)\\s+\\d+\\b.*")) {
                return false;
            }
        }
        boolean hasJunk = current.stream().anyMatch(item ->
                ChapterHeadingUtils.isBookFrontMatterTitle(item)
                        || ChapterHeadingUtils.isSentenceLikeHeading(item)
                        || ChapterHeadingUtils.isCourseOverviewChip(item)
                        || isCourseAgnosticStarter(item)
                        || looksLikeRawMaterialHeading(item)
                        || looksLikePrefaceNumbering(item));
        if (hasJunk) {
            return true;
        }
        return current.stream().noneMatch(ChapterHeadingUtils::isStudyUnitTitle);
    }

    static boolean isCourseAgnosticStarter(String item) {
        if (item == null || item.isBlank()) {
            return true;
        }
        String trimmed = item.trim();
        return NEW_COURSE_STARTERS.stream().anyMatch(starter -> starter.equalsIgnoreCase(trimmed));
    }

    static boolean looksLikeRawMaterialHeading(String title) {
        if (title == null || title.isBlank() || looksNumberedLesson(title)) {
            return false;
        }
        return title.trim().matches("[A-Za-z0-9 ,.'()/+_-]+");
    }

    public static boolean looksNumberedLesson(String title) {
        if (!looksNumbered(title) || looksLikePrefaceNumbering(title)) {
            return false;
        }
        return true;
    }

    static boolean looksLikePrefaceNumbering(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        return title.trim().matches("(?i)^0+(?:\\.\\d+)*\\b.*");
    }

    public static boolean looksNumbered(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        return title.trim().matches(
                "(?i)^(?:\\d+(?:\\.\\d+)*|(?:chapter|chương|chuong|bài|bai|unit|lesson)\\s+\\d+)\\b.*");
    }
}
