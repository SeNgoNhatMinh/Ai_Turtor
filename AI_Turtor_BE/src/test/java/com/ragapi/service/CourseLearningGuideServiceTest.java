package com.ragapi.service;

import com.ragapi.entity.Course;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
        assertEquals(List.of("Python"), extraction.keywords());
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
    void syllabusHashIsStableAndChangesWithContent() {
        String first = CourseLearningGuideService.syllabusHash(SYLLABUS);
        assertEquals(first, CourseLearningGuideService.syllabusHash(SYLLABUS));
        assertFalse(first.equals(CourseLearningGuideService.syllabusHash(SYLLABUS + "\n- Hàm: Định nghĩa hàm.")));
    }
}
