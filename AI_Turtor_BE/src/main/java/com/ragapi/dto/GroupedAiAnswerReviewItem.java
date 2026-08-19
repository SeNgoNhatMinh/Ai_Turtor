package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class GroupedAiAnswerReviewItem {

    private String answerFingerprint;
    private String courseId;
    private String classId;
    private String question;
    private String answer;
    private String mode;
    private Double aiConfidence;
    private String queueStatus;
    /**
     * MODERATE = rating 2-3 crowd; SEVERE = rating 1 crowd; IMMEDIATE = source conflict without crowd.
     */
    private String escalationTier;
    private int distinctStudentCount;
    private int reviewCount;
    /**
     * RED when the similar-question cluster has many negative ratings.
     * ATTENTION when a few students have complained. WATCH when only one rating exists.
     */
    private String alertLevel;
    private boolean redAlert;
    private int negativeReviewCount;
    private int similarQuestionCount;
    private List<String> similarQuestions;
    private Double averageRating;
    private LocalDateTime firstReportedAt;
    private LocalDateTime lastReportedAt;
    /** Use for Flow 3 senior-resolve when acting on the group. */
    private String representativeReviewId;
    private List<AiAnswerReviewEvidenceItem> reviews;
}
