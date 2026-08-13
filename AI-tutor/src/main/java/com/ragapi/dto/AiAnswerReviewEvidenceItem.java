package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AiAnswerReviewEvidenceItem {

    private String reviewId;
    private String studentId;
    private Integer rating;
    private Boolean accurate;
    private Boolean helpful;
    private String reviewType;
    private String feedback;
    private String suggestedCorrection;
    private LocalDateTime createdAt;
}
