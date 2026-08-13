package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateQuestionEscalationRequest {
    private String studentId;
    private String studentName;
    private String studentEmail;
    private String courseId;
    private String classId;
    private String conversationId;
    private String question;
    private String aiResponse;
    private String reason;
}


