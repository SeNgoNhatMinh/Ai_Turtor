package com.ragapi.service.course.search;

import com.ragapi.service.course.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.service.course.model.CourseRetrievalCandidates;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextbookChunkAlignment;
import com.ragapi.util.RagStageTimer;
import dev.langchain4j.data.embedding.Embedding;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

/** Collects raw vector, keyword, and Mongo text candidates. */
@Slf4j
@Service
public class CourseRetrievalCandidateService {

    private final CourseKnowledgeSearchGateway vectorSearch;
    private final CourseMaterialTextSearchService textSearch;
    private final Executor retrievalExecutor;

    @Value("${rag.retrieval.parallel.enabled:false}")
    private boolean parallelEnabled;

    @Value("${rag.retrieval.parallel.timeout-ms:1200}")
    private long branchTimeoutMs;

    @Autowired
    public CourseRetrievalCandidateService(
            CourseKnowledgeSearchGateway vectorSearch,
            CourseMaterialTextSearchService textSearch,
            @Qualifier("ragRetrievalExecutor") Executor retrievalExecutor
    ) {
        this.vectorSearch = vectorSearch;
        this.textSearch = textSearch;
        this.retrievalExecutor = retrievalExecutor;
    }

    /** Test/backward-compatible constructor; production uses the bounded named executor. */
    public CourseRetrievalCandidateService(
            CourseKnowledgeSearchGateway vectorSearch,
            CourseMaterialTextSearchService textSearch
    ) {
        this(vectorSearch, textSearch, Runnable::run);
    }

    public CourseRetrievalCandidates retrievePrimary(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            List<RetrievedCourseChunk> priorityChunks
    ) {
        Embedding queryEmbedding = prepareQueryEmbedding(query.expandedQuestion());
        List<RetrievedCourseChunk> vectorChunks;
        List<RetrievedCourseChunk> keywordChunks;
        List<RetrievedCourseChunk> lexicalChunks;
        if (parallelEnabled) {
            Embedding sharedEmbedding = queryEmbedding;
            CompletableFuture<List<RetrievedCourseChunk>> vectorFuture = CompletableFuture.supplyAsync(
                    () -> vectorCandidates(query, courseId, classId, sharedEmbedding), retrievalExecutor)
                    .completeOnTimeout(List.of(), Math.max(100, branchTimeoutMs), TimeUnit.MILLISECONDS)
                    .exceptionally(error -> failedBranch("vector", error));
            CompletableFuture<List<RetrievedCourseChunk>> keywordFuture = CompletableFuture.supplyAsync(
                    () -> keywordCandidates(query, courseId, classId), retrievalExecutor)
                    .completeOnTimeout(List.of(), Math.max(100, branchTimeoutMs), TimeUnit.MILLISECONDS)
                    .exceptionally(error -> failedBranch("keyword", error));
            CompletableFuture<List<RetrievedCourseChunk>> lexicalFuture = CompletableFuture.supplyAsync(
                    () -> lexicalCandidates(query, courseId, classId), retrievalExecutor)
                    .completeOnTimeout(List.of(), Math.max(100, branchTimeoutMs), TimeUnit.MILLISECONDS)
                    .exceptionally(error -> failedBranch("lexical", error));
            CompletableFuture.allOf(vectorFuture, keywordFuture, lexicalFuture).join();
            vectorChunks = vectorFuture.join();
            keywordChunks = keywordFuture.join();
            lexicalChunks = lexicalFuture.join();
        } else {
            vectorChunks = vectorCandidates(query, courseId, classId, queryEmbedding);
            keywordChunks = keywordCandidates(query, courseId, classId);
            lexicalChunks = lexicalCandidates(query, courseId, classId);
        }
        List<RetrievedCourseChunk> pinned = priorityChunks == null ? List.of() : priorityChunks;
        List<RetrievedCourseChunk> merged = TextbookChunkAlignment.mergeDeduplicated(
                query.language(), pinned, vectorChunks, keywordChunks, lexicalChunks);
        List<RetrievedCourseChunk> ranked = TextbookChunkAlignment.rank(
                query.focus(),
                merged.isEmpty() ? vectorChunks : merged
        );
        return new CourseRetrievalCandidates(ranked, queryEmbedding);
    }

