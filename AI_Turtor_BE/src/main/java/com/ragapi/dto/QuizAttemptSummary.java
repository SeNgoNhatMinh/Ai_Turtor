package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class QuizAttemptSummary {
    private String quizSessionId;
    private String assignmentId;
    private String studentId;
    private String teacherId;
    private String courseId;
    private String classId;
    private String topic;
    private String quizType;
    private String status;
    private String teacherReviewStatus;
    private Integer autoScore;
    private Integer teacherReviewedScore;
    private Integer finalScore;
    private Integer maxScore;
    private Double autoPercentage;
    private Double finalPercentage;
    private String teacherFeedback;
    private LocalDateTime createdAt;
    private LocalDateTime submittedAt;
    private LocalDateTime teacherReviewedAt;
}
