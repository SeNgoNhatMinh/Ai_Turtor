package com.ragapi.service;

import com.ragapi.entity.LearningEvidence;
import com.ragapi.entity.QuizSession;
import com.ragapi.repository.LearningEvidenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Creates evidence exclusively from authoritative application events. Chat
 * messages and AI-generated lesson lists intentionally have no write path
 * here; they stay in conversation history instead of becoming "completed".
 */
@Service
@RequiredArgsConstructor
public class LearningEvidenceService {
    public static final String TYPE_ASSESSMENT_RESULT = "ASSESSMENT_RESULT";
    public static final String SOURCE_QUIZ_SUBMISSION = "QUIZ_SUBMISSION";

    private final LearningEvidenceRepository repository;

    public Optional<LearningEvidence> recordEligibleQuizSubmission(QuizSession quiz) {
        if (!isEligibleQuizAssessment(quiz)) return Optional.empty();
        String studentId = quiz.getStudentId().trim();
        String courseId = quiz.getCourseId().trim();
        String quizId = quiz.getId().trim();

        Optional<LearningEvidence> existing = repository
                .findByStudentIdAndCourseIdAndSourceTypeAndSourceRecordId(
                        studentId, courseId, SOURCE_QUIZ_SUBMISSION, quizId);
        int maxScore = quiz.getMaxScore() == null ? 0 : quiz.getMaxScore();
        Integer finalScore = finalScore(quiz);
        Double finalPercentage = finalPercentage(quiz, finalScore, maxScore);
        LocalDateTime eventAt = quiz.getTeacherReviewedAt() != null
                ? quiz.getTeacherReviewedAt()
                : quiz.getSubmittedAt();
        LocalDateTime now = LocalDateTime.now();
        if (existing.isPresent()) {
            // A teacher may replace an automatic score with the reviewed final
            // score. Keep one source event, but refresh its authoritative
            // snapshot rather than leaving stale assessment data behind.
            LearningEvidence evidence = existing.get();
            evidence.setClassId(trimToNull(quiz.getClassId()));
            evidence.setTopic(trimToNull(quiz.getTopic()));
            evidence.setEventAt(eventAt == null ? evidence.getEventAt() : eventAt);
            evidence.setScore(finalScore);
            evidence.setMaxScore(maxScore);
            evidence.setPercentage(finalPercentage);
            return Optional.of(repository.save(evidence));
        }
        LearningEvidence evidence = LearningEvidence.builder()
                .id(UUID.randomUUID().toString())
                .studentId(studentId)
                .courseId(courseId)
                .classId(trimToNull(quiz.getClassId()))
                .evidenceType(TYPE_ASSESSMENT_RESULT)
                .status("VERIFIED")
                .verificationStatus("VERIFIED")
                .topic(trimToNull(quiz.getTopic()))
                .sourceType(SOURCE_QUIZ_SUBMISSION)
                .sourceRecordId(quizId)
                .eventAt(eventAt == null ? now : eventAt)
                .score(finalScore)
                .maxScore(maxScore)
                .percentage(finalPercentage)
                .createdAt(now)
                .build();
        try {
            return Optional.of(repository.save(evidence));
        } catch (DuplicateKeyException duplicate) {
            // The unique source-event index makes retries and concurrent submit
            // notifications idempotent. Return the winner rather than creating
            // a second logical evidence record.
            return repository.findByStudentIdAndCourseIdAndSourceTypeAndSourceRecordId(
                    studentId, courseId, SOURCE_QUIZ_SUBMISSION, quizId);
        }
    }

    public List<LearningEvidence> listForStudentCourse(String studentId, String courseId) {
        return repository.findByStudentIdAndCourseIdOrderByEventAtDescCreatedAtDesc(
                requireText(studentId, "studentId"), requireText(courseId, "courseId"));
    }

    /** A generated or unresolved manual quiz is not objective assessment evidence. */
    public static boolean isEligibleQuizAssessment(QuizSession quiz) {
        if (quiz == null || isBlank(quiz.getId()) || isBlank(quiz.getStudentId()) || isBlank(quiz.getCourseId())) {
            return false;
        }
        if (!"SUBMITTED".equalsIgnoreCase(trimToEmpty(quiz.getStatus()))) return false;
        if ("TEACHER_MANUAL".equalsIgnoreCase(trimToEmpty(quiz.getGradingMode()))) {
            return "REVIEWED".equalsIgnoreCase(trimToEmpty(quiz.getTeacherReviewStatus()))
                    && quiz.getTeacherReviewedScore() != null;
        }
        return quiz.getPercentage() != null || (quiz.getScore() != null && quiz.getMaxScore() != null);
    }

    public static Integer finalScore(QuizSession quiz) {
        return "REVIEWED".equalsIgnoreCase(trimToEmpty(quiz.getTeacherReviewStatus()))
                && quiz.getTeacherReviewedScore() != null
                ? quiz.getTeacherReviewedScore()
                : quiz.getScore();
    }

    public static Double finalPercentage(QuizSession quiz, Integer score, int maxScore) {
        if ("REVIEWED".equalsIgnoreCase(trimToEmpty(quiz.getTeacherReviewStatus()))
                && score != null && maxScore > 0) {
            return roundPercentage(score, maxScore);
        }
        if (quiz.getPercentage() != null) return quiz.getPercentage();
        return score != null && maxScore > 0 ? roundPercentage(score, maxScore) : null;
    }

    private static double roundPercentage(int score, int maxScore) {
        return Math.round(score * 10000.0 / maxScore) / 100.0;
    }

    private static String requireText(String value, String name) {
        String normalized = trimToNull(value);
        if (normalized == null) throw new IllegalArgumentException(name + " is required");
        return normalized;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
