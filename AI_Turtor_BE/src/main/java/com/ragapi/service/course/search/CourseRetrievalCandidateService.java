package com.ragapi.service.course.search;

import com.ragapi.service.course.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextbookChunkAlignment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/** Collects raw vector, keyword, and Mongo text candidates. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseRetrievalCandidateService {

    private final CourseKnowledgeSearchGateway vectorSearch;
    private final CourseMaterialTextSearchService textSearch;

    public List<RetrievedCourseChunk> retrievePrimary(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            List<RetrievedCourseChunk> priorityChunks
    ) {
        List<RetrievedCourseChunk> vectorChunks = vectorCandidates(query, courseId, classId);
        List<RetrievedCourseChunk> keywordChunks = keywordCandidates(query, courseId, classId);
        List<RetrievedCourseChunk> lexicalChunks = textSearch.searchTextbook(
                query.focus(), courseId, classId, 8);
        List<RetrievedCourseChunk> pinned = priorityChunks == null ? List.of() : priorityChunks;
        List<RetrievedCourseChunk> merged = TextbookChunkAlignment.merge(
                query.focus(), pinned, vectorChunks, keywordChunks, lexicalChunks);
        return merged.isEmpty() ? vectorChunks : merged;
    }

    public List<RetrievedCourseChunk> retrieveTeachingNotes(
            CourseRetrievalQuery query,
            String courseId,
            String classId
    ) {
        try {
            List<RetrievedCourseChunk> chunks = vectorSearch.searchGoldQaTeachingNotesWithScores(
                    query.expandedQuestion(), courseId, classId, 2);
            return chunks == null ? List.of() : chunks;
        } catch (Exception exception) {
            log.debug("Gold Q&A teaching-note retrieval skipped: {}", exception.getMessage());
            return List.of();
        }
    }

    private List<RetrievedCourseChunk> vectorCandidates(
            CourseRetrievalQuery query,
            String courseId,
            String classId
    ) {
        try {
            List<RetrievedCourseChunk> chunks = vectorSearch.searchTextbookWithScores(
                    query.expandedQuestion(), courseId, classId);
            return chunks == null ? List.of() : chunks;
        } catch (Exception exception) {
            log.warn(
                    "Vector retrieval unavailable; using Mongo material fallback (courseId={}, classId={}): {}",
                    courseId, classId, exception.getMessage());
            return List.of();
        }
    }

    private List<RetrievedCourseChunk> keywordCandidates(
            CourseRetrievalQuery query,
            String courseId,
            String classId
    ) {
        try {
            List<RetrievedCourseChunk> chunks = vectorSearch.searchTextbookKeywordWithScores(
                    query.focus(), courseId, classId, 12);
            return chunks == null ? List.of() : chunks;
        } catch (Exception exception) {
            log.debug("Keyword retrieval unavailable; continuing with vector/Mongo retrieval: {}",
                    exception.getMessage());
            return List.of();
        }
    }
}
