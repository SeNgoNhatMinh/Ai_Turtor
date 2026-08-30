package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UnderstandingCheckKeyCompleterTest {

    @Test
    void recognizesAnswerWithoutColonAsPresent() {
        String raw = """
                ## Giải thích
                Controller nối View và Model.

                ## Kiểm tra hiểu
                Câu hỏi: Vai trò của Controller?
                A. Chỉ View
                B. View và Model
                C. Chỉ Model
                Đáp án B
                """;
        assertEquals("B", UnderstandingCheckKeyCompleter.extractKey(raw));
        assertFalse(UnderstandingCheckKeyCompleter.missingAnswerKey(raw));
        assertEquals(raw, UnderstandingCheckKeyCompleter.completeLocally(raw));
    }

    @Test
    void injectsKeyFromLeakedChoice() {
        String raw = """
                ## Kiểm tra hiểu
                Câu hỏi: MVC Controller làm gì?
                A. Chỉ View
                B. View và Model
                C. Chỉ Model. Nếu bạn chọn đáp án B, hãy đọc lại phần View.
                """;
        String completed = UnderstandingCheckKeyCompleter.completeLocally(raw);
        assertTrue(completed.contains("Đáp án: B"));
    }

    @Test
    void flagsMissingKeyWhenOptionsHaveNoLetter() {
        String raw = """
                ## Kiểm tra hiểu
                Câu hỏi: Lần lặp thứ hai lấy gì?
                A. apple
                B. banana
                C. cherry
                """;
        assertTrue(UnderstandingCheckKeyCompleter.missingAnswerKey(raw));
        assertEquals(raw, UnderstandingCheckKeyCompleter.completeLocally(raw));
    }

    @Test
    void applyPatchInsertsTwoLines() {
        String raw = """
                ## Kiểm tra hiểu
                Câu hỏi: Lần lặp thứ hai lấy gì?
                A. apple
                B. banana
                C. cherry

                ## Bài tiếp theo
                - Bài 2: Biến lặp
                """;
        String patched = UnderstandingCheckKeyCompleter.applyPatch(raw, """
                Đáp án: B
                Giải thích: Index 1 là banana.
                """);
        assertTrue(patched.contains("Đáp án: B"));
        assertTrue(patched.contains("Giải thích: Index 1 là banana."));
        assertTrue(patched.contains("## Bài tiếp theo"));
    }

    @Test
    void leavesAnswersWithoutQuizUnchanged() {
        String raw = "## Theo tài liệu môn học\nServlet xử lý HTTP request.";
        assertEquals(raw, UnderstandingCheckKeyCompleter.completeLocally(raw));
        assertFalse(UnderstandingCheckKeyCompleter.missingAnswerKey(raw));
    }
}
