package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UnderstandingCheckAnswerRequest {
    private String userId;
    private String selectedKey;
    /** Zero-based index of the quiz item inside the AI answer (Q1 = 0). */
    private Integer quizIndex;
}
