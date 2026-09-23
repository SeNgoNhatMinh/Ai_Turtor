package com.ragapi.service.course.gateway;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagQueryIntent;

import java.io.IOException;

public interface CourseAnswerGateway {

    CourseRagAnswer askWithConfidence(String question, String courseId, String classId) throws IOException;

    CourseRagAnswer askWithConfidence(
            String question,
            String courseId,
            String classId,
            String teachingMode,
            String retrievalHint
    ) throws IOException;

    CourseRagAnswer answerTutorInteraction(
            String question,
            String courseId,
            String interactionType,
            String pedagogicalContext,
            String learnerContext,
            String recentHistoryContext
    );

    CourseRagAnswer askWithPersonalizedTutorContext(
            String question,
            String courseId,
            String classId,
            String pedagogicalContext,
            String learnerMemoryContext,
            String teachingMode,
            String retrievalHint
    ) throws IOException;

    CourseRagAnswer askWithImprovePlanContext(
            String question,
            String courseId,
            String classId,
            String pedagogicalContext,
            String learnerMemoryContext,
            RagQueryIntent ragQueryIntent
    ) throws IOException;

    CourseRagAnswer askWithConfidenceFromTextbook(
            String question,
            String courseId,
            String classId
    ) throws IOException;

    CourseRagAnswer askWithConfidenceSynthesizingExam(
            String question,
            String courseId,
            String classId,
            String chapter,
            String teachingNote,
            String baselineAnswer
    ) throws IOException;
}
