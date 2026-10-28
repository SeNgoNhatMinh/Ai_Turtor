package com.ragapi.service;

import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.QuizSession;
import com.ragapi.entity.StudentDailyQuestionUsage;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.QuizSessionRepository;
import com.ragapi.repository.StudentDailyQuestionUsageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentOverviewStatsServiceTest {

    @Mock AiConversationRepository conversationRepository;
    @Mock AiMessageRepository messageRepository;
    @Mock QuizSessionRepository quizSessionRepository;
    @Mock AdaptiveLearningReviewRepository reviewRepository;
    @Mock StudentDailyQuestionUsageRepository usageRepository;

    @Test
    void streakCountsTodayOrYesterdayAndStopsAtAGap() {
        LocalDate today = LocalDate.of(2026, 10, 28);
        assertThat(StudyActivityMath.streakDays(Set.of(today, today.minusDays(1), today.minusDays(2)), today)).isEqualTo(3);
        assertThat(StudyActivityMath.streakDays(Set.of(today.minusDays(1), today.minusDays(2)), today)).isEqualTo(2);
        assertThat(StudyActivityMath.streakDays(Set.of(today.minusDays(3)), today)).isZero();
    }

    @Test
    void improvementUsesTheOldestAndNewestMasteryPercents() {
        assertThat(StudyActivityMath.improvementPercent(List.of(40, 55))).isEqualTo(15);
        assertThat(StudyActivityMath.improvementPercent(List.of(70, 60))).isEqualTo(-10);
        assertThat(StudyActivityMath.improvementPercent(List.of(80))).isZero();
    }

    @Test
    void overviewCountsQuestionsQuizzesImprovementAndStudyDays() {
        LocalDateTime now = LocalDateTime.now();
        StudentOverviewStatsService service = new StudentOverviewStatsService(
                conversationRepository,
                messageRepository,
                quizSessionRepository,
                reviewRepository,
                usageRepository,
                "Asia/Bangkok"
        );
        when(conversationRepository.findAllByUserId("student-1")).thenReturn(List.of(
                AiConversation.builder().id("conv-1").userId("student-1").courseId("prj301").build()
        ));
        when(messageRepository.findByConversationIdInAndRoleIn(List.of("conv-1"), List.of("STUDENT", "USER")))
                .thenReturn(List.of(
                        AiMessage.builder().conversationId("conv-1").role("STUDENT").createdAt(now).build(),
                        AiMessage.builder().conversationId("conv-1").role("STUDENT").createdAt(now).build(),
                        AiMessage.builder().conversationId("conv-1").role("ASSISTANT").createdAt(now).build()
                ));
        when(quizSessionRepository.findByStudentIdOrderByCreatedAtDesc("student-1")).thenReturn(List.of(
                QuizSession.builder()
                        .courseId("PRJ301")
                        .status("SUBMITTED")
                        .submittedAt(now)
                        .percentage(80.0)
                        .answers(List.of(
                                QuizSession.QuizAnswer.builder().selectedAnswer("A").build(),
                                QuizSession.QuizAnswer.builder().selectedAnswer("B").build(),
                                QuizSession.QuizAnswer.builder().selectedAnswer("C").build(),
                                QuizSession.QuizAnswer.builder().selectedAnswer("D").build()
                        ))
                        .build(),
                QuizSession.builder().courseId("PRJ301").status("GENERATED").build()
        ));
        when(reviewRepository.findByStudentIdOrderByCreatedAtAsc("student-1")).thenReturn(List.of(
                AdaptiveLearningReview.builder().courseId("PRJ301").overallPercent(40).createdAt(now.minusDays(10)).build(),
                AdaptiveLearningReview.builder().courseId("PRJ301").overallPercent(55).createdAt(now).build()
        ));
        when(usageRepository.findByStudentId("student-1")).thenReturn(List.of(
                StudentDailyQuestionUsage.builder()
                        .studentId("student-1")
                        .courseId("PRJ301")
                        .usageDate(LocalDate.now().minusDays(1))
                        .questionCount(2)
                        .build()
        ));

        Map<String, Object> stats = service.build("student-1");
        @SuppressWarnings("unchecked")
        Map<String, Object> summary = (Map<String, Object>) stats.get("summary");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> courses = (List<Map<String, Object>>) stats.get("courses");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> week = (List<Map<String, Object>>) stats.get("week");

        assertThat(summary)
                .containsEntry("questionCount", 2)
                .containsEntry("askCount", 1)
                .containsEntry("quizQuestionCount", 4)
                .containsEntry("quizAttemptCount", 1)
                .containsEntry("averageQuizPercent", 80)
                .containsEntry("activeCourseCount", 1L)
                .containsEntry("improvementPercent", 15)
                .containsEntry("latestMasteryPercent", 55)
                .containsEntry("streakDays", 2);
        assertThat(courses).hasSize(1);
        assertThat(courses.get(0))
                .containsEntry("courseId", "PRJ301")
                .containsEntry("questionCount", 2)
                .containsEntry("askCount", 1)
                .containsEntry("quizQuestionCount", 4);
        assertThat(week).hasSize(7);
        assertThat(week.get(6))
                .containsEntry("active", true)
                .containsEntry("questionCount", 2)
                .containsEntry("quizQuestionCount", 4)
                .containsEntry("quizAttemptCount", 1)
                .containsEntry("activityCount", 6);
    }
}
