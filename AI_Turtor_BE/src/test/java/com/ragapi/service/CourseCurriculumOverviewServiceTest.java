package com.ragapi.service;

import com.ragapi.dto.CourseCurriculumOverview;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CourseCurriculumOverviewServiceTest {

    @Test
    void parsesVietnameseCurriculumUnitsFromModelJson() {
        CourseCurriculumOverview overview = CourseCurriculumOverviewService.parse(
                "PFP191",
                "Programming Fundamentals with Python",
                """
                ```json
                {
                  "summary": "Môn Cơ sở lập trình với Python, trang bị tư duy logic và kỹ năng lập trình cơ bản.",
                  "units": [
                    {"title": "Nền tảng cú pháp", "detail": "Biến, kiểu dữ liệu, biểu thức và toán tử."},
                    {"title": "Cấu trúc điều khiển", "detail": "if/elif/else, for và while."},
                    {"title": "Hàm và chia nhỏ bài toán", "detail": "Định nghĩa hàm, tham số, giá trị trả về."}
                  ]
                }
                ```
                """);

        assertEquals("Môn Cơ sở lập trình với Python, trang bị tư duy logic và kỹ năng lập trình cơ bản.",
                overview.summary());
        assertEquals(List.of("Nền tảng cú pháp", "Cấu trúc điều khiển", "Hàm và chia nhỏ bài toán"),
                overview.unitTitles());
        assertTrue(overview.units().get(0).detail().contains("Biến"));
    }

    @Test
    void promptAsksToGroupHeadingsIntoCurriculumBlocks() {
        String prompt = CourseCurriculumOverviewService.buildPrompt(
                "PFP191",
                "Programming Fundamentals with Python",
                "",
                List.of("Adding new functions", "Alternative execution", "Boolean expressions"));
        assertTrue(prompt.contains("PFP191"));
        assertTrue(prompt.contains("Adding new functions"));
        assertTrue(prompt.contains("MAIN curriculum blocks"));
        assertTrue(prompt.contains("Vietnamese"));
    }
}
