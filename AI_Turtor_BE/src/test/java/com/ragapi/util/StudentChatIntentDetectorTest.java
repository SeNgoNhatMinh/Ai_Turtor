package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StudentChatIntentDetectorTest {

    @Test
    void allowsGreetingAndThanks() {
        assertTrue(StudentChatIntentDetector.isAllowedInteraction("xin chào"));
        assertTrue(StudentChatIntentDetector.isAllowedInteraction("cảm ơn bạn"));
        assertTrue(StudentChatIntentDetector.isAllowedInteraction("bạn là ai"));
    }

    @Test
    void blocksClassScheduleQuestionsIncludingTypos() {
        assertTrue(StudentChatIntentDetector.isOffTopicNonAcademic("mai mấy giờ học"));
        assertTrue(StudentChatIntentDetector.isOffTopicNonAcademic("mai maays giowf hoc"));
        assertTrue(StudentChatIntentDetector.isOffTopicNonAcademic("hôm nay có học không"));
        assertTrue(StudentChatIntentDetector.isOffTopicNonAcademic("lịch học tuần này"));
    }

    @Test
    void keepsAcademicQuestionsOnRagPath() {
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic("what is CEA?"));
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic("short-term scheduler là gì"));
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic("FireWire khác gì Infiniband"));
    }

    @Test
    void conversationalQuestionsAreNotMarkedOffTopic() {
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic("xin chào"));
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic("mình nên hỏi gì"));
    }
}
