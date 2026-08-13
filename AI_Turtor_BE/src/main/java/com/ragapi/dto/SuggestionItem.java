package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionItem {
    private String title;
    private String reason;
    private List<String> nextSteps;
    private String source; // RULE or AI
}






