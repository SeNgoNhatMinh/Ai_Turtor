package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SubmitQuizRequest {
    private List<QuizAnswerSubmission> answers;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuizAnswerSubmission {
        private String questionId;
        private String selectedAnswer;
    }
}
