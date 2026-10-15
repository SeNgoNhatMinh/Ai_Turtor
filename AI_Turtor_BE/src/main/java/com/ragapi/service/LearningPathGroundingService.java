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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Converts an LLM-proposed learning path into source-backed lessons. The model may
 * describe a path, but only indexed material headings are allowed to become
 * clickable lessons.
 */
@Service
@RequiredArgsConstructor
public class LearningPathGroundingService {

    private static final int DEFAULT_LESSON_COUNT = 5;
    private static final int HIGH_SUPPORT_LESSON_COUNT = 6;
    private static final int CHALLENGE_LESSON_COUNT = 3;
    private static final int MAX_LESSON_COUNT = 8;
    private static final Set<String> STOP_WORDS = Set.of(
            "bat", "dau", "bai", "hoc", "ve", "phan", "chuong", "muon", "hom", "nay",
            "start", "lesson", "learn", "about", "the", "and", "with", "from", "course"
    );
    /** A Latin term the student actually typed, such as JDBC. Vietnamese words stay out. */
    private static final Pattern LATIN_TERM = Pattern.compile(
            "(?<![\\p{L}\\p{N}])([A-Za-z][A-Za-z0-9]{2,})(?![\\p{L}\\p{N}])"
    );

    private final ChapterOutlineService chapterOutlineService;
    private final ElasticsearchCourseSearchAdapter courseSearchAdapter;

    public List<SuggestionItem> ground(
            String courseId,
            String studentQuestion,
            List<SuggestionItem> proposedLessons
    ) {
        return ground(courseId, studentQuestion, proposedLessons, List.of(), null);
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
        return ground(courseId, studentQuestion, proposedLessons, retrievedEvidence, null);
    }

