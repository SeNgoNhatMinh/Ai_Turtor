package com.ragapi.dto;

import com.ragapi.entity.QuizSession;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateQuizAssignmentRequest {
    private String title;
    private String topic;
    private String suggestionText;
    private List<QuizSession.QuizQuestion> questions;
}
