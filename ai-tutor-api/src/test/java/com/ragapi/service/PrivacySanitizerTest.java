package com.ragapi.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrivacySanitizerTest {

    private final PrivacySanitizer sanitizer = new PrivacySanitizer(true);

    @Test
    void redactsCredentialsAndStudentPii() {
        String input = "MSSV SE123456, email student@example.com, phone 0912 345 678, "
                + "CCCD 012345678901, key sk-or-v1-abcdefghijklmnopqrstuvwxyz123456";

        String result = sanitizer.sanitize(input);

        assertFalse(result.contains("SE123456"));
        assertFalse(result.contains("student@example.com"));
        assertFalse(result.contains("0912 345 678"));
        assertFalse(result.contains("012345678901"));
        assertFalse(result.contains("sk-or-v1-"));
        assertTrue(result.contains("[STUDENT_ID]"));
        assertTrue(result.contains("[EMAIL]"));
        assertTrue(result.contains("[PHONE]"));
        assertTrue(result.contains("[NATIONAL_ID]"));
        assertTrue(result.contains("[API_KEY]"));
    }

    @Test
    void preservesCourseCodesAndLearningContent() {
        String input = "PRO192: explain ArrayList and Java for-loop exercise 12345.";
        assertEquals(input, sanitizer.sanitize(input));
    }

    @Test
    void canBeDisabledForPrivateInfrastructure() {
        PrivacySanitizer disabled = new PrivacySanitizer(false);
        String input = "student@example.com";
        assertEquals(input, disabled.sanitize(input));
    }
}
