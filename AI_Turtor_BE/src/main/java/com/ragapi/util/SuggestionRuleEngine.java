package com.ragapi.util;

import com.ragapi.dto.SuggestionItem;
import com.ragapi.entity.CaseMemory;
import com.ragapi.entity.UserMemory;

import java.util.ArrayList;
import java.util.List;

/**
 * Rule-based suggestion engine for assistant.
 */
public class SuggestionRuleEngine {

    public List<SuggestionItem> evaluate(SuggestionRuleContext context) {
        List<SuggestionItem> suggestions = new ArrayList<>();
        UserMemory memory = context.getUserMemory();
        CaseMemory caseMemory = context.getCaseMemory();

        if (memory != null && (memory.getRecentQuestions() == null || memory.getRecentQuestions().isEmpty())) {
            suggestions.add(new SuggestionItem(
                    "Start a focused learning log",
                    "No recent questions were found, so the student may benefit from a short diagnostic session.",
                    List.of("Ask 2-3 concept questions", "Summarize weak topics after the session"),
                    "RULE"
            ));
        }

        if (memory != null && memory.getTags() != null && !memory.getTags().isEmpty()) {
            suggestions.add(new SuggestionItem(
                    "Review tagged learning topics",
                    "The student's memory contains topic tags that can guide the next learning plan.",
                    memory.getTags().stream().limit(5).toList(),
                    "RULE"
            ));
        }

        if (caseMemory != null && !isBlank(caseMemory.getSummary())) {
            suggestions.add(new SuggestionItem(
                    "Continue from current learning context",
                    "A course/case memory summary is available and should be used to personalize the next study step.",
                    List.of("Review the memory summary", "Ask follow-up questions on unresolved topics"),
                    "RULE"
            ));
        }

        return suggestions;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}