    public List<RetrievedCourseChunk> retrieveTeachingNotes(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            Embedding queryEmbedding
    ) {
        try {
            if (queryEmbedding == null && vectorSearch.supportsPreparedQueryEmbedding()) {
                return List.of();
            }
            List<RetrievedCourseChunk> chunks = queryEmbedding == null
                    ? vectorSearch.searchGoldQaTeachingNotesWithScores(
                            query.expandedQuestion(), courseId, classId, 2)
                    : vectorSearch.searchGoldQaTeachingNotesWithScores(
                            query.expandedQuestion(), courseId, classId, 2, queryEmbedding);
            return chunks == null ? List.of() : chunks;
        } catch (Exception exception) {
            log.debug("Gold Q&A teaching-note retrieval skipped: {}", exception.getMessage());
            return List.of();
        }
    }

    private List<RetrievedCourseChunk> vectorCandidates(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            Embedding queryEmbedding
    ) {
        long started = RagStageTimer.start();
        try {
            if (queryEmbedding == null && vectorSearch.supportsPreparedQueryEmbedding()) {
                return List.of();
            }
            List<RetrievedCourseChunk> chunks = queryEmbedding == null
                    ? vectorSearch.searchTextbookWithScores(query.expandedQuestion(), courseId, classId)
                    : vectorSearch.searchTextbookWithScores(
                            query.expandedQuestion(), courseId, classId, queryEmbedding);
            return chunks == null ? List.of() : chunks;
        } catch (Exception exception) {
            log.warn(
                    "Vector retrieval unavailable; using Mongo material fallback (courseId={}, classId={}): {}",
                    courseId, classId, exception.getMessage());
            return List.of();
        } finally {
            RagStageTimer.record("T6_VECTOR_RETRIEVAL", started);
        }
    }

    private List<RetrievedCourseChunk> keywordCandidates(
            CourseRetrievalQuery query,
            String courseId,
            String classId
    ) {
        long started = RagStageTimer.start();
        try {
            List<RetrievedCourseChunk> chunks = vectorSearch.searchTextbookKeywordWithScores(
                    query.keywordQuery(), courseId, classId, 12);
            return chunks == null ? List.of() : chunks;
        } catch (Exception exception) {
            log.debug("Keyword retrieval unavailable; continuing with vector/Mongo retrieval: {}",
                    exception.getMessage());
            return List.of();
        } finally {
            RagStageTimer.record("T7_KEYWORD_RETRIEVAL", started);
        }
    }

    private List<RetrievedCourseChunk> lexicalCandidates(
            CourseRetrievalQuery query, String courseId, String classId
    ) {
        long started = RagStageTimer.start();
        try {
            return textSearch.searchTextbook(query.expandedQuestion(), courseId, classId, 8);
        } catch (RuntimeException exception) {
            log.warn("Lexical retrieval unavailable; continuing with remaining branches: {}", exception.getMessage());
            return List.of();
        } finally {
            RagStageTimer.record("T8_LEXICAL_RETRIEVAL", started);
        }
    }

    private List<RetrievedCourseChunk> failedBranch(String branch, Throwable error) {
        log.warn("{} retrieval branch failed or timed out; continuing with remaining branches: {}",
                branch, error == null ? "unknown" : error.getMessage());
        return List.of();
    }

    private Embedding prepareQueryEmbedding(String query) {
        long started = RagStageTimer.start();
        try {
            if (!vectorSearch.supportsPreparedQueryEmbedding()) {
                return null;
            }
            return vectorSearch.prepareQueryEmbedding(query);
        } catch (RuntimeException error) {
            log.warn("Query embedding unavailable; continuing with keyword/lexical retrieval: {}", error.getMessage());
            return null;
        } finally {
            RagStageTimer.record("T5_QUERY_EMBEDDING", started);
        }
    }
}
