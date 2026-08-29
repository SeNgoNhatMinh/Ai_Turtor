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
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (weakTopics != null) {
            weakTopics.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(ChapterHeadingUtils::isStudyUnitTitle)
                    .limit(2)
                    .forEach(result::add);
        }
        pickChapterSuggestions(chapters, 4).forEach(result::add);
        if (result.isEmpty()) {
            result.addAll(courseStarters(courseId));
        }
        return result.stream().limit(4).toList();
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
                .filter(chapter -> chapter.tocLevel() <= 1 || looksNumbered(chapter.title()))
                .toList();
        List<RankedTitle> chosen = topLevel.isEmpty() ? units : topLevel;
        return chosen.stream()
                .sorted(Comparator
                        .comparingInt((RankedTitle chapter) -> looksNumbered(chapter.title()) ? 0 : 1)
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
                        || isCourseAgnosticStarter(item));
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

    static boolean looksNumbered(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        return title.trim().matches(
                "(?i)^(?:\\d+(?:\\.\\d+)*|(?:chapter|chương|chuong|bài|bai|unit|lesson)\\s+\\d+)\\b.*");
    }
}
