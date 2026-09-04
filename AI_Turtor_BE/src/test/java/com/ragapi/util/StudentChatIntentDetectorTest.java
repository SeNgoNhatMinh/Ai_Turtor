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
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic(
                "Hôm nay mình hơi mệt, học chậm với mình nhé"));
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic(
                "Ngày mai mình muốn học tiếp phần Servlet"));
    }

    @Test
    void specificationFollowUpIsNotMistakenForOnGiStudyPlanningPhrase() {
        String question = "Servlet Specification giúp mình hiểu khái niệm của phần này với?";

        assertFalse(StudentChatIntentDetector.isAllowedInteraction(question));
        assertFalse(StudentChatIntentDetector.isStudyPlanningInteraction(question));
        assertTrue(StudentChatIntentDetector.isStudyPlanningInteraction("Mình nên ôn gì tiếp?"));
        assertFalse(StudentChatIntentDetector.isAllowedInteraction("Mình nên ôn gì tiếp?"));
    }

    @Test
    void topicStudyStartIsNotADefinitionDump() {
        assertTrue(StudentChatIntentDetector.isTopicStudyStart("Nay mình học Java Servlet"));
        assertTrue(StudentChatIntentDetector.isTopicStudyStart("Hôm nay mình học Servlet"));
        assertTrue(StudentChatIntentDetector.isTopicStudyStart("Mình muốn học JSP"));
        assertTrue(StudentChatIntentDetector.isTopicStudyStart("Nay mình học Alternative execution"));
        assertTrue(StudentChatIntentDetector.isTopicStudyStart("Học bài lập trình hướng đối tượng"));
        assertFalse(StudentChatIntentDetector.isTopicStudyStart("Servlet là gì?"));
        assertFalse(StudentChatIntentDetector.isTopicStudyStart("Hôm nay mình hơi mệt, học chậm với mình nhé"));
        assertFalse(StudentChatIntentDetector.isTopicStudyStart("mai mấy giờ học"));
    }

    @Test
    void academicDetectionUsesQuestionShapeNotDomainTerms() {
        assertTrue(StudentChatIntentDetector.looksLikeAcademicQuestion("Servlet là gì?"));
        assertTrue(StudentChatIntentDetector.looksLikeAcademicQuestion(
                "Vòng đời của Servlet gồm các hàm nào (init, service, destroy)?"));
        assertTrue(StudentChatIntentDetector.looksLikeAcademicQuestion(
                "Servlet Specification giúp mình hiểu khái niệm của phần này với?"));
        assertFalse(StudentChatIntentDetector.looksLikeAcademicQuestion("Java Servlet"));
        assertFalse(StudentChatIntentDetector.looksLikeAcademicQuestion("Nay mình học Java Servlet"));
        assertFalse(StudentChatIntentDetector.isOffTopicNonAcademic("Java Servlet"));
    }

    @Test
    void lessonStartIsDetectedFromNumberedBai() {
        assertTrue(StudentChatIntentDetector.isLessonStart("Bắt đầu bài 1: Servlet là gì?"));
        assertTrue(StudentChatIntentDetector.isLessonStart("Bài 2: Request và Response"));
        assertFalse(StudentChatIntentDetector.isLessonStart("Nay mình học Java Servlet"));
        assertFalse(StudentChatIntentDetector.isLessonStart(
                "Gợi ý học chuyên sâu bài 3: Cache"));
        assertFalse(StudentChatIntentDetector.isLessonStart(
                "Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu"));
    }

    @Test
    void lessonDeepPathIsNotANewRoadmapOrNextBai() {
        assertTrue(StudentChatIntentDetector.isLessonDeepPath(
                "Gợi ý học chuyên sâu bài 3: Cache"));
        assertTrue(StudentChatIntentDetector.isLessonDeepPath(
                "Học chuyên sâu bài 1: Servlet là gì?"));
        assertFalse(StudentChatIntentDetector.isLessonDeepPath(
                "Bắt đầu bài 3: Cache"));
        assertFalse(StudentChatIntentDetector.isLessonDeepPath(
                "Đào sâu bài 3: Cache miss"));
        assertFalse(StudentChatIntentDetector.isTopicStudyStart(
                "Gợi ý học chuyên sâu bài 3: Cache"));
    }

    @Test
    void lessonDeepTeachStaysOnCurrentNumberedLesson() {
        assertTrue(StudentChatIntentDetector.isLessonDeepTeach(
                "Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu"));
        assertFalse(StudentChatIntentDetector.isLessonDeepTeach(
                "Gợi ý học chuyên sâu bài 3: Cache"));
        assertFalse(StudentChatIntentDetector.isLessonStart(
                "Đào sâu bài 3: Cache miss"));
    }

    @Test
    void dependentFollowUpMatchesContinuationPhrasesOnly() {
        assertTrue(StudentChatIntentDetector.isDependentFollowUp("còn response thì sao?"));
        assertTrue(StudentChatIntentDetector.isDependentFollowUp("ví dụ đi"));
        assertTrue(StudentChatIntentDetector.isDependentFollowUp("có ví dụ ko?"));
        assertTrue(StudentChatIntentDetector.isDependentFollowUp("cho ví dụ"));
        assertTrue(StudentChatIntentDetector.isDependentFollowUp("giải thích thêm"));
        assertTrue(StudentChatIntentDetector.isDependentFollowUp("chưa hiểu chỗ Tomcat"));
        assertFalse(StudentChatIntentDetector.isDependentFollowUp("mai mấy giờ học"));
        assertFalse(StudentChatIntentDetector.isDependentFollowUp("xin chào"));
        assertFalse(StudentChatIntentDetector.isDependentFollowUp("Nay mình học JDBC"));
        assertFalse(StudentChatIntentDetector.isDependentFollowUp("Servlet là gì?"));
        assertFalse(StudentChatIntentDetector.isDependentFollowUp("JSP Document là gì?"));
        assertFalse(StudentChatIntentDetector.isDependentFollowUp(
                "Servlet Specification giúp mình hiểu khái niệm của phần này với?"));
    }
}
