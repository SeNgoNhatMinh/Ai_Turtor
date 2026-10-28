package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * AI-generated overview of everything one student has done with the AI Tutor
 * in one course: chat/quiz statistics across the whole history, concepts the
 * student keeps missing or skipping, the support-level change history, and a
 * narrative summary written for the teacher.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentCourseLearningSummary {
    private String studentId;
    private String courseId;
    private String classId;

    /** Student questions asked in this course across all conversations. */
    private long totalQuestions;
    private long totalConversations;
    /** Current position inside the open 10-question review cycle (0-9). */
    private int questionsInCurrentCycle;
    private int cycleSize;

    /** Quiz items ever presented to the student in this course. */
    private long quizGiven;
    private long quizAnswered;
    private long quizCorrect;
    private long quizWrong;
    /** Quiz items the student never answered (recorded, not counted as wrong). */
    private long quizSkipped;
    /** Correct answers as a percent of answered quizzes (0 when none answered). */
    private int quizCorrectPercent;

    /** Concepts (quiz questions) with wrong or skipped counts, worst first. */
    private List<Map<String, Object>> difficultConcepts;
    /** Most recent student questions in this course, newest last. */
    private List<String> recentQuestions;

    private String currentSupportLevel;
    /** Every recorded review milestone with the level move it produced. */
    private List<Map<String, Object>> levelHistory;

    private String aiSummary;
    private List<String> strengths;
    private List<String> knowledgeGaps;
    private List<String> teachingRecommendations;
    /** False when the LLM was unavailable and aiSummary is a stats fallback. */
    private boolean modelGenerated;
    private LocalDateTime generatedAt;
}
