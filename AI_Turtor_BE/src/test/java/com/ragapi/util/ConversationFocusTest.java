package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ConversationFocusTest {

    @Test
    void lastSubstantiveStudentQuestionSkipsExampleFollowUps() {
        String history = """
                - Student: Nay mình học Java Servlet
                - Tutor: Lộ trình Bài 1
                - Student: Servlet Specification giúp mình hiểu khái niệm của phần này với?
                - Tutor: Servlet Specification là một phần của Java EE
                - Student: có ví dụ ko?
                """;

        assertEquals(
                "Servlet Specification giúp mình hiểu khái niệm của phần này với?",
                ConversationFocus.lastSubstantiveStudentQuestion(history)
        );
    }

    @Test
    void lastSubstantiveStudentQuestionIgnoresGreetingsAndSchedule() {
        String history = """
                - Student: xin chào
                - Tutor: Chào bạn
                - Student: mai mấy giờ học
                - Tutor: Mình không có lịch lớp
                - Student: Servlet là gì?
                """;

        assertEquals("Servlet là gì?", ConversationFocus.lastSubstantiveStudentQuestion(history));
    }

    @Test
    void emptyHistoryYieldsEmptyFocus() {
        assertEquals("", ConversationFocus.lastSubstantiveStudentQuestion(null));
        assertEquals("", ConversationFocus.lastSubstantiveStudentQuestion(""));
    }
}
