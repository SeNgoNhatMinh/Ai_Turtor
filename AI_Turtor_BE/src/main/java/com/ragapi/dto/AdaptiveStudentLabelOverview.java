package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * One enrolled student in a class with their latest AI learning label.
 * Students the AI has not labeled yet are still listed with
 * {@code labeled=false} and zeroed percentages so teachers see the whole class.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptiveStudentLabelOverview {
    private String studentId;
    private String studentName;
    private String studentCode;
    private String studentEmail;
    private String courseId;
    private String classId;

    /** Questions the student has asked in this course across all conversations. */
    private long totalQuestions;
    /** Questions counted toward the next 10-question review cycle (0-9). */
    private int questionsInCurrentCycle;
    private int cycleSize;

    private boolean labeled;
    private String latestReviewId;
    private String reviewStatus;
    private String currentSupportLevel;
    private String suggestedSupportLevel;
    private Integer overallPercent;
    private Integer knowledgePercent;
    private Integer practicePercent;
    private Integer independencePercent;
    private Integer confidencePercent;
    private Integer reviewQuestionCount;
    private String summary;
    private LocalDateTime reviewCreatedAt;
}
