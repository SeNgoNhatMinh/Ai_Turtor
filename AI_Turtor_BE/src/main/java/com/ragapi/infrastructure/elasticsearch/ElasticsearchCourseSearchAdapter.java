package com.ragapi.infrastructure.elasticsearch;

import com.ragapi.service.course.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.EmbeddingService;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.TermQuery;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import dev.langchain4j.data.embedding.Embedding;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@Service
@RequiredArgsConstructor
public class ElasticsearchCourseSearchAdapter implements CourseKnowledgeSearchGateway {

    private static final Set<String> NON_TEXTBOOK_SOURCE_TYPES = Set.of(
            "GOLD_QA",
            "KNOWLEDGE_CANDIDATE"
    );

    private final ElasticsearchClient elasticsearchClient;
    private final EmbeddingService embeddingService;

    @Value("${elasticsearch.index}")
    private String index;

    @Value("${rag.retrieval.top-k:20}")
    private int retrievalTopK;

    @Value("${rag.retrieval.num-candidates:80}")
    private int retrievalNumCandidates;

    public List<String> search(String question)
            throws IOException {

        return search(question, null, null);
    }

    public List<String> search(String question, String courseId, String classId)
            throws IOException {
        return searchWithScores(question, courseId, classId).stream()
                .map(RetrievedCourseChunk::content)
                .toList();
    }

    public List<RetrievedCourseChunk> searchWithScores(String question, String courseId, String classId)
            throws IOException {
        return searchWithScores(question, courseId, classId, null, retrievalTopK);
    }

    public List<RetrievedCourseChunk> searchApprovedKnowledgeWithScores(
            String question,
            String courseId,
            String classId,
            int maxChunks
    ) throws IOException {
        return searchWithScores(
                question,
                courseId,
                classId,
                "KNOWLEDGE_CANDIDATE",
                Math.max(1, maxChunks)
        );
    }

    public List<RetrievedCourseChunk> searchTextbookWithScores(
            String question,
            String courseId,
            String classId
    ) throws IOException {
        return searchWithScores(
                question,
                courseId,
                classId,
                null,
                NON_TEXTBOOK_SOURCE_TYPES,
                retrievalTopK
        );
    }

    public List<RetrievedCourseChunk> searchTextbookKeywordWithScores(
            String question,
            String courseId,
            String classId,
            int topK
    ) throws IOException {
        String safeQuestion = requireMaxLength(question, "question", DEFAULT_TEXT_MAX_LENGTH);
        String safeCourseId = requireText(courseId, "courseId");
        if (topK <= 0) {
            return List.of();
        }
        if (classId != null && !classId.isBlank()) {
            log.debug("classId={} is kept as metadata but ignored for keyword RAG search filtering", classId);
        }
        if (!indexExists()) {
            log.warn("Elasticsearch index {} does not exist yet. Returning empty keyword RAG context.", index);
            return List.of();
        }

        List<Query> filters = buildScopeFilters(safeCourseId, null, NON_TEXTBOOK_SOURCE_TYPES);
        Query contentQuery = Query.of(q -> q.match(m -> m
                .field("content")
                .query(safeQuestion)
        ));

        SearchResponse<Map> response = elasticsearchClient.search(s -> s
                        .index(index)
                        .size(Math.max(1, topK))
                        .query(q -> q.bool(b -> {
                            b.must(contentQuery);
                            for (Query filter : filters) {
                                b.filter(filter);
                            }
                            return b;
                        })),
                Map.class
        );

        List<RetrievedCourseChunk> results = new ArrayList<>();
        response.hits().hits().forEach(hit -> {
            Map source = hit.source();
            if (source == null) {
                return;
            }
            RetrievedCourseChunk chunk = toSearchChunk(source, hit.score());
            if (chunk != null && isVisibleForClass(chunk, classId)) {
                results.add(chunk);
            }
        });
        log.info("Found {} keyword matching textbook chunks", results.size());
        return results;
    }

    /**
     * Optional teaching-note outlines indexed from Senior-approved Gold Q&A.
     * Keep topK small — textbooks remain the primary retrieval source.
     */
    public List<RetrievedCourseChunk> searchGoldQaTeachingNotesWithScores(
            String question,
            String courseId,
            String classId,
            int maxChunks
    ) throws IOException {
        if (maxChunks <= 0) {
            return List.of();
        }
        return searchWithScores(
                question,
                courseId,
                classId,
                "GOLD_QA",
                Math.max(1, Math.min(maxChunks, 3))
        );
    }

    private List<RetrievedCourseChunk> searchWithScores(
            String question,
            String courseId,
            String classId,
            String sourceType,
            int topK
    ) throws IOException {
        return searchWithScores(question, courseId, classId, sourceType, Set.of(), topK);
    }

