package com.ragapi.service.behavior.plan;

/** One behavior chosen for a single generation turn. */
public record SelectedTeachingBehavior(
        String behaviorId,
        Integer behaviorVersion,
        String appliedBehaviorId,
        String strategy,
        String strategyCode,
        String instruction,
        int priority,
        double relevanceScore,
        String selectionReason
) {
}
