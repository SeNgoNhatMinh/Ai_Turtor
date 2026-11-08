package com.ragapi.service.adaptive;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdaptiveReviewValuesTest {

    @Test
    void stripsMarkdownFencesAndReasoningTags() {
        String raw = """
                <think>
                The student struggled a bit.
                </think>
                ```json
                {"knowledgePercent":55,"practicePercent":40,"independencePercent":35,"confidencePercent":70,"summary":"Ổn","strengths":[],"knowledgeGaps":[],"teachingRecommendations":["Giải thích lại"],"learnsBestWith":[],"struggleSignals":[],"suggestedSupportLevel":"STANDARD"}
                ```
                """;
        String json = AdaptiveReviewValues.extractJson(raw);
        assertTrue(json.startsWith("{"));
        assertTrue(json.contains("\"knowledgePercent\":55"));
        assertTrue(json.endsWith("}"));
    }

    @Test
    void stripsSpecialTokensAroundJson() {
        String raw = "<|channel|>analysis reasoning here <|channel|>final {\"a\":1}";
        assertEquals("{\"a\":1}", AdaptiveReviewValues.extractJson(raw));
    }

    @Test
    void rejectsBlankResponses() {
        assertThrows(IllegalArgumentException.class, () -> AdaptiveReviewValues.extractJson("   "));
        assertThrows(IllegalArgumentException.class, () -> AdaptiveReviewValues.extractJson("no braces here"));
    }
}
