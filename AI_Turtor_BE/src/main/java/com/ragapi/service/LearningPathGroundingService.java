package com.ragapi.service;

import com.ragapi.dto.SuggestionItem;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.cotraining.ChapterOutlineView;
import com.ragapi.infrastructure.elasticsearch.ElasticsearchCourseSearchAdapter;
import com.ragapi.util.ChapterHeadingUtils;
import com.ragapi.util.IndexedChapterTitles;
import com.ragapi.util.StudentChatIntentDetector;
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
    private final ElasticsearchCourseSearchAdapter courseSearchAdapter;

    public List<SuggestionItem> ground(
            String courseId,
            String studentQuestion,
            List<SuggestionItem> proposedLessons
    ) {
        return ground(courseId, studentQuestion, proposedLessons, List.of());
    }

    /**
     * Grounds an LLM learning path against both the material outline and the
     * verified evidence already retrieved for this request. Evidence matters for
     * bilingual questions: a Vietnamese request can retrieve an English textbook
     * chapter even when the literal tokens in the question and heading differ.
     */
    public List<SuggestionItem> ground(
            String courseId,
            String studentQuestion,
            List<SuggestionItem> proposedLessons,
            List<RagSourceEvidence> retrievedEvidence
    ) {
        if (courseId == null || courseId.isBlank()) {
            return List.of();
        }
        if (StudentChatIntentDetector.isTopiclessStudyRequest(studentQuestion)) {
            return openingLessons(courseId, DEFAULT_LESSON_COUNT);
        }
        List<ChapterOutlineView> available = chapterOutlineService.suggestChapters(courseId).stream()
                .filter(this::isStudentLessonChapter)
                .toList();
        int requestedCount = proposedLessons == null || proposedLessons.isEmpty()
                ? DEFAULT_LESSON_COUNT
                : Math.min(MAX_LESSON_COUNT, proposedLessons.size());
        if (available.isEmpty()) {
            List<SuggestionItem> evidenceLessons = evidenceBackedLessons(retrievedEvidence, requestedCount);
            if (!evidenceLessons.isEmpty()) {
                return evidenceLessons;
            }
            if (StudentChatIntentDetector.isTopicStudyStart(studentQuestion)) {
                return openingLessons(courseId, DEFAULT_LESSON_COUNT);
            }
            return List.of();
        }

        Set<String> focusTokens = tokens(studentQuestion);
        Set<String> proposedLessonTokens = proposedLessonTokens(proposedLessons);
        Set<String> evidenceTokens = evidenceTokens(retrievedEvidence);
        Set<String> evidenceMaterialIds = evidenceMaterialIds(retrievedEvidence);

        List<RankedChapter> ranked = available.stream()
                .filter(chapter -> relevance(chapter.getTitle(), focusTokens) > 0
                        || relevance(chapter.getTitle(), evidenceTokens) > 0)
                .map(chapter -> new RankedChapter(
                        chapter,
                        (4 * relevance(chapter.getTitle(), focusTokens))
                                + (4 * relevance(chapter.getTitle(), evidenceTokens))
                                + relevance(chapter.getTitle(), proposedLessonTokens)
                                + (sharesMaterial(chapter, evidenceMaterialIds) ? 1 : 0)
                ))
                .sorted(Comparator.comparingInt(RankedChapter::score).reversed()
                        .thenComparingInt(item -> normalizedPage(item.chapter())))
                .limit(requestedCount)
                .sorted(Comparator.comparingInt(item -> normalizedPage(item.chapter())))
                .toList();

        if (ranked.isEmpty()) {
            return evidenceBackedLessons(retrievedEvidence, requestedCount);
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

    private Set<String> proposedLessonTokens(List<SuggestionItem> proposedLessons) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (proposedLessons != null) {
            for (SuggestionItem lesson : proposedLessons) {
                if (lesson != null) {
                    result.addAll(tokens(lesson.getTitle()));
                    result.addAll(tokens(lesson.getChapterTitle()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private Set<String> evidenceTokens(List<RagSourceEvidence> retrievedEvidence) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (retrievedEvidence != null) {
            for (RagSourceEvidence evidence : retrievedEvidence) {
                if (isCourseMaterialEvidence(evidence)) {
                    result.addAll(tokens(evidence.getChapter()));
                    result.addAll(tokens(evidence.getExcerpt()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private Set<String> evidenceMaterialIds(List<RagSourceEvidence> retrievedEvidence) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (retrievedEvidence != null) {
            for (RagSourceEvidence evidence : retrievedEvidence) {
                if (isCourseMaterialEvidence(evidence)
                        && evidence.getMaterialId() != null
                        && !evidence.getMaterialId().isBlank()) {
                    result.add(evidence.getMaterialId().trim());
                }
            }
        }
        return Set.copyOf(result);
    }

    private boolean sharesMaterial(ChapterOutlineView chapter, Set<String> materialIds) {
        if (chapter == null || materialIds.isEmpty() || chapter.getSourceMaterialIds() == null) {
            return false;
        }
        return chapter.getSourceMaterialIds().stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .anyMatch(materialIds::contains);
    }

    private List<SuggestionItem> evidenceBackedLessons(
            List<RagSourceEvidence> retrievedEvidence,
            int limit
    ) {
        if (retrievedEvidence == null || retrievedEvidence.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<SuggestionItem> lessons = new ArrayList<>();
        LinkedHashSet<String> seenTitles = new LinkedHashSet<>();
        for (RagSourceEvidence evidence : retrievedEvidence) {
            if (!isCourseMaterialEvidence(evidence)) {
                continue;
            }
            String title = evidence.getChapter() == null ? "" : evidence.getChapter().trim();
            if (title.isBlank()
                    || ChapterHeadingUtils.isInternalKnowledgeTitle(title)
                    || !ChapterHeadingUtils.isStudyUnitTitle(title)
                    || !seenTitles.add(normalize(title))) {
                continue;
            }
            int lessonNumber = lessons.size() + 1;
            String chunkId = evidence.getChunkId() == null ? "" : evidence.getChunkId().trim();
            lessons.add(new SuggestionItem(
                    "Bắt đầu bài " + lessonNumber + ": " + title,
                    "Bài học được liên kết với bằng chứng đã truy xuất từ tài liệu môn học",
                    List.of("AI Tutor mở đúng phần tài liệu liên quan và hướng dẫn từng bước."),
                    "RETRIEVED_EVIDENCE",
                    chunkId.isBlank() ? "evidence-lesson-" + lessonNumber : chunkId,
                    title,
                    evidence.getMaterialId() == null
                            ? List.of()
                            : clean(List.of(evidence.getMaterialId())),
                    evidence.getChunkId() == null
                            ? List.of()
                            : clean(List.of(evidence.getChunkId()))
            ));
            if (lessons.size() >= limit) {
                break;
            }
        }
        return List.copyOf(lessons);
    }

    private boolean isCourseMaterialEvidence(RagSourceEvidence evidence) {
        return evidence != null
                && (evidence.getSourceKind() == null
                || evidence.getSourceKind().isBlank()
                || "COURSE_MATERIAL".equalsIgnoreCase(evidence.getSourceKind()));
    }

    public List<SuggestionItem> openingLessons(String courseId, int limit) {
        if (courseId == null || courseId.isBlank() || limit <= 0) {
            return List.of();
        }
        List<ChapterOutlineView> outlines = chapterOutlineService.suggestChapters(courseId);
        List<ChapterOutlineView> chapters = outlines.stream()
                .filter(this::isOpeningChapter)
                .sorted(Comparator.comparingInt(LearningPathGroundingService::normalizedPage)
                        .thenComparing(chapter -> chapter.getTitle(), String.CASE_INSENSITIVE_ORDER))
                .limit(limit)
                .toList();
        if (!chapters.isEmpty()) {
            return toLessonSuggestions(chapters);
        }
        return indexedOpeningLessons(courseId, limit, firstMaterialIds(outlines));
    }

    public String guidanceAnswer(String courseId) {
        List<SuggestionItem> lessons = openingLessons(courseId, DEFAULT_LESSON_COUNT);
        StringBuilder message = new StringBuilder();
        message.append("Bạn chưa nói phần muốn học, nên mình chưa soạn bài học cho bạn.\n\n");
        message.append("Hãy hỏi đúng một trong các cách sau:\n");
        message.append("- Một khái niệm trong môn: \"object là gì?\" hoặc \"class dùng để làm gì?\"\n");
        message.append("- Một bài cụ thể: bấm một gợi ý bên dưới, hoặc gõ \"Bắt đầu bài 1: …\"\n");
        message.append("- Một so sánh: \"list khác tuple ở điểm nào?\"\n");
        if (!lessons.isEmpty()) {
            message.append("\nChọn một bài để bắt đầu:\n");
            for (int index = 0; index < lessons.size(); index++) {
                message.append(index + 1).append(". ").append(lessons.get(index).getTitle()).append('\n');
            }
        }
        return message.toString().trim();
    }

    public String pathAnswer(List<SuggestionItem> lessons) {
        StringBuilder message = new StringBuilder();
        message.append("Các bài dưới đây là chương có trong tài liệu môn học.\n");
        if (lessons != null) {
            for (int index = 0; index < lessons.size(); index++) {
                SuggestionItem lesson = lessons.get(index);
                String title = lesson == null ? "" : lesson.getTitle();
                if (title != null && !title.isBlank()) {
                    message.append('\n').append(index + 1).append(". ").append(title.trim());
                }
            }
        }
        message.append("\n\nBạn muốn học bài nào, hãy gửi đúng dòng bài đó.");
        return message.toString().trim();
    }

    private List<SuggestionItem> indexedOpeningLessons(String courseId, int limit, List<String> materialIds) {
        if (courseSearchAdapter == null) {
            return List.of();
        }
        List<String> units = IndexedChapterTitles.studyUnits(courseSearchAdapter.listChapterTitles(courseId));
        if (units.isEmpty()) {
            return List.of();
        }
        List<SuggestionItem> lessons = new ArrayList<>();
        int count = Math.min(limit, units.size());
        for (int index = 0; index < count; index++) {
            String title = units.get(index);
            lessons.add(new SuggestionItem(
                    "Bắt đầu bài " + (index + 1) + ": " + title,
                    "Bài học được liên kết trực tiếp với tiêu đề trong tài liệu môn học",
                    List.of("Bấm bài này để AI Tutor giảng từ đúng chương, không cần gõ lại câu hỏi."),
                    "MATERIAL_OUTLINE",
                    "indexed-chapter-" + (index + 1),
                    title,
                    materialIds,
                    List.of()
            ));
        }
        return List.copyOf(lessons);
    }

    private List<SuggestionItem> toLessonSuggestions(List<ChapterOutlineView> chapters) {
        List<SuggestionItem> lessons = new ArrayList<>();
        for (int index = 0; index < chapters.size(); index++) {
            ChapterOutlineView chapter = chapters.get(index);
            lessons.add(new SuggestionItem(
                    "Bắt đầu bài " + (index + 1) + ": " + chapter.getTitle(),
                    "Bài học được liên kết trực tiếp với tiêu đề trong tài liệu môn học",
                    List.of("Bấm bài này để AI Tutor giảng từ đúng chương, không cần gõ lại câu hỏi."),
                    "MATERIAL_OUTLINE",
                    chapter.getChapterKey(),
                    chapter.getTitle(),
                    clean(chapter.getSourceMaterialIds()),
                    List.of()
            ));
        }
        return List.copyOf(lessons);
    }

    private static List<String> firstMaterialIds(List<ChapterOutlineView> outlines) {
        if (outlines == null) {
            return List.of();
        }
        for (ChapterOutlineView outline : outlines) {
            if (ChapterHeadingUtils.isInternalKnowledgeTitle(outline.getTitle())) {
                continue;
            }
            List<String> ids = clean(outline.getSourceMaterialIds());
            if (!ids.isEmpty()) {
                return ids;
            }
        }
        return List.of();
    }

    private boolean isStudentLessonChapter(ChapterOutlineView chapter) {
        return hasMaterial(chapter)
                && ChapterHeadingUtils.isStudyUnitTitle(chapter.getTitle())
                && !ChapterHeadingUtils.isInternalKnowledgeTitle(chapter.getTitle());
    }

    private boolean isOpeningChapter(ChapterOutlineView chapter) {
        if (!isStudentLessonChapter(chapter) || chapter.getTocLevel() > 0) {
            return false;
        }
        return !chapter.getTitle().trim().equalsIgnoreCase("contributions");
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
            return 0;
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
