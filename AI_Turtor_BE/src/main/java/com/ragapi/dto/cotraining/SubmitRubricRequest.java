package com.ragapi.dto.cotraining;

import lombok.Data;
import java.util.Map;

@Data
public class SubmitRubricRequest {
    private String courseId;
    private String chapter;
    private String name;
    private String description;
    private Map<String, Double> criteriaWeights;
    private String authorId;
    private String sourceTaskId;
}
