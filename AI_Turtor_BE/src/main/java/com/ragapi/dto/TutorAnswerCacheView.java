package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class TutorAnswerCacheView {
    private String id;
    private String courseId;
    private String classId;
    private String mode;
    private String question;
    private String answer;
    private String originalAnswer;
    private Double confidence;
    private List<String> sources;
    private String groundingType;
    private String reviewStatus;
    private String seniorReviewerId;
    private String seniorReviewerName;
    private String seniorReviewNotes;
    private String linkedReviewId;
    private LocalDateTime seniorReviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private boolean semanticReady;
}
