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
}
