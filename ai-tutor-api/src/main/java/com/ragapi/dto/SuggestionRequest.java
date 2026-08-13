package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionRequest {
    private String studentId;
    private String courseId;
    private String classId;
    private String userId;
    private String requesterUserId; // basic privacy check
    private String caseId; // optional
    private String question; // optional
    private Boolean includeAiSuggestion = true;
}
