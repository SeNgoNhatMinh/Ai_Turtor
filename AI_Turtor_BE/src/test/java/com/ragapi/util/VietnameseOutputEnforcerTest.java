package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VietnameseOutputEnforcerTest {

    @Test
    void detectsTonelessVietnameseNeedingCorrection() {
        String toneless = """
                ## Theo tai lieu mon hoc
                Ban can hoc servlet va JSP de hieu ro hon.
                Day la noi dung tu materialId=abc123.
                """;
        assertTrue(VietnameseOutputEnforcer.needsDiacriticsCorrection(toneless));
    }

    @Test
    void acceptsProperVietnameseWithDiacritics() {
        String proper = """
                ## Theo tài liệu môn học
                Bạn cần học servlet và JSP để hiểu rõ hơn.
                """;
        assertFalse(VietnameseOutputEnforcer.needsDiacriticsCorrection(proper));
    }

    @Test
    void skipsEnglishPrimaryAnswers() {
        String english = """
                ## From course material
                Servlet is a Java component that handles HTTP requests in a web application.
                You should review deployment descriptor and web.xml configuration examples.
                """;
        assertFalse(VietnameseOutputEnforcer.needsDiacriticsCorrection(english));
    }

    @Test
    void wrapPromptAppendsMandatoryRuleOnce() {
        String wrapped = VietnameseOutputEnforcer.wrapPrompt("Answer briefly.");
        assertTrue(wrapped.contains("MANDATORY VIETNAMESE OUTPUT"));
        assertEquals(wrapped, VietnameseOutputEnforcer.wrapPrompt(wrapped));
    }

    @Test
    void wrapOllamaCompletenessAsksForFinishedShortAnswers() {
        String wrapped = VietnameseOutputEnforcer.wrapOllamaCompleteness("Answer briefly.");
        assertTrue(wrapped.contains("LOCAL MODEL OUTPUT BUDGET"));
        assertTrue(wrapped.contains("Write a FULL student-facing lesson"));
        assertEquals(wrapped, VietnameseOutputEnforcer.wrapOllamaCompleteness(wrapped));
    }
}
