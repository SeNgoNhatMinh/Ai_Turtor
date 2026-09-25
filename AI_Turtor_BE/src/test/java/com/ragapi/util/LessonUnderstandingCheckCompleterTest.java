package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LessonUnderstandingCheckCompleterTest {

    @Test
    void insertsGroundedCheckBeforeFollowUpSections() {
        String answer = """
                ## Giải thích
                Python dùng `print()` để hiển thị dữ liệu và `input()` để nhận dữ liệu do người dùng nhập.

                ## Học chuyên sâu
                - Kiểu dữ liệu trả về từ input

                ## Nguồn tài liệu đã dùng
                material-1
                """;
        String check = """
                ## Kiểm tra hiểu
                Câu hỏi: Hàm nào nhận dữ liệu người dùng nhập?
                A. print()
                B. input()
                C. len()
                Đáp án: B
                Giải thích: Theo tài liệu, `input()` nhận dữ liệu nhập từ người dùng.
                """;

        String completed = LessonUnderstandingCheckCompleter.insert(answer, check);

        assertTrue(LessonUnderstandingCheckCompleter.hasUsableCheck(completed));
        assertTrue(completed.indexOf("## Kiểm tra hiểu") < completed.indexOf("## Học chuyên sâu"));
        assertTrue(completed.indexOf("## Kiểm tra hiểu") < completed.indexOf("## Nguồn tài liệu đã dùng"));
    }

    @Test
    void rejectsGeneratedTextWithoutAUsableQuiz() {
        String answer = "## Giải thích\nNội dung bài học.";

        String completed = LessonUnderstandingCheckCompleter.insert(
                answer,
                "## Kiểm tra hiểu\nHãy tự ôn lại bài."
        );

        assertFalse(LessonUnderstandingCheckCompleter.hasUsableCheck(completed));
        assertFalse(completed.contains("Hãy tự ôn lại bài"));
    }
}
