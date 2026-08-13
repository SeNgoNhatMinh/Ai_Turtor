package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class QuizContentFilterTest {

    @Test
    void sanitizeRemovesTocIndexAndSourceMetadata() {
        String raw = """
                Source URL: https://example.com/oop
                Page title: OOP Guide

                Ticket class, 65
                Contact class, 165-166

                Inheritance allows a subclass to reuse fields and methods of a superclass.
                Polymorphism lets one interface refer to many underlying forms.
                """;
        String cleaned = QuizContentFilter.sanitizeMaterialContextForQuiz(raw);
        assertFalse(cleaned.contains("Source URL:"));
        assertFalse(cleaned.contains("Page title:"));
        assertFalse(cleaned.contains("Ticket class, 65"));
        assertTrue(cleaned.contains("Inheritance allows"));
        assertTrue(cleaned.contains("Polymorphism"));
    }

    @Test
    void rejectsPageNumberQuestions() {
        assertFalse(QuizContentFilter.isAcademicQuizQuestion(
                "Lớp Ticket được tham chiếu ở trang 65 trong tài liệu.",
                "Trong tài liệu có ghi 'Ticket class, 65'."));
        assertFalse(QuizContentFilter.isAcademicQuizQuestion(
                "Contact class appears on pages 165 and 166.",
                null));
    }

    @Test
    void acceptsConceptQuestions() {
        assertTrue(QuizContentFilter.isAcademicQuizQuestion(
                "Kế thừa (inheritance) trong OOP cho phép lớp con tái sử dụng thuộc tính của lớp cha.",
                "Đúng vì subclass kế thừa fields/methods từ superclass."));
        assertTrue(QuizContentFilter.isAcademicQuizQuestion(
                "Interface trong Java có thể chứa phương thức default từ Java 8.",
                null));
    }
}
