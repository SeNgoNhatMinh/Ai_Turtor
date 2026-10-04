package com.ragapi.service.course.gateway;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import dev.langchain4j.data.embedding.Embedding;

import java.io.IOException;
import java.util.List;

public interface CourseKnowledgeSearchGateway {

    /** True when this adapter can accept one prepared embedding across vector branches. */
    default boolean supportsPreparedQueryEmbedding() {
        return false;
    }

    /** Prepare one query embedding for reuse by every vector branch in this request. */
    default Embedding prepareQueryEmbedding(String question) {
        return null;
    }

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

    default List<RetrievedCourseChunk> searchApprovedKnowledgeWithScores(
            String question, String courseId, String classId, int maxChunks, Embedding queryEmbedding
    ) throws IOException {
        return searchApprovedKnowledgeWithScores(question, courseId, classId, maxChunks);
    }

    List<RetrievedCourseChunk> searchTextbookWithScores(
            String question,
            String courseId,
            String classId
    ) throws IOException;

    default List<RetrievedCourseChunk> searchTextbookWithScores(
            String question, String courseId, String classId, Embedding queryEmbedding
    ) throws IOException {
        return searchTextbookWithScores(question, courseId, classId);
    }

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

    default List<RetrievedCourseChunk> searchGoldQaTeachingNotesWithScores(
            String question, String courseId, String classId, int maxChunks, Embedding queryEmbedding
    ) throws IOException {
        return searchGoldQaTeachingNotesWithScores(question, courseId, classId, maxChunks);
    }
}
