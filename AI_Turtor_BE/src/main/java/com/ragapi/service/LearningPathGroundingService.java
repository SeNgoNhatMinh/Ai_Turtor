package com.ragapi.service;

import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.cotraining.ChapterOutlineView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Converts an LLM-proposed learning path into source-backed lessons. The model may
 * describe a path, but only indexed material headings are allowed to become
 * clickable lessons.
 */
@Service
@RequiredArgsConstructor
public class LearningPathGroundingService {

    private static final int DEFAULT_LESSON_COUNT = 5;
    private static final int MAX_LESSON_COUNT = 8;
    private static final Set<String> STOP_WORDS = Set.of(
            "bat", "dau", "bai", "hoc", "ve", "phan", "chuong", "muon", "hom", "nay",
            "start", "lesson", "learn", "about", "the", "and", "with", "from", "course"
    );

    private final ChapterOutlineService chapterOutlineService;

    public List<SuggestionItem> ground(
            String courseId,
            String studentQuestion,
            List<SuggestionItem> proposedLessons
    ) {
        if (courseId == null || courseId.isBlank()) {
            return List.of();
        }
        List<ChapterOutlineView> available = chapterOutlineService.suggestChapters(courseId).stream()
                .filter(this::hasMaterial)
                .toList();
        if (available.isEmpty()) {
            return List.of();
        }

        String proposalText = proposedLessons == null ? "" : proposedLessons.stream()
                .map(SuggestionItem::getTitle)
                .filter(value -> value != null && !value.isBlank())
                .reduce("", (left, right) -> left + " " + right);
        Set<String> focusTokens = tokens(studentQuestion + " " + proposalText);
        int requestedCount = proposedLessons == null || proposedLessons.isEmpty()
                ? DEFAULT_LESSON_COUNT
                : Math.min(MAX_LESSON_COUNT, proposedLessons.size());

        List<RankedChapter> ranked = available.stream()
                .map(chapter -> new RankedChapter(chapter, relevance(chapter.getTitle(), focusTokens)))
                .filter(item -> focusTokens.isEmpty() || item.score() > 0)
                .sorted(Comparator.comparingInt(RankedChapter::score).reversed()
                        .thenComparingInt(item -> normalizedPage(item.chapter())))
                .limit(requestedCount)
                .sorted(Comparator.comparingInt(item -> normalizedPage(item.chapter())))
                .toList();

        if (ranked.isEmpty()) {
            return List.of();
        }

        List<SuggestionItem> grounded = new ArrayList<>();
        for (int index = 0; index < ranked.size(); index++) {
            ChapterOutlineView chapter = ranked.get(index).chapter();
            grounded.add(new SuggestionItem(
                    "Bắt đầu bài " + (index + 1) + ": " + chapter.getTitle(),
                    "Bài học được liên kết trực tiếp với tiêu đề trong tài liệu môn học",
                    List.of("AI Tutor mở đúng chương và hướng dẫn từng bước như một gia sư."),
                    "MATERIAL_OUTLINE",
                    chapter.getChapterKey(),
                    chapter.getTitle(),
                    clean(chapter.getSourceMaterialIds()),
                    List.of()
            ));
        }
        return List.copyOf(grounded);
    }

    private boolean hasMaterial(ChapterOutlineView chapter) {
        return chapter != null
                && chapter.getChapterKey() != null
                && !chapter.getChapterKey().isBlank()
                && chapter.getTitle() != null
                && !chapter.getTitle().isBlank()
                && !"NO_MATERIAL".equalsIgnoreCase(chapter.getMaterialHealth())
                && (chapter.getChunkCount() > 0 || chapter.getApproxChars() > 0);
    }

    private int relevance(String title, Set<String> focusTokens) {
        if (focusTokens.isEmpty()) {
            return 1;
        }
        Set<String> titleTokens = tokens(title);
        int score = 0;
        for (String token : titleTokens) {
            if (focusTokens.contains(token)) {
                score += token.length() >= 7 ? 3 : 1;
            }
        }
        return score;
    }

    private static Set<String> tokens(String value) {
        String normalized = normalize(value);
        if (normalized.isBlank()) {
            return Set.of();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String token : normalized.split("[^a-z0-9]+")) {
            if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                result.add(token);
            }
        }
        return result;
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private static int normalizedPage(ChapterOutlineView chapter) {
        return chapter.getPageStart() > 0 ? chapter.getPageStart() : Integer.MAX_VALUE;
    }

    private static List<String> clean(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private record RankedChapter(ChapterOutlineView chapter, int score) {
    }
}
