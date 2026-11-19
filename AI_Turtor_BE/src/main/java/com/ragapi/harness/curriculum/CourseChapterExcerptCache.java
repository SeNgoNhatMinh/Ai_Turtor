package com.ragapi.harness.curriculum;

import com.ragapi.harness.entity.CourseChapterOutline;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.util.ChapterKeyUtils;
import com.ragapi.harness.repository.CourseChapterOutlineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Chapter excerpts for one course, shared by every student who opens that chat.
 * The text is the stored mentor excerpt. This cache never reads the book file.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CourseChapterExcerptCache {

    static final int EXCERPT_LIMIT = 12_000;

    private final CourseChapterOutlineRepository outlineRepository;
    private final ConcurrentHashMap<String, Map<String, ChapterExcerpt>> courses = new ConcurrentHashMap<>();

    public void loadCourse(String courseId) {
        String key = normalize(courseId);
        if (key == null || courses.containsKey(key)) {
            return;
        }
        courses.putIfAbsent(key, readStored(key));
    }

    /** Replaces one course with chapter text already stored in the search index. */
    public void replaceFromChunks(String courseId, List<RetrievedCourseChunk> chunks) {
        String key = normalize(courseId);
        if (key == null) {
            return;
        }
        Map<String, StringBuilder> text = new LinkedHashMap<>();
        Map<String, String> titles = new LinkedHashMap<>();
        Map<String, String> materials = new LinkedHashMap<>();
        if (chunks != null) {
            for (RetrievedCourseChunk chunk : chunks) {
                if (chunk == null || chunk.content() == null || chunk.content().isBlank()) {
                    continue;
                }
                if ("vi".equalsIgnoreCase(chunk.language()) || "SECTION".equalsIgnoreCase(chunk.nodeType())) {
                    continue;
                }
                String title = chunk.chapterTitle() == null || chunk.chapterTitle().isBlank()
                        ? chunk.chapterId()
                        : chunk.chapterTitle();
                String chapterKey = ChapterKeyUtils.toChapterKey(title);
                StringBuilder builder = text.computeIfAbsent(chapterKey, ignored -> new StringBuilder());
                if (builder.length() >= EXCERPT_LIMIT) {
                    continue;
                }
                if (!builder.isEmpty()) {
                    builder.append("\n\n");
                }
                String piece = chunk.content().trim();
                int room = EXCERPT_LIMIT - builder.length();
                builder.append(piece.length() > room ? piece.substring(0, room) : piece);
                titles.putIfAbsent(chapterKey, title == null ? "" : title.trim());
                if (chunk.materialId() != null && !chunk.materialId().isBlank()) {
                    materials.putIfAbsent(chapterKey, chunk.materialId());
                }
            }
        }
        Map<String, ChapterExcerpt> loaded = new LinkedHashMap<>();
        for (Map.Entry<String, StringBuilder> entry : text.entrySet()) {
            String body = entry.getValue().toString().trim();
            if (body.isBlank()) {
                continue;
            }
            loaded.put(entry.getKey(), new ChapterExcerpt(
                    entry.getKey(),
                    titles.getOrDefault(entry.getKey(), ""),
                    body,
                    materials.getOrDefault(entry.getKey(), "")
            ));
        }
        courses.put(key, Map.copyOf(loaded));
        log.info("Loaded {} indexed chapter chunk groups into memory (courseId={})", loaded.size(), key);
    }

    public boolean isLoaded(String courseId) {
        String key = normalize(courseId);
        return key != null && courses.containsKey(key);
    }

    public Optional<String> excerpt(String courseId, String chapterKey) {
        ChapterExcerpt stored = stored(courseId, chapterKey);
        if (stored == null || stored.text() == null || stored.text().isBlank()) {
            return Optional.empty();
        }
        return Optional.of(stored.text());
    }

    public Optional<ChapterExcerpt> find(String courseId, String chapterKey) {
        ChapterExcerpt stored = stored(courseId, chapterKey);
        return stored == null ? Optional.empty() : Optional.of(stored);
    }

    public Optional<ChapterExcerpt> match(String courseId, String question) {
        String key = normalize(courseId);
        if (key == null || question == null || question.isBlank()) {
            return Optional.empty();
        }
        Map<String, ChapterExcerpt> loaded = courses.get(key);
        if (loaded == null || loaded.isEmpty()) {
            return Optional.empty();
        }
        String foldedQuestion = fold(question);
        Set<String> questionWords = words(foldedQuestion);
        ChapterExcerpt best = null;
        int bestScore = 0;
        for (ChapterExcerpt candidate : loaded.values()) {
            int score = score(candidate, foldedQuestion, questionWords);
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        return bestScore > 0 ? Optional.of(best) : Optional.empty();
    }

    public void evictCourse(String courseId) {
        String key = normalize(courseId);
        if (key != null) {
            courses.remove(key);
        }
    }

    private ChapterExcerpt stored(String courseId, String chapterKey) {
        String key = normalize(courseId);
        String chapter = chapterKey == null ? null : chapterKey.trim();
        if (key == null || chapter == null || chapter.isEmpty()) {
            return null;
        }
        Map<String, ChapterExcerpt> loaded = courses.get(key);
        return loaded == null ? null : loaded.get(chapter);
    }

    private Map<String, ChapterExcerpt> readStored(String courseId) {
        List<CourseChapterOutline> outlines = outlineRepository.findByCourseIdOrderByTitleAsc(courseId);
        if (outlines == null || outlines.isEmpty()) {
            return Map.of();
        }
        Map<String, ChapterExcerpt> loaded = new LinkedHashMap<>();
        for (CourseChapterOutline outline : outlines) {
            if (outline == null || outline.getChapterKey() == null || outline.getChapterKey().isBlank()) {
                continue;
            }
            String text = cap(outline.getMentorExcerpt());
            if (text == null) {
                continue;
            }
            String chapterKey = outline.getChapterKey().trim();
            loaded.put(chapterKey, new ChapterExcerpt(
                    chapterKey,
                    outline.getTitle() == null ? "" : outline.getTitle().trim(),
                    text,
                    firstMaterialId(outline)
            ));
        }
        log.info("Loaded {} stored chapter excerpts into memory (courseId={})", loaded.size(), courseId);
        return Map.copyOf(loaded);
    }

    private static int score(ChapterExcerpt candidate, String foldedQuestion, Set<String> questionWords) {
        String title = fold(candidate.title());
        if (title.length() >= 4 && foldedQuestion.contains(title)) {
            return 1_000 + title.length();
        }
        int overlap = 0;
        for (String word : words(title)) {
            if (questionWords.contains(word)) {
                overlap++;
            }
        }
        return overlap;
    }

    private static Set<String> words(String folded) {
        if (folded == null || folded.isBlank()) {
            return Set.of();
        }
        Set<String> words = new java.util.LinkedHashSet<>();
        for (String word : folded.split("[^\\p{L}\\p{N}]+")) {
            if (word.length() >= 4) {
                words.add(word);
            }
        }
        return words;
    }

    private static String firstMaterialId(CourseChapterOutline outline) {
        if (outline.getSourceMaterialIds() == null) {
            return "";
        }
        for (String materialId : outline.getSourceMaterialIds()) {
            if (materialId != null && !materialId.isBlank()) {
                return materialId.trim();
            }
        }
        return "";
    }

    static String cap(String excerpt) {
        if (excerpt == null || excerpt.isBlank()) {
            return null;
        }
        String trimmed = excerpt.trim();
        return trimmed.length() > EXCERPT_LIMIT ? trimmed.substring(0, EXCERPT_LIMIT).trim() : trimmed;
    }

    private static String normalize(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return null;
        }
        return courseId.trim();
    }

    private static String fold(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    public record ChapterExcerpt(String chapterKey, String title, String text, String materialId) {
    }
}
