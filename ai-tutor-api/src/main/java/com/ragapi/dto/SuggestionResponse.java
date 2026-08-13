package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionResponse {
    private String studentId;
    private String courseId;
    private String userId;
    private String caseId;
    private String memorySummary;
    private List<SuggestionItem> ruleSuggestions;
    private String aiSuggestion; // raw text or JSON fallback
}
