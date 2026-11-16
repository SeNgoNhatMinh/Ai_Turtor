package com.ragapi.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdaptiveLearningReviewDecisionRequest {
    private String decision;
    private String teacherFeedback;
    private String supportLevel;
    /** Subset of the review's teachingRecommendations the teacher kept; null keeps all of them. */
    private List<String> selectedStrategies;
    /** Free-text strategy from the "Khác" option. */
    private String customStrategy;
    /** Optional wider scope to share the chosen strategies to: COURSE, DOMAIN or GLOBAL. */
    private String shareScope;
    private String shareDomain;
}
