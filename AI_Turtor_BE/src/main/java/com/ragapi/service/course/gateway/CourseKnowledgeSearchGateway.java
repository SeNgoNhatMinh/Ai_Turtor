package com.ragapi.service.course.gateway;

import com.ragapi.service.course.model.RetrievedCourseChunk;

import java.io.IOException;
import java.util.List;

public interface CourseKnowledgeSearchGateway {

    List<RetrievedCourseChunk> searchWithScores(
            String question,
            String courseId,
            String classId
    ) throws IOException;

    List<RetrievedCourseChunk> searchApprovedKnowledgeWithScores(
            String question,
            String courseId,
            String classId,
            int maxChunks
    ) throws IOException;

    List<RetrievedCourseChunk> searchTextbookWithScores(
            String question,
            String courseId,
            String classId
    ) throws IOException;

    List<RetrievedCourseChunk> searchTextbookKeywordWithScores(
            String question,
            String courseId,
            String classId,
            int topK
    ) throws IOException;

    List<RetrievedCourseChunk> searchGoldQaTeachingNotesWithScores(
            String question,
            String courseId,
            String classId,
            int maxChunks
    ) throws IOException;
}
