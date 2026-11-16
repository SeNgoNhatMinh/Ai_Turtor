package com.ragapi.service.behavior.plan;

import java.util.List;

/**
 * Compact, topic-relevant personalization snapshot for one tutor turn.
 * Separates HOW to teach (this object + approved strategies) from WHAT is true (RAG materials).
 */
public record StudentLearningContext(
        String studentId,
        String courseId,
        String classId,
        String currentTopic,
        List<String> relevantKnowledgeGaps,
        List<String> repeatedMisconceptions,
        List<String> demonstratedStrengths,
        List<String> recentLearningProgress,
        List<String> recentAssessmentSignals,
        String temporaryInteractionSignal,
        String promptBlock
) {
    public static final StudentLearningContext EMPTY = new StudentLearningContext(
            null, null, null, null,
            List.of(), List.of(), List.of(), List.of(), List.of(),
            "NEUTRAL", ""
    );

    public boolean isEmpty() {
        return promptBlock == null || promptBlock.isBlank();
    }

    public boolean hasPersonalization() {
        return !relevantKnowledgeGaps.isEmpty()
                || !repeatedMisconceptions.isEmpty()
                || !demonstratedStrengths.isEmpty()
                || !recentAssessmentSignals.isEmpty()
                || (temporaryInteractionSignal != null
                && !"NEUTRAL".equalsIgnoreCase(temporaryInteractionSignal)
                && !"UNKNOWN".equalsIgnoreCase(temporaryInteractionSignal));
    }
}