    /**
     * Same real course chapters for every student at a support level. The model
     * may propose a path, but only indexed chapters with material become lessons,
     * and the count is fixed by support level instead of by that proposal.
     */
    public List<SuggestionItem> ground(
            String courseId,
            String studentQuestion,
            List<SuggestionItem> proposedLessons,
            List<RagSourceEvidence> retrievedEvidence,
            String supportLevel
    ) {
        if (courseId == null || courseId.isBlank()) {
            return List.of();
        }
        int lessonCount = lessonCountForSupportLevel(supportLevel);
        if (StudentChatIntentDetector.isTopiclessStudyRequest(studentQuestion)) {
            return openingLessons(courseId, lessonCount);
        }
        List<ChapterOutlineView> available = chapterOutlineService.suggestChapters(courseId).stream()
                .filter(this::isStudentLessonChapter)
                .toList();
        int requestedCount = lessonCount;
        Set<String> anchors = topicAnchors(studentQuestion);
        if (available.isEmpty()) {
            List<SuggestionItem> evidenceLessons = evidenceLessonsFor(retrievedEvidence, anchors, requestedCount);
            if (!evidenceLessons.isEmpty()) {
                return evidenceLessons;
            }
            if (StudentChatIntentDetector.isTopicStudyStart(studentQuestion)) {
                return openingLessons(courseId, lessonCount);
            }
            return List.of();
        }

        Set<String> focusTokens = tokens(studentQuestion);
        Set<String> proposedLessonTokens = proposedLessonTokens(proposedLessons);
        List<RagSourceEvidence> votingEvidence = anchors.isEmpty()
                ? retrievedEvidence
                : evidenceContainingAnchor(retrievedEvidence, anchors);
        Set<String> evidenceTokens = evidenceTokens(votingEvidence);
        Set<String> evidenceMaterialIds = evidenceMaterialIds(votingEvidence);

        List<RankedChapter> ranked = selectLessons(available.stream()
                .filter(chapter -> chapterMatchesQuestion(
                        chapter, focusTokens, anchors, evidenceTokens, votingEvidence))
                .map(chapter -> new RankedChapter(
                        chapter,
                        (4 * relevance(chapter.getTitle(), focusTokens))
                                + (4 * relevance(chapter.getTitle(), evidenceTokens))
                                + relevance(chapter.getTitle(), proposedLessonTokens)
                                + (sharesMaterial(chapter, evidenceMaterialIds) ? 1 : 0)
                ))
                .sorted(Comparator.comparingInt(RankedChapter::score).reversed()
                        .thenComparingInt(item -> normalizedPage(item.chapter())))
                .toList(), requestedCount);

        if (ranked.isEmpty()) {
            return evidenceLessonsFor(retrievedEvidence, anchors, requestedCount);
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

    private List<SuggestionItem> evidenceLessonsFor(
            List<RagSourceEvidence> retrievedEvidence,
            Set<String> anchors,
            int limit
    ) {
        List<RagSourceEvidence> fallback = anchors.isEmpty()
                ? retrievedEvidence
                : evidenceContainingAnchor(retrievedEvidence, anchors);
        if (fallback == null || fallback.isEmpty()) {
            return List.of();
        }
        List<RagSourceEvidence> usable = fallback.stream()
                .filter(item -> !isGenericSection(item.getChapter()))
                .filter(item -> !isFrontMatterHeading(item.getChapter()))
                .toList();
        return evidenceBackedLessons(usable, limit);
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
                    || isGenericSection(title)
                    || ChapterHeadingUtils.isInternalKnowledgeTitle(title)
                    || !ChapterHeadingUtils.isStudyUnitTitle(title)
                    || !seenTitles.add(canonicalHeading(title))) {
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
        return pathAnswer(lessons, null);
    }

    public String pathAnswer(List<SuggestionItem> lessons, String supportLevel) {
        StringBuilder message = new StringBuilder();
        message.append(pathIntro(supportLevel)).append('\n');
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

    public static int lessonCountForSupportLevel(String supportLevel) {
        String normalized = supportLevel == null ? "" : supportLevel.trim().toUpperCase(Locale.ROOT);
        int count = switch (normalized) {
            case "HIGH_SUPPORT" -> HIGH_SUPPORT_LESSON_COUNT;
            case "CHALLENGE" -> CHALLENGE_LESSON_COUNT;
            default -> DEFAULT_LESSON_COUNT;
        };
        return Math.min(MAX_LESSON_COUNT, count);
    }

    private static String pathIntro(String supportLevel) {
        String normalized = supportLevel == null ? "" : supportLevel.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "HIGH_SUPPORT" ->
                    "Các bài dưới đây là chương có trong tài liệu. Mình chia nhỏ để học lần lượt, từng chương một.";
            case "CHALLENGE" ->
                    "Các bài dưới đây là chương có trong tài liệu. Mình giữ ít bài hơn để bạn tự suy luận từ đúng chương đó.";
            default -> "Các bài dưới đây là chương có trong tài liệu môn học.";
        };
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

    /**
     * Evidence shown next to a learning path. A summary page from the same file
     * must not be cited for a different chapter.
     */
    public List<RagSourceEvidence> citedEvidence(
            List<SuggestionItem> lessons,
            List<RagSourceEvidence> evidence
    ) {
        if (lessons == null || lessons.isEmpty() || evidence == null || evidence.isEmpty()) {
            return List.of();
        }
        return evidence.stream()
                .filter(this::isCourseMaterialEvidence)
                .filter(item -> !isGenericSection(item.getChapter()))
                .filter(item -> lessons.stream().anyMatch(lesson ->
                        headingsMatch(lesson.getChapterTitle(), item.getChapter())))
                .toList();
    }

    private boolean chapterMatchesQuestion(
            ChapterOutlineView chapter,
            Set<String> focusTokens,
            Set<String> anchors,
            Set<String> evidenceTokens,
            List<RagSourceEvidence> votingEvidence
    ) {
        if (anchors.isEmpty()) {
            return relevance(chapter.getTitle(), focusTokens) > 0
                    || relevance(chapter.getTitle(), evidenceTokens) > 0;
        }
        if (relevance(chapter.getTitle(), anchors) > 0) {
            return true;
        }
        return evidenceNamesAnchoredChapter(chapter, votingEvidence, anchors);
    }

    /**
     * "Part III" and "Part 3" are the same bookmark written two ways. Keeping both
     * used up the lesson count and hid the next real chapter.
     */
    static String canonicalHeading(String title) {
        String normalized = normalize(title);
        String[][] numerals = {
                {"xiii", "13"}, {"xii", "12"}, {"xi", "11"}, {"viii", "8"}, {"vii", "7"},
                {"iii", "3"}, {"ii", "2"}, {"ix", "9"}, {"iv", "4"}, {"vi", "6"},
                {"x", "10"}, {"v", "5"}, {"i", "1"}
        };
        for (String[] pair : numerals) {
            normalized = normalized.replaceAll("\\b" + pair[0] + "\\b", pair[1]);
        }
        return normalized.replaceAll("\\s+", " ").trim();
    }

    private static List<RankedChapter> selectLessons(List<RankedChapter> ranked, int limit) {
        if (ranked == null || ranked.isEmpty() || limit <= 0) {
            return List.of();
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<RankedChapter> unique = new ArrayList<>();
        for (RankedChapter item : ranked) {
            String key = canonicalHeading(item.chapter().getTitle());
            if (key.isBlank() || !seen.add(key)) {
                continue;
            }
            unique.add(item);
            if (unique.size() >= limit) {
                break;
            }
        }
        unique.sort(Comparator.comparingInt(item -> normalizedPage(item.chapter())));
        return List.copyOf(unique);
    }

    private List<RagSourceEvidence> evidenceContainingAnchor(
            List<RagSourceEvidence> evidence,
            Set<String> anchors
    ) {
        if (evidence == null || evidence.isEmpty() || anchors.isEmpty()) {
            return List.of();
        }
        return evidence.stream()
                .filter(item -> containsAnchor(item, anchors))
                .toList();
    }

    private boolean evidenceNamesAnchoredChapter(
            ChapterOutlineView chapter,
            List<RagSourceEvidence> evidence,
            Set<String> anchors
    ) {
        if (chapter == null || evidence == null) {
            return false;
        }
        for (RagSourceEvidence item : evidence) {
            if (item == null
                    || isGenericSection(item.getChapter())
                    || isFrontMatterHeading(item.getChapter())
                    || !containsAnchor(item, anchors)) {
                continue;
            }
            if (headingsMatch(chapter.getTitle(), item.getChapter())) {
                return true;
            }
        }
        return false;
    }

    private boolean containsAnchor(RagSourceEvidence evidence, Set<String> anchors) {
        return evidence != null
                && (relevance(evidence.getChapter(), anchors) > 0
                || relevance(evidence.getExcerpt(), anchors) > 0);
    }

    private static boolean headingsMatch(String lessonTitle, String evidenceChapter) {
        String left = normalize(lessonTitle);
        String right = normalize(evidenceChapter);
        if (left.isBlank() || right.isBlank() || isGenericSection(right)) {
            return false;
        }
        return left.equals(right) || left.contains(right) || right.contains(left);
    }

    private static boolean isFrontMatterHeading(String heading) {
        return heading != null
                && !heading.isBlank()
                && ChapterHeadingUtils.isBookFrontMatterTitle(heading);
    }

    static boolean isGenericSection(String heading) {
        String normalized = normalize(heading);
        return normalized.matches("summary|summaries|abstract|review questions|exercises|problems|key terms");
    }

    static Set<String> topicAnchors(String question) {
        if (question == null || question.isBlank()) {
            return Set.of();
        }
        LinkedHashSet<String> anchors = new LinkedHashSet<>();
        Matcher matcher = LATIN_TERM.matcher(question);
        while (matcher.find()) {
            String token = normalize(matcher.group(1));
            if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                anchors.add(token);
            }
        }
        return Set.copyOf(anchors);
    }

    private int relevance(String title, Set<String> focusTokens) {
        if (focusTokens.isEmpty()) {
            return 0;
        }
        Set<String> titleTokens = tokens(title);
        int score = 0;
        for (String token : titleTokens) {
            if (matchesFocus(token, focusTokens)) {
                score += token.length() >= 7 ? 3 : 1;
            }
        }
        return score;
    }

    /** "loop" and "loops" name the same chapter topic. */
    private static boolean matchesFocus(String token, Set<String> focusTokens) {
        for (String focus : focusTokens) {
            if (sameWord(token, focus)) {
                return true;
            }
        }
        return false;
    }

    private static boolean sameWord(String left, String right) {
        if (left.equals(right)) {
            return true;
        }
        String shorter = left.length() <= right.length() ? left : right;
        String longer = shorter == left ? right : left;
        if (shorter.length() < 4 || !longer.startsWith(shorter)) {
            return false;
        }
        String suffix = longer.substring(shorter.length());
        return suffix.equals("s") || suffix.equals("es");
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
