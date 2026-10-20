package com.ragapi.dto;

import lombok.Data;

@Data
public class AdaptiveLearningReviewDecisionRequest {
    private String decision;
    private String teacherFeedback;
    private String supportLevel;
}
