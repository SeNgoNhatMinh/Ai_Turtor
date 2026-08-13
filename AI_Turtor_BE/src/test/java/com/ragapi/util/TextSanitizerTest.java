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
}
