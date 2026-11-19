package com.ragapi.harness.retrieval;

import com.ragapi.harness.curriculum.CourseChapterExcerptCache;
import com.ragapi.harness.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.harness.model.CourseRetrievalCandidates;
import com.ragapi.harness.model.CourseRetrievalQuery;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.util.TextbookChunkAlignment;
import com.ragapi.harness.util.RagStageTimer;
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
    private final CourseChapterExcerptCache chapterExcerptCache;

    @Value("${rag.retrieval.parallel.enabled:false}")
    private boolean parallelEnabled;

    @Value("${rag.retrieval.parallel.timeout-ms:1200}")
    private long branchTimeoutMs;

    @Autowired
    public CourseRetrievalCandidateService(
            CourseKnowledgeSearchGateway vectorSearch,
            CourseMaterialTextSearchService textSearch,
            @Qualifier("ragRetrievalExecutor") Executor retrievalExecutor,
            CourseChapterExcerptCache chapterExcerptCache
    ) {
        this.vectorSearch = vectorSearch;
        this.textSearch = textSearch;
        this.retrievalExecutor = retrievalExecutor;
        this.chapterExcerptCache = chapterExcerptCache;
    }

    /** Test/backward-compatible constructor; production uses the bounded named executor. */
    public CourseRetrievalCandidateService(
            CourseKnowledgeSearchGateway vectorSearch,
            CourseMaterialTextSearchService textSearch
    ) {
        this(vectorSearch, textSearch, Runnable::run, null);
    }

    public CourseRetrievalCandidates retrievePrimary(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            List<RetrievedCourseChunk> priorityChunks
    ) {
        List<RetrievedCourseChunk> stored = storedChapterChunks(query, courseId);
        if (stored != null) {
            return new CourseRetrievalCandidates(stored, null);
        }
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
            CompletableFuture.allOf(vectorFuture, keywordFuture).join();
            vectorChunks = vectorFuture.join();
            keywordChunks = keywordFuture.join();
            lexicalChunks = lexicalUnlessElasticsearchHit(query, courseId, classId, vectorChunks, keywordChunks);
        } else {
            vectorChunks = vectorCandidates(query, courseId, classId, queryEmbedding);
            keywordChunks = keywordCandidates(query, courseId, classId);
            lexicalChunks = lexicalUnlessElasticsearchHit(query, courseId, classId, vectorChunks, keywordChunks);
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

    private List<RetrievedCourseChunk> storedChapterChunks(CourseRetrievalQuery query, String courseId) {
        if (chapterExcerptCache == null || query == null || !chapterExcerptCache.isLoaded(courseId)) {
            return null;
        }
        CourseChapterExcerptCache.ChapterExcerpt excerpt = chapterExcerptCache.match(courseId, query.focus()).orElse(null);
        if (excerpt == null || excerpt.text() == null || excerpt.text().isBlank()) {
            return null;
        }
        log.info("Using indexed chapter chunks from memory (courseId={}, chapterKey={})", courseId, excerpt.chapterKey());
        return List.of(new RetrievedCourseChunk(
                "Chapter: " + excerpt.title() + "\n" + excerpt.text(),
                0.99,
                excerpt.materialId(),
                courseId,
                null,
                null,
                null,
                "INDEXED_CHAPTER",
                excerpt.materialId(),
                excerpt.chapterKey(),
                excerpt.title(),
                excerpt.chapterKey(),
                excerpt.title(),
                excerpt.chapterKey(),
                0,
                "SECTION"
        ));
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

    private List<RetrievedCourseChunk> lexicalUnlessElasticsearchHit(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            List<RetrievedCourseChunk> vectorChunks,
            List<RetrievedCourseChunk> keywordChunks
    ) {
        int vectorCount = vectorChunks == null ? 0 : vectorChunks.size();
        int keywordCount = keywordChunks == null ? 0 : keywordChunks.size();
        if (vectorCount > 0 || keywordCount > 0) {
            log.info("Skipping Mongo lexical scan; Elasticsearch returned vector={} keyword={}",
                    vectorCount, keywordCount);
            return List.of();
        }
        return lexicalCandidates(query, courseId, classId);
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
