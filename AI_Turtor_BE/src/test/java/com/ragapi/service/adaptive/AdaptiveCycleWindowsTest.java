package com.ragapi.service.adaptive;

import com.ragapi.dto.UnderstandingCheckAttempt;
import com.ragapi.dto.UnderstandingCheckPayload;
import com.ragapi.entity.AiMessage;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdaptiveCycleWindowsTest {

    private static AiMessage message(String id, String role, String content, int minute) {
        AiMessage message = new AiMessage();
        message.setId(id);
        message.setRole(role);
        message.setContent(content);
        message.setCreatedAt(LocalDateTime.of(2026, 10, 2, 9, 0).plusMinutes(minute));
        return message;
    }

    /** {@code questions} student/assistant pairs, oldest first. */
    private static List<AiMessage> chat(int questions) {
        List<AiMessage> messages = new ArrayList<>();
        for (int i = 0; i < questions; i++) {
            messages.add(message("stu-" + i, "STUDENT", "Câu hỏi " + i, i * 2));
            messages.add(message("ai-" + i, "ASSISTANT", "Trả lời " + i, i * 2 + 1));
        }
        return messages;
    }

    @Test
    void chronologicalChatDropsEmptyAndNonChatMessagesAndSorts() {
        List<AiMessage> messages = new ArrayList<>(chat(2));
        messages.add(message("sys", "SYSTEM", "nội bộ", 10));
        messages.add(message("blank", "STUDENT", " ", 11));
        java.util.Collections.reverse(messages);

        assertThat(AdaptiveCycleWindows.chronologicalChat(messages))
                .extracting(AiMessage::getId)
                .containsExactly("stu-0", "ai-0", "stu-1", "ai-1");
    }

    @Test
    void openCycleStartsAfterTheLastCompletedMilestone() {
        // 7 questions with a 5-question cycle: the open cycle is questions 6-7.
        assertThat(AdaptiveCycleWindows.openCycle(chat(7), 7))
                .extracting(AiMessage::getId)
                .containsExactly("stu-5", "ai-5", "stu-6", "ai-6");
    }

    @Test
    void latestCycleCoversTheLastFiveQuestions() {
        assertThat(AdaptiveCycleWindows.latestCycle(chat(8)).get(0).getId()).isEqualTo("stu-3");
    }

    @Test
    void courseHistoryCountsCorrectWrongAndSkippedSeparately() {
        List<AiMessage> messages = chat(2);
        var check = new UnderstandingCheckPayload("Đa hình là gì?",
                List.of(new UnderstandingCheckPayload.Option("A", "Đúng"),
                        new UnderstandingCheckPayload.Option("B", "Sai")), "A", "Giải thích.");
        messages.get(1).setUnderstandingCheckAttempts(List.of(
                UnderstandingCheckAttempt.builder().quizIndex(0).check(check).selectedKey("A").correct(true).build(),
                UnderstandingCheckAttempt.builder().quizIndex(1).check(check).build()));
        messages.get(3).setUnderstandingCheckAttempts(List.of(
                UnderstandingCheckAttempt.builder().quizIndex(0).check(check).selectedKey("B").correct(false).build()));

        CourseLearningHistory history = CourseLearningHistory.of(messages);

        assertThat(history.totalQuestions()).isEqualTo(2);
        assertThat(history.quizGiven()).isEqualTo(3);
        assertThat(history.quizCorrect()).isEqualTo(1);
        assertThat(history.quizWrong()).isEqualTo(1);
        assertThat(history.quizSkipped()).isEqualTo(1);
        assertThat(history.correctPercent()).isEqualTo(50);
        assertThat(history.difficultConcepts()).hasSize(1);
    }
}
