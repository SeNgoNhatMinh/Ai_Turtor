package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PromptLeakFilterTest {

    @Test
    void stripsNarratedPromptFromNextLesson() {
        String raw = """
                ## Kiểm tra hiểu
                Câu hỏi: TLD dùng để làm gì?
                A. Servlet Container
                B. Tag Library Descriptor (TLD)
                C. XML Parser
                Đáp án: B

                ## Bài tiếp theo
                (Omit as per instruction: "Name the next Bài only when teaching a numbered lesson path; otherwise omit." I don't have a numbered path provided, so I'll omit or just leave it blank as instructed. Actually, the prompt says "Name the next Bài only when teaching a numbered lesson path; otherwise omit." I'll omit it to be safe, or I can just include the heading.)
                - Wait, the prompt says:
                - "## Bài tiếp theo
                """;
        String cleaned = PromptLeakFilter.strip(raw);
        assertFalse(cleaned.contains("the prompt says"));
        assertFalse(cleaned.contains("numbered path provided"));
        assertFalse(cleaned.contains("Omit as per"));
        assertFalse(cleaned.contains("## Bài tiếp theo"));
        assertTrue(cleaned.contains("## Kiểm tra hiểu"));
        assertTrue(cleaned.contains("Đáp án: B"));
    }

    @Test
    void keepsARealNextLessonBullet() {
        String raw = """
                ## Bài tiếp theo
                - Bài 6: JSP custom tag runtime
                """;
        assertEquals(raw.trim(), PromptLeakFilter.strip(raw));
        assertFalse(PromptLeakFilter.isLeakLine("- Bài 6: JSP custom tag runtime"));
        assertTrue(PromptLeakFilter.hasValidNextLesson(raw));
    }

    @Test
    void insertsNextLessonBeforeSources() {
        String raw = """
                ## Kiểm tra hiểu
                Câu hỏi: TLD?
                A. A
                B. B

                ## Nguồn tài liệu đã dùng
                material-1
                """;
        String filled = PromptLeakFilter.insertNextLesson(raw, "- Bài 6: Custom tag runtime");
        assertTrue(filled.contains("## Bài tiếp theo"));
        assertTrue(filled.contains("- Bài 6: Custom tag runtime"));
        assertTrue(filled.indexOf("## Bài tiếp theo") < filled.indexOf("## Nguồn tài liệu đã dùng"));
    }

    @Test
    void replaceNextLessonOverridesAWrongPathBullet() {
        String raw = """
                ## Giải thích
                Câu lệnh if kiểm tra điều kiện.

                ## Bài tiếp theo
                - Bài 2: Nắm rõ đặc điểm và cách hoạt động của vòng lặp for (definite) và while (indefinite)

                ## Nguồn tài liệu đã dùng
                material-1
                """;
        String replaced = PromptLeakFilter.replaceNextLesson(
                raw,
                "- Bài 2: Toán tử so sánh – các phép so sánh (==, !=, >, <, >=, <=) dùng trong điều kiện."
        );
        assertTrue(replaced.contains("## Bài tiếp theo"));
        assertTrue(replaced.contains("- Bài 2: Toán tử so sánh"));
        assertFalse(replaced.contains("vòng lặp for"));
        assertTrue(replaced.indexOf("## Bài tiếp theo") < replaced.indexOf("## Nguồn tài liệu đã dùng"));
    }

    @Test
    void dropNextLessonRemovesTheHeadingWhenPathIsFinished() {
        String raw = """
                ## Giải thích
                Bài cuối.

                ## Bài tiếp theo
                - Bài 7: Một chương khác

                ## Nguồn tài liệu đã dùng
                material-1
                """;
        String dropped = PromptLeakFilter.dropNextLesson(raw);
        assertFalse(dropped.contains("## Bài tiếp theo"));
        assertFalse(dropped.contains("Một chương khác"));
        assertTrue(dropped.contains("Bài cuối."));
        assertTrue(dropped.contains("## Nguồn tài liệu đã dùng"));
    }

    @Test
    void stripsNumberedCurriculumFromNormalAnswers() {
        String raw = """
                ## Theo tài liệu môn học
                OOP gom dữ liệu và hành vi vào đối tượng.

                ## Bài tiếp theo
                - Bài 1: Tổng quan OOP
                - Bài 2: Kế thừa

                ## Lưu ý để học tốt hơn
                - Ôn encapsulation
                """;
        String cleaned = PromptLeakFilter.stripNumberedCurriculum(raw);
        assertFalse(cleaned.contains("## Bài tiếp theo"));
        assertFalse(cleaned.contains("Bài 1:"));
        assertTrue(cleaned.contains("OOP gom dữ liệu"));
        assertTrue(cleaned.contains("Ôn encapsulation"));
    }
}
