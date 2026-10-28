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
        // Keywords are copied from the chapter/topic list itself, so every
        // keyword is guaranteed to appear in the school document.
        assertEquals(
                List.of("Cú pháp Python", "Nhập xuất & tương tác", "Cấu trúc điều khiển"),
                overview.keywords());
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
    void parsesSkillObjectivesSeparatelyFromKnowledgeObjectives() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                Mục tiêu kiến thức:
                - Hiểu được cú pháp và kiểu dữ liệu của Python
                Mục tiêu kỹ năng:
                - Viết được chương trình Python cơ bản
                - Debug được lỗi logic trong vòng lặp
                Nội dung chính trong chương trình học:
                - Cú pháp Python: Biến và kiểu dữ liệu.
                """
        );

        assertEquals(List.of("Hiểu được cú pháp và kiểu dữ liệu của Python"), overview.objectives());
        assertEquals(
                List.of("Viết được chương trình Python cơ bản", "Debug được lỗi logic trong vòng lặp"),
                overview.skillObjectives()
        );
    }

    @Test
    void welcomeFollowsTheNumberedTemplateWithRealTopics() {
        CourseCurriculumOverviewService service =
                new CourseCurriculumOverviewService(null, null);
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                Mục tiêu kiến thức:
                - Hiểu được cú pháp và kiểu dữ liệu của Python
                Mục tiêu kỹ năng:
                - Viết được chương trình Python cơ bản
                Nội dung chính trong chương trình học:
                - Cú pháp Python: Biến và kiểu dữ liệu.
                - Cấu trúc điều khiển: if/else và vòng lặp.
                """
        );

        String welcome = service.welcomeMarkdown(overview);

        assertTrue(welcome.startsWith("# Chào mừng bạn đến với môn PFP191 – Programming Fundamentals with Python"));
        assertTrue(welcome.contains("được xây dựng dựa trên syllabus và tài liệu học tập do nhà trường cung cấp"));
        assertTrue(welcome.contains("## 1. Tổng quan môn học"));
        assertTrue(welcome.contains("### Mục tiêu kiến thức"));
        assertTrue(welcome.contains("Sau khi hoàn thành môn học, sinh viên có thể:"));
        assertTrue(welcome.contains("### Mục tiêu kỹ năng"));
        assertTrue(welcome.contains("## 2. Các chủ đề trọng tâm"));
        assertTrue(welcome.contains("## 3. Từ khóa"));
        assertTrue(welcome.contains("`Cú pháp Python`"));
        assertTrue(welcome.contains("`Cấu trúc điều khiển`"));
        assertTrue(welcome.contains("## 4. Gợi ý học tập"));
        assertTrue(welcome.contains("- Tôi muốn tìm hiểu về Cú pháp Python."));
        assertTrue(welcome.contains("- Kiểm tra kiến thức của tôi về Cấu trúc điều khiển."));
        assertTrue(welcome.endsWith("**Mẹo:** Hãy chọn một chủ đề cụ thể để AI Tutor tìm kiếm tài liệu liên quan"
                + " và hỗ trợ bạn học tập theo nội dung của môn học."));
        assertFalse(welcome.contains("Gợi ý từ khóa"));
        assertFalse(welcome.contains("lộ trình"));
    }

    @Test
    void welcomeNeverEchoesAStartWithSentence() {
        CourseCurriculumOverviewService service =
                new CourseCurriculumOverviewService(null, null);
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "CEA201",
                "Computer Organization and Architecture",
                """
                Nội dung chính trong chương trình học:
                - Cấu trúc CPU: Thanh ghi và chu kỳ lệnh.
                """);

        String welcome = service.welcomeMarkdown(overview);

        assertFalse(welcome.contains("Hôm nay chúng ta bắt đầu với"));
        assertTrue(welcome.contains("Cấu trúc CPU"));
    }

    @Test
    void welcomeSuggestionsNeverUseLongSentenceLikeTitles() {
        CourseCurriculumOverviewService service =
                new CourseCurriculumOverviewService(null, null);
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PRO192",
                "Object-Oriented Programming",
                """
                - Môn học này giới thiệu cho sinh viên về lập trình hướng đối tượng và cách xây dựng các đối tượng có thể tái sử dụng trong chương trình Java một cách đầy đủ và chi tiết nhất
                - Kế thừa: Lớp cha và lớp con.
                """
        );

        String welcome = service.welcomeMarkdown(overview);

        assertTrue(welcome.contains("- Tôi muốn tìm hiểu về Kế thừa."));
        assertFalse(welcome.contains("Tôi muốn tìm hiểu về Môn học này giới thiệu"));
    }

    @Test
    void welcomeStatesMissingSyllabusInsteadOfInventingContent() {
        CourseCurriculumOverviewService service =
                new CourseCurriculumOverviewService(null, null);

        String welcome = service.welcomeMarkdown(CourseCurriculumOverview.empty("XYZ101"));

        assertTrue(welcome.contains("Chưa có thông tin syllabus"));
        assertFalse(welcome.contains("Mục tiêu kiến thức"));
        assertFalse(welcome.contains("Mục tiêu kỹ năng"));
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
    void syllabusSummaryIsLimitedToTwoLines() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                Môn học giới thiệu lập trình Python cho người mới bắt đầu. Sinh viên làm quen cú pháp nền tảng qua ví dụ nhỏ. Phần cuối còn luyện kỹ năng gỡ lỗi và viết chương trình hoàn chỉnh.
                Nội dung chính trong chương trình học:
                - Cú pháp Python: Biến và kiểu dữ liệu.
                """
        );

        assertTrue(overview.summary().startsWith("Môn học giới thiệu lập trình Python"));
        assertTrue(overview.summary().contains("Sinh viên làm quen cú pháp nền tảng"));
        assertFalse(overview.summary().contains("Phần cuối còn luyện"));
    }

    @Test
    void parsesLetteredKnowledgeAndSkillsHeadings() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parseSyllabus(
                "PRJ301",
                "Java Web Application Development",
                """
                By the end of this course Students will be able to:
                a) Knowledge: (what will students know?)
                - Understand the core technologies of Java web programming:
                - Servlet and JSP
                - Scope of sharing state (session, application, request, page)
                b) Skills: (what will students be able to do?)
                - Basic Web application development applying MVC Design Pattern
                """
        );

        assertEquals(
                List.of("Understand the core technologies of Java web programming:",
                        "Servlet and JSP", "Scope of sharing state (session, application, request, page)"),
                overview.objectives());
        assertEquals(
                List.of("Basic Web application development applying MVC Design Pattern"),
                overview.skillObjectives());
        assertFalse(overview.summary().contains("Servlet"));
        assertTrue(overview.units().isEmpty());
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
