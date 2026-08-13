package com.ragapi.dto;

import com.ragapi.entity.QuizSession;
import lombok.Data;
import java.util.List;

@Data
public class CreateTeacherQuizRequest {
    private String classId;
    private String title;
    private String topic;
    private String gradingMode;
    private List<QuizSession.QuizQuestion> questions;
}
