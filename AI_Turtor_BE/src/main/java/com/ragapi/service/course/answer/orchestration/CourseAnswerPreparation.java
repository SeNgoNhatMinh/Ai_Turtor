package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.service.course.model.RetrievedCourseChunk;

import java.util.List;
import java.util.Map;

/** Immutable state shared by the validation, cache, and generation stages. */
public record CourseAnswerPreparation(
        CourseAnswerRequest request,
        long backendStartedNanos,
        String question,
        String courseId,
        String retrievalQuestion,
        List<RetrievedCourseChunk> chunks,
        String context,
        Map<String, CourseMaterial> materialsById,
        String groundingType,
        List<String> sourceLabels,
        double confidence,
        boolean grounded,
        boolean skipAnswerCache,
        boolean understandingRemediation,
        CourseRagAnswer immediateAnswer
) {
    public boolean hasImmediateAnswer() {
        return immediateAnswer != null;
    }
}
