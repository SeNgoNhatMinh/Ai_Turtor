package com.ragapi.harness.model;

public record CourseGroundingAssessment(
        double confidence,
        boolean grounded,
        boolean hasApprovedKnowledge
) {
}
