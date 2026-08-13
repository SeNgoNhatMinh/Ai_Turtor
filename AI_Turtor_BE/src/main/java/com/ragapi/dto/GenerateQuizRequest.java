package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateQuizRequest {
    private String classId;
    private String topic;
    private String suggestionText;
    private Integer questionCount;
}
