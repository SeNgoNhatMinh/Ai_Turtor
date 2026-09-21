package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StudentFacingMessagesTest {

    @Test
    void recognizesGeneratedInsufficientMaterialAnswers() {
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Material không đủ để trả lời câu hỏi."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "The course material is not enough to answer this question."));
        assertFalse(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu giải thích cách dùng get trong dictionary."));
    }
}
