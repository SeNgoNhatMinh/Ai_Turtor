package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IntentClassifyRequest {
    private String studentId;
    private String courseId;
    private String classId;
    private String message;
    private String question;
    private String codeSnippet;
    private String conversationId;
    private String tutorSessionId;
    private String sessionPhase;
    private String clickedSuggestion;
    private String learningActionType;
}
