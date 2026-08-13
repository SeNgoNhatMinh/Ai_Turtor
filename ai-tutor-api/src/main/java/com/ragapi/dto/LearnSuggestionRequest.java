package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LearnSuggestionRequest {
    private String classId;
    private String conversationId;
    private String suggestionText;
    private String suggestionKey;
    private String topic;
}