    private List<RetrievedCourseChunk> searchWithScores(
            String question,
            String courseId,
            String classId,
            String sourceType,
            Set<String> excludedSourceTypes,
            int topK
    ) throws IOException {

        String safeQuestion = requireMaxLength(question, "question", DEFAULT_TEXT_MAX_LENGTH);
        String safeCourseId = requireText(courseId, "courseId");

        log.debug("Generating embedding for question");

        Embedding queryEmbedding =
                embeddingService.generateQueryEmbedding(safeQuestion);

        List<Float> queryVector = new ArrayList<>();
        for (float f : queryEmbedding.vector()) {
            queryVector.add(f);
        }

        log.debug("Performing KNN search in Elasticsearch");

        List<Query> filters = buildScopeFilters(safeCourseId, sourceType, excludedSourceTypes);
        if (classId != null && !classId.isBlank()) {
            log.debug("classId={} is kept as metadata but ignored for RAG search filtering", classId);
        }

        if (!indexExists()) {
            log.warn("Elasticsearch index {} does not exist yet. Returning empty RAG context.", index);
            return List.of();
        }

        SearchResponse<Map> response =
                elasticsearchClient.search(s -> s
                                .index(index)
                                .knn(k -> {
                                    k.field("vector")
                                            .queryVector(queryVector)
                                            .k(Math.max(1, topK))
                                            .numCandidates(Math.max(Math.max(1, topK), retrievalNumCandidates));

                                    if (!filters.isEmpty()) {
                                        k.filter(filters);
                                    }

                                    return k;
                                }),
                        Map.class
                );

        List<RetrievedCourseChunk> results = new ArrayList<>();

        response.hits().hits().forEach(hit -> {

            Map source = hit.source();

            if(source != null) {
                RetrievedCourseChunk chunk = toSearchChunk(source, hit.score());
                if (chunk != null && isVisibleForClass(chunk, classId)) {
                    results.add(chunk);
                }
            }
        });

        log.info("Found {} matching chunks sourceType={}", results.size(), sourceType);

        return results;
    }

    private RetrievedCourseChunk toSearchChunk(Map source, Double score) {
        Object childContent = source.get("content");
        Object parentContent = source.get("parentContent");
        Object content = parentContent != null ? parentContent : childContent;
        if (content == null) {
            return null;
        }
        return new RetrievedCourseChunk(
                content.toString(),
                score,
                Objects.toString(source.get("materialId"), null),
                Objects.toString(source.get("courseId"), null),
                Objects.toString(source.get("classId"), null),
                Objects.toString(source.get("teacherId"), null),
                Objects.toString(source.get("materialScope"), null),
                Objects.toString(source.get("sourceType"), null),
                Objects.toString(source.get("documentId"), null),
                Objects.toString(source.get("chapterId"), null),
                Objects.toString(source.get("chapterTitle"), null),
                Objects.toString(source.get("sectionId"), null),
                Objects.toString(source.get("sectionTitle"), null),
                Objects.toString(source.get("chunkId"), null),
                source.get("chunkIndex") instanceof Number number ? number.intValue() : null,
                parentContent != null ? "SECTION" : Objects.toString(source.get("nodeType"), null)
        );
    }

    private boolean isVisibleForClass(RetrievedCourseChunk chunk, String requestedClassId) {
        String chunkClassId = chunk.classId();
        if (chunkClassId == null || chunkClassId.isBlank() || "null".equalsIgnoreCase(chunkClassId)) {
            return true;
        }
        return requestedClassId != null && chunkClassId.equalsIgnoreCase(requestedClassId.trim());
    }

    private boolean indexExists() throws IOException {
        return elasticsearchClient.indices()
                .exists(ExistsRequest.of(e -> e.index(index)))
                .value();
    }
    private List<Query> buildScopeFilters(
            String courseId,
            String sourceType,
            Set<String> excludedSourceTypes
    ) {

        List<Query> filters = new ArrayList<>();

        if (courseId != null && !courseId.isBlank()) {
            filters.add(TermQuery.of(t -> t
                    .field("courseId.keyword")
                    .value(courseId)
            )._toQuery());
        }
        if (sourceType != null && !sourceType.isBlank()) {
            filters.add(TermQuery.of(t -> t
                    .field("sourceType.keyword")
                    .value(sourceType)
            )._toQuery());
        }

        if (excludedSourceTypes != null) {
            excludedSourceTypes.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .forEach(value -> {
                        Query excluded = TermQuery.of(t -> t
                                .field("sourceType.keyword")
                                .value(value)
                        )._toQuery();
                        filters.add(Query.of(q -> q.bool(b -> b.mustNot(excluded))));
                    });
        }

        return filters;
    }
}


