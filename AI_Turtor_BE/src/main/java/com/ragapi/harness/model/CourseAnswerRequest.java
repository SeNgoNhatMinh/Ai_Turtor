package com.ragapi.harness.model;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.harness.behavior.plan.TeachingPlan;
import lombok.Builder;

@Builder
public record CourseAnswerRequest(
        String question,
        String courseId,
        String classId,
        boolean textbookOnly,
        String draftChapter,
        String draftTeachingNote,
        String baselineDraftAnswer,
        String pedagogicalContext,
        String learnerMemoryContext,
        String teachingMode,
        String retrievalHint,
        RagQueryIntent ragQueryIntent,
        TeachingPlan teachingPlan
) {
}
