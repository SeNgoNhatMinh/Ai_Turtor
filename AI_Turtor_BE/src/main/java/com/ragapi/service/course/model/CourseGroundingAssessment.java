package com.ragapi.service.course.model;

public record CourseGroundingAssessment(
        double confidence,
        boolean grounded,
        boolean hasApprovedKnowledge
) {
}
