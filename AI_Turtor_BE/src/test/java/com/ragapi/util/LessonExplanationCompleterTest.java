package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LessonExplanationCompleterTest {

    @Test
    void detectsQuizOnlyLesson() {
        String raw = """
                ## Kiểm tra hiểu
                Câu hỏi: TLD dùng để làm gì?
                A. Servlet Container
                B. Tag Library Descriptor (TLD)
                C. XML Parser
                Đáp án: B
                """;
        assertTrue(LessonExplanationCompleter.missingLessonBody(raw));
    }

    @Test
    void keepsARealExplanation() {
        String raw = """
                ## Giải thích
                Khi triển khai custom tag, JSP cần TLD để ánh xạ thẻ XML sang lớp Tag Handler.
                Container đọc TLD, tìm uri và tag-class, rồi gọi handler lúc runtime.
                SimpleTag và Tag là hai kiểu handler phổ biến trong tài liệu.

                ## Kiểm tra hiểu
                Câu hỏi: Thành phần nào ánh xạ thẻ?
                A. Servlet Container
                B. TLD
                C. XML Parser
                Đáp án: B
                """;
        assertFalse(LessonExplanationCompleter.missingLessonBody(raw));
    }

    @Test
    void prependsExplanationBeforeQuiz() {
        String quizOnly = """
                ## Kiểm tra hiểu
                Câu hỏi: TLD dùng để làm gì?
                A. Container
                B. TLD
                C. Parser
                Đáp án: B
                """;
        String filled = LessonExplanationCompleter.prependExplanation(
                quizOnly,
                "## Giải thích\nTLD mô tả custom tag và trỏ tới Tag Handler để container thực thi."
        );
        assertTrue(filled.indexOf("## Giải thích") < filled.indexOf("## Kiểm tra hiểu"));
        assertTrue(filled.contains("TLD mô tả custom tag"));
        assertTrue(filled.contains("Đáp án: B"));
    }
}
