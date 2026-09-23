package com.ragapi.service.course.search;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.model.CourseContextRetrievalResult;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/** Public retrieval facade coordinating query, candidate, and merge stages. */
@Service
@RequiredArgsConstructor
public class CourseContextRetrievalService {

    private final CourseRetrievalQueryService queryService;
    private final CourseRetrievalCandidateService candidateService;
    private final CourseRetrievalMergeService mergeService;

    public CourseContextRetrievalResult retrieve(
            String question,
            String courseId,
            String classId,
            boolean textbookOnly,
            String retrievalHint,
            RagQueryIntent ragQueryIntent,
            List<RetrievedCourseChunk> priorityChunks
    ) {
        CourseRetrievalQuery query = queryService.resolve(
                question, courseId, retrievalHint, ragQueryIntent);
        List<RetrievedCourseChunk> candidates = candidateService.retrievePrimary(
                query, courseId, classId, priorityChunks);
        List<RetrievedCourseChunk> chunks = mergeService.merge(
                query,
                courseId,
                classId,
                textbookOnly,
                priorityChunks,
                candidates
        );
        return new CourseContextRetrievalResult(
                query.focus(),
                query.expandedQuestion(),
                List.copyOf(chunks),
                mergeService.loadMaterials(chunks)
        );
    }

    public Map<String, CourseMaterial> loadMaterials(List<RetrievedCourseChunk> chunks) {
        return mergeService.loadMaterials(chunks);
    }
}
