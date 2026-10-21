package com.ragapi.service;

import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.dto.UpdateLearningGuideRequest;
import com.ragapi.entity.Course;
import com.ragapi.entity.CourseLearningGuide;
import com.ragapi.repository.CourseLearningGuideRepository;
import com.ragapi.repository.CourseRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseLearningGuideServiceTest {

    private static final String SYLLABUS = """
            Mục tiêu kiến thức:
            - Hiểu được cú pháp và kiểu dữ liệu của Python
            Mục tiêu kỹ năng:
            - Viết được chương trình Python cơ bản
            Nội dung chính trong chương trình học:
            - Cú pháp Python: Biến và kiểu dữ liệu.
            - Cấu trúc điều khiển: if/else và vòng lặp.
            """;

    private static Course course() {
        return Course.builder()
                .courseId("PFP191")
                .courseName("Programming Fundamentals with Python")
                .description(SYLLABUS)
                .build();
    }

    @Test
    void extractionKeepsOnlySyllabusGroundedContentAndRestoresMissedTopics() {
        String raw = """
                {
                  "courseCode": "PFP191",
                  "courseName": "Programming Fundamentals with Python",
                  "overview": "Hiểu được cú pháp và kiểu dữ liệu của Python",
                  "knowledgeObjectives": ["Hiểu được cú pháp và kiểu dữ liệu của Python", "Hiểu được cú pháp và kiểu dữ liệu của Python"],
                  "skillObjectives": ["Viết được chương trình Python cơ bản"],
                  "topics": [
                    {"title": "Cú pháp Python", "detail": "Biến và kiểu dữ liệu"},
                    {"title": "Điện toán lượng tử", "detail": "Qubit và cổng lượng tử"}
                  ],
                  "keywords": ["Python", "Blockchain"]
                }
                """;

        CourseLearningGuideService.Extraction extraction =
                CourseLearningGuideService.parseExtraction(raw, course(), SYLLABUS);

        // Duplicate knowledge objective is deduped.
        assertEquals(1, extraction.knowledgeObjectives().size());
        assertEquals(List.of("Viết được chương trình Python cơ bản"), extraction.skillObjectives());
        // Ungrounded topic is dropped; the missed syllabus topic is restored with a warning.
        assertEquals(
                List.of("Cú pháp Python", "Cấu trúc điều khiển"),
                extraction.topics().stream().map(topic -> topic.title()).toList());
        // Keywords mirror the validated topic titles; the free-form LLM
        // keyword "Blockchain" never reaches students.
        assertEquals(List.of("Cú pháp Python", "Cấu trúc điều khiển"), extraction.keywords());
        assertFalse(extraction.warnings().isEmpty());
        assertTrue(extraction.warnings().stream().anyMatch(w -> w.contains("Điện toán lượng tử")));
        assertTrue(extraction.warnings().stream().anyMatch(w -> w.contains("Cấu trúc điều khiển")));
    }

    @Test
    void cleanExtractionProducesNoWarnings() {
        String raw = """
                {
                  "courseCode": "PFP191",
                  "overview": "",
                  "knowledgeObjectives": ["Hiểu được cú pháp và kiểu dữ liệu của Python"],
                  "skillObjectives": ["Viết được chương trình Python cơ bản"],
                  "topics": [
                    {"title": "Cú pháp Python", "detail": "Biến và kiểu dữ liệu"},
                    {"title": "Cấu trúc điều khiển", "detail": "if/else và vòng lặp"}
                  ],
                  "keywords": ["Python"]
                }
                """;

        CourseLearningGuideService.Extraction extraction =
                CourseLearningGuideService.parseExtraction(raw, course(), SYLLABUS);

        assertTrue(extraction.warnings().isEmpty(), () -> "warnings=" + extraction.warnings());
        assertEquals(2, extraction.topics().size());
    }

    @Test
    void extractionRejectsContentThatIntroducesWordsOutsideTheSyllabus() {
        String raw = """
                {
                  "courseCode": "PFP191",
                  "courseName": "Programming Fundamentals with Python",
                  "overview": "",
                  "knowledgeObjectives": ["Vận dụng Python vào học máy và dữ liệu lớn"],
                  "skillObjectives": [],
                  "topics": [
                    {"title": "Cú pháp Python nâng cao cho trí tuệ nhân tạo", "detail": ""}
                  ],
                  "keywords": ["Học máy"]
                }
                """;

        CourseLearningGuideService.Extraction extraction =
                CourseLearningGuideService.parseExtraction(raw, course(), SYLLABUS);

        // Every item that introduces words absent from the school syllabus is
        // dropped; only the deterministic syllabus topics remain, and the
        // keywords mirror those topic titles (never the LLM's own list).
        assertTrue(extraction.knowledgeObjectives().isEmpty());
        assertEquals(
                List.of("Cú pháp Python", "Cấu trúc điều khiển"),
                extraction.topics().stream().map(topic -> topic.title()).toList());
        assertEquals(List.of("Cú pháp Python", "Cấu trúc điều khiển"), extraction.keywords());
        assertTrue(extraction.warnings().stream().anyMatch(w -> w.contains("trí tuệ nhân tạo")));
    }

    @Test
    void approvedOverviewServesAdminApprovedContentVerbatimAndRejectsStaleGuides() {
        CourseLearningGuideRepository guideRepository = mock(CourseLearningGuideRepository.class);
        CourseLearningGuideService service = new CourseLearningGuideService(
                mock(CourseRepository.class), guideRepository, mock(OpenRouterChatService.class));
        CourseLearningGuide guide = CourseLearningGuide.builder()
                .courseId("PFP191")
                .syllabusHash(CourseLearningGuideService.syllabusHash(SYLLABUS))
                .status(CourseLearningGuide.STATUS_APPROVED)
                .overview("Hiểu được cú pháp và kiểu dữ liệu của Python")
                .knowledgeObjectives(List.of("Hiểu được cú pháp và kiểu dữ liệu của Python"))
                .skillObjectives(List.of("Viết được chương trình Python cơ bản"))
                .topics(List.of(
                        CourseLearningGuide.Topic.builder()
                                .title("Cú pháp Python").detail("Biến và kiểu dữ liệu").build(),
                        CourseLearningGuide.Topic.builder()
                                .title("Điện toán lượng tử").detail("Qubit và cổng lượng tử").build()))
                .keywords(List.of("Python", "Blockchain"))
                .build();
        when(guideRepository.findFirstByCourseIdAndStatusOrderByCreatedAtDesc(
                "PFP191", CourseLearningGuide.STATUS_APPROVED))
                .thenReturn(Optional.of(guide));

        CourseCurriculumOverview overview = service.approvedOverview(course()).orElseThrow();

        // Once an admin has approved the guide, students see it exactly as
        // approved — even wording the admin rephrased beyond the syllabus.
        assertEquals(List.of("Cú pháp Python", "Điện toán lượng tử"), overview.unitTitles());
        // Keywords mirror the approved topic titles, not the stored LLM list.
        assertEquals(List.of("Cú pháp Python", "Điện toán lượng tử"), overview.keywords());
        assertEquals(List.of("Hiểu được cú pháp và kiểu dữ liệu của Python"), overview.objectives());

        guide.setSyllabusHash("stale-hash-from-older-syllabus");
        assertTrue(service.approvedOverview(course()).isEmpty());
    }

    @Test
    void adminEditSavesApprovedGuideWithKeywordsDerivedFromTopics() {
        CourseRepository courseRepository = mock(CourseRepository.class);
        CourseLearningGuideRepository guideRepository = mock(CourseLearningGuideRepository.class);
        CourseLearningGuideService service = new CourseLearningGuideService(
                courseRepository, guideRepository, mock(OpenRouterChatService.class));
        when(courseRepository.findByCourseId("PFP191")).thenReturn(Optional.of(course()));
        when(guideRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CourseLearningGuide saved = service.updateGuideContent("PFP191", new UpdateLearningGuideRequest(
                "Câu một của syllabus. Câu hai của syllabus. Câu ba ngoài giới hạn hai dòng.",
                List.of("Hiểu được cú pháp và kiểu dữ liệu của Python", "Hiểu được cú pháp và kiểu dữ liệu của Python"),
                List.of("Viết được chương trình Python cơ bản"),
                List.of(
                        new UpdateLearningGuideRequest.Topic("Cú pháp Python", "Biến và kiểu dữ liệu"),
                        new UpdateLearningGuideRequest.Topic("Cú pháp Python", "Bản trùng bị loại"),
                        new UpdateLearningGuideRequest.Topic(" ", "Chủ đề rỗng bị loại"),
                        new UpdateLearningGuideRequest.Topic("Cấu trúc điều khiển", "if/else và vòng lặp"))),
                "admin@system.local");

        assertEquals(CourseLearningGuide.STATUS_APPROVED, saved.getStatus());
        assertEquals(CourseLearningGuideService.syllabusHash(SYLLABUS), saved.getSyllabusHash());
        assertFalse(saved.getOverview().contains("Câu ba"));
        assertEquals(1, saved.getKnowledgeObjectives().size());
        assertEquals(
                List.of("Cú pháp Python", "Cấu trúc điều khiển"),
                saved.getTopics().stream().map(CourseLearningGuide.Topic::getTitle).toList());
        // Keywords always mirror the edited topic titles.
        assertEquals(List.of("Cú pháp Python", "Cấu trúc điều khiển"), saved.getKeywords());
        assertEquals("admin@system.local", saved.getReviewedBy());
    }

    @Test
    void regenerateAllCountsCoursesWithoutSyllabusAndFailedExtractions() {
        CourseRepository courseRepository = mock(CourseRepository.class);
        CourseLearningGuideService service = new CourseLearningGuideService(
                courseRepository, mock(CourseLearningGuideRepository.class), mock(OpenRouterChatService.class));
        Course withoutSyllabus = Course.builder()
                .courseId("EMPTY1").courseName("Empty").description("").build();
        when(courseRepository.findAll()).thenReturn(List.of(course(), withoutSyllabus));

        java.util.Map<String, Integer> counts = service.regenerateAll();

        assertEquals(1, counts.get("NO_SYLLABUS"));
        // Extraction is disabled in a plain unit test, so nothing is stored
        // and the course is counted as not regenerated.
        assertEquals(1, counts.get("EXTRACTION_FAILED"));
    }

    @Test
    void markdownFormattingAndLinkUrlsDoNotBreakGrounding() {
        String foldedSource = CourseLearningGuideService.fold(SYLLABUS);
        java.util.Set<String> sourceTokens =
                new java.util.LinkedHashSet<>(List.of(foldedSource.split(" ")));

        // Rich-text edits (Gmail-style toolbar) keep their syllabus grounding:
        // only the content words are checked, never markers or link targets.
        assertTrue(CourseLearningGuideService.grounded(
                "**Hiểu được cú pháp** và kiểu dữ liệu của Python", sourceTokens, foldedSource));
        assertTrue(CourseLearningGuideService.grounded(
                "[Cú pháp Python](https://vi-du.example/ngoai-syllabus)", sourceTokens, foldedSource));
        assertTrue(CourseLearningGuideService.grounded(
                "## Hiểu được cú pháp và kiểu dữ liệu của Python", sourceTokens, foldedSource));
        assertTrue(CourseLearningGuideService.grounded(
                "<u>Viết được chương trình Python cơ bản</u> 🎯", sourceTokens, foldedSource));
        // Formatting must not smuggle in content words outside the syllabus.
        assertFalse(CourseLearningGuideService.grounded(
                "**Điện toán lượng tử** và qubit", sourceTokens, foldedSource));
    }

    @Test
    void syllabusHashIsStableAndChangesWithContent() {
        String first = CourseLearningGuideService.syllabusHash(SYLLABUS);
        assertEquals(first, CourseLearningGuideService.syllabusHash(SYLLABUS));
        assertFalse(first.equals(CourseLearningGuideService.syllabusHash(SYLLABUS + "\n- Hàm: Định nghĩa hàm.")));
    }
}
