package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateQuizAssignmentRequest {
    private String classId;
    private String title;
    private String topic;
    private String suggestionText;
    private Integer questionCount;
}
