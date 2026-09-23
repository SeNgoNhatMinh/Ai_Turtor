package com.ragapi.service.course.model;

import com.ragapi.entity.CourseMaterial;

import java.util.List;
import java.util.Map;

public record CourseContextRetrievalResult(
        String retrievalFocus,
        String retrievalQuestion,
        List<RetrievedCourseChunk> chunks,
        Map<String, CourseMaterial> materialsById
) {
}
