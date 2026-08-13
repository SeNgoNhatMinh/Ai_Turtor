package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewAssignmentSubmissionRequest {
    private String teacherId;
    private Double score;
    private String teacherFeedback;
    private List<String> weakTopics;
}
