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
    /** Stable chapter identity resolved from the indexed course outline. */
    private String chapterKey;
    /** Exact source heading; display copy may contain an additional learner-friendly description. */
    private String chapterTitle;
    private List<String> sourceMaterialIds;
    private List<String> sourceChunkIds;

    public SuggestionItem(String title, String reason, List<String> nextSteps, String source) {
        this(title, reason, nextSteps, source, null, null, List.of(), List.of());
    }
}






