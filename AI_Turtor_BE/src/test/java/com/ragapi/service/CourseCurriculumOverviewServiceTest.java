package com.ragapi.service;

import com.ragapi.dto.CourseCurriculumOverview;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
        assertTrue(overview.summary().contains("nhà trường"));
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
