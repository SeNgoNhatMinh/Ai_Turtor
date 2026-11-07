package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** One AI teaching-strategy recommendation awaiting teacher approval. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeachingStrategyRecommendation {
    private String strategyCode;
    private String strategyName;
    private String description;
    private String reason;
    @Builder.Default
    private List<Map<String, Object>> supportingEvidence = new ArrayList<>();
    private String targetLearningProblem;
    private String expectedOutcome;
    private String priority;
    private Double confidence;
    private String suggestedDuration;
}
