package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TextSanitizerTest {

    @Test
    void repairsCommonMojibake() {
        // UTF-8 "Bạn muốn học" misread as Latin-1/Windows-1252
        String broken = "B\u00e1\u00ba\u00a1n mu\u00e1\u00bb\u0081n h\u00e1\u00bb\u008dc JSP";
        String cleaned = TextSanitizer.cleanForStudentAnswer(broken);
        assertTrue(cleaned.contains("Bạn") || cleaned.contains("muốn") || cleaned.contains("học"));
        assertFalse(cleaned.contains("\u00c3"));
    }

    @Test
    void stripsPromptNarrationFromStudentAnswers() {
        String leaked = """
                ## Giải thích
                TLD ánh xạ thẻ JSP sang Tag Handler.

                ## Bài tiếp theo
                (Omit as per instruction: "otherwise omit." I'll omit it to be safe.)
                - Wait, the prompt says:
                """;
        String cleaned = TextSanitizer.cleanForStudentAnswer(leaked);
        assertFalse(cleaned.toLowerCase().contains("the prompt says"));
        assertFalse(cleaned.contains("## Bài tiếp theo"));
        assertTrue(cleaned.contains("TLD ánh xạ"));
    }

    @Test
    void preservesVietnameseWithDiacritics() {
        String input = "Hệ thống chưa có tài liệu của môn PRJ301.";
        assertEquals(input, TextSanitizer.cleanForStudentAnswer(input));
    }

    @Test
    void detectsSystemFailureAnswersWithoutDiacritics() {
        assertTrue(TextSanitizer.isSystemFailureOrEscalationAnswer(
                "Loi may chu: Code Mentor chua the phan tich luc nay."));
    }

    @Test
    void detectsSystemFailureAnswersWithDiacritics() {
        assertTrue(TextSanitizer.isSystemFailureOrEscalationAnswer(
                "Lỗi máy chủ: Code Mentor chưa thể phân tích lúc này."));
    }

    @Test
    void normalizeAccentInsensitiveMatchesWithAndWithoutDiacritics() {
        String withDiacritics = TextSanitizer.normalizeAccentInsensitive("máy ảo Java");
        String withoutDiacritics = TextSanitizer.normalizeAccentInsensitive("may ao Java");
        assertEquals(withDiacritics, withoutDiacritics);
    }

    @Test
    void cleanListRemovesBlankEntries() {
        assertEquals(2, TextSanitizer.cleanList(java.util.List.of(" Servlet ", "", "JSP")).size());
    }

    @Test
    void stripsClosedReasoningBlockAndKeepsFinalAnswer() {
        String answer = "<think>private chain of thought</think>\n## Theo tài liệu môn học\nServlet có init, service và destroy.";

        String cleaned = TextSanitizer.cleanForStudentAnswer(answer);

        assertFalse(cleaned.contains("private chain of thought"));
        assertTrue(cleaned.startsWith("## Theo tài liệu môn học"));
    }

    @Test
    void rejectsUnclosedReasoningOnlyOutput() {
        String answer = "<think>Here's a thinking process: [Output Generation] draft only";

        assertEquals("", TextSanitizer.cleanForStudentAnswer(answer));
    }
}
