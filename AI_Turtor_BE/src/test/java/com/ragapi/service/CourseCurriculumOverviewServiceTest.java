package com.ragapi.service;

import com.ragapi.dto.CourseCurriculumOverview;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CourseCurriculumOverviewServiceTest {

    @Test
    void parsesOfficialSyllabusWithoutCallingAnAiModel() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                Nội dung chính trong chương trình học:
                - **Cú pháp Python**: Biến, kiểu dữ liệu, biểu thức và toán tử.
                - Nhập xuất & tương tác: Nhận dữ liệu người dùng và in kết quả.
                - Cấu trúc điều khiển: if/elif/else, for và while.
                """
        );

        assertEquals(
                List.of("Cú pháp Python", "Nhập xuất & tương tác", "Cấu trúc điều khiển"),
                overview.unitTitles()
        );
        assertTrue(overview.units().get(0).detail().contains("Biến"));
        // No intro was supplied by the school, so nothing is invented.
        assertEquals("", overview.summary());
        assertTrue(overview.objectives().isEmpty());
    }

    @Test
    void parsesObjectivesOnlyWhenTheSyllabusStatesThem() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                Mục tiêu học tập:
                - Viết được chương trình Python cơ bản
                - Áp dụng được OOP vào bài toán nhỏ
                Nội dung chính trong chương trình học:
                - Cú pháp Python: Biến và kiểu dữ liệu.
                - OOP: Lớp và đối tượng.
                """
        );

        assertEquals(
                List.of("Viết được chương trình Python cơ bản", "Áp dụng được OOP vào bài toán nhỏ"),
                overview.objectives()
        );
        assertEquals(List.of("Cú pháp Python", "OOP"), overview.unitTitles());
    }

    @Test
    void welcomeUsesOneTemplateWithoutKeywordOrRoadmapInvention() {
        CourseCurriculumOverviewService service =
                new CourseCurriculumOverviewService(null, null);
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                - Cú pháp Python: Biến và kiểu dữ liệu.
                - Cấu trúc điều khiển: if/else và vòng lặp.
                """
        );

        String welcome = service.welcomeMarkdown(overview, null);

        assertTrue(welcome.startsWith("## Chào mừng bạn đến với môn PFP191"));
        assertTrue(welcome.contains("### Nội dung chính trong chương trình học"));
        assertFalse(welcome.contains("Gợi ý từ khóa"));
        assertFalse(welcome.contains("Mục tiêu học tập"));
        assertFalse(welcome.contains("lộ trình"));
        assertFalse(welcome.contains("Chương trình học chính thức của môn"));
    }

    @Test
    void welcomeStatesMissingSyllabusInsteadOfInventingContent() {
        CourseCurriculumOverviewService service =
                new CourseCurriculumOverviewService(null, null);

        String welcome = service.welcomeMarkdown(CourseCurriculumOverview.empty("XYZ101"), null);

        assertTrue(welcome.contains("Chưa có thông tin syllabus"));
        assertFalse(welcome.contains("Mục tiêu học tập"));
    }

    @Test
    void promptSuggestionsComeFromSyllabusAndDedupeObjectivesAndUnits() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                Mục tiêu học tập:
                - Cú pháp Python
                Nội dung chính trong chương trình học:
                - Cú pháp Python: Biến và kiểu dữ liệu.
                - Cấu trúc điều khiển: if/else và vòng lặp.
                """
        );

        List<String> suggestions = CourseCurriculumOverviewService.promptSuggestions(
                overview, List.of("Cấu trúc điều khiển", "Biến là gì?"));

        assertEquals(List.of("Cấu trúc điều khiển", "Biến là gì?", "Cú pháp Python"), suggestions);
    }

    @Test
    void parsesBulletSyllabusWithoutColonSeparators() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                - Knowledge about programming language has become an essential part of an education.
                - In recent years, python has emerged as a popular language for AI and Data Science.
                - This course covers fundamental concepts and object-oriented programming (OOP).
                """
        );

        assertEquals(3, overview.units().size());
        assertTrue(overview.unitTitles().get(0).contains("Knowledge about programming"));
        assertTrue(overview.unitTitles().get(2).contains("object-oriented programming"));
    }
}
