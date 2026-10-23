package com.ragapi.service;

import com.ragapi.entity.LearningEvidence;
import com.ragapi.entity.QuizSession;
import com.ragapi.repository.LearningEvidenceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearningEvidenceServiceTest {
    @Mock LearningEvidenceRepository repository;

    @Test
    void ignoresGeneratedAndUnreviewedManualQuizzes() {
        LearningEvidenceService service = new LearningEvidenceService(repository);
        QuizSession generated = quiz("GENERATED", "AUTO", "NOT_REQUIRED", 3, 3, 100.0);
        QuizSession pendingManual = quiz("SUBMITTED", "TEACHER_MANUAL", "PENDING", null, 3, null);

        assertThat(service.recordEligibleQuizSubmission(generated)).isEmpty();
        assertThat(service.recordEligibleQuizSubmission(pendingManual)).isEmpty();
        verify(repository, never()).save(any());
    }

    @Test
    void writesTypedSourceIdentifiedEvidenceForSubmittedQuiz() {
        LearningEvidenceService service = new LearningEvidenceService(repository);
        QuizSession submitted = quiz("SUBMITTED", "AUTO", "NOT_REQUIRED", 2, 3, 66.67);
        when(repository.findByStudentIdAndCourseIdAndSourceTypeAndSourceRecordId(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(repository.save(any(LearningEvidence.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LearningEvidence evidence = service.recordEligibleQuizSubmission(submitted).orElseThrow();

        assertThat(evidence.getEvidenceType()).isEqualTo("ASSESSMENT_RESULT");
        assertThat(evidence.getSourceType()).isEqualTo("QUIZ_SUBMISSION");
        assertThat(evidence.getSourceRecordId()).isEqualTo("quiz-1");
        assertThat(evidence.getVerificationStatus()).isEqualTo("VERIFIED");
        assertThat(evidence.getPercentage()).isEqualTo(66.67);
    }

    @Test
    void retryRefreshesTheSameSourceRecordInsteadOfCreatingAnotherOne() {
        LearningEvidenceService service = new LearningEvidenceService(repository);
        QuizSession reviewed = quiz("SUBMITTED", "TEACHER_MANUAL", "REVIEWED", null, 3, null);
        reviewed.setTeacherReviewedScore(3);
        reviewed.setTeacherReviewedAt(LocalDateTime.of(2026, 10, 2, 10, 0));
        LearningEvidence existing = LearningEvidence.builder().id("evidence-1").percentage(0.0).build();
        when(repository.findByStudentIdAndCourseIdAndSourceTypeAndSourceRecordId(
                "student-1", "PRO192", "QUIZ_SUBMISSION", "quiz-1")).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);

        LearningEvidence returned = service.recordEligibleQuizSubmission(reviewed).orElseThrow();

        assertThat(returned.getId()).isEqualTo("evidence-1");
        assertThat(returned.getScore()).isEqualTo(3);
        assertThat(returned.getPercentage()).isEqualTo(100.0);
        verify(repository).save(existing);
    }

    private QuizSession quiz(String status, String gradingMode, String reviewStatus, Integer score, int maxScore, Double percentage) {
        return QuizSession.builder().id("quiz-1").studentId("student-1").courseId("PRO192").classId("SE1840")
                .topic("JDBC").status(status).gradingMode(gradingMode).teacherReviewStatus(reviewStatus)
                .score(score).maxScore(maxScore).percentage(percentage)
                .submittedAt(LocalDateTime.of(2026, 10, 1, 9, 0)).build();
    }
}
