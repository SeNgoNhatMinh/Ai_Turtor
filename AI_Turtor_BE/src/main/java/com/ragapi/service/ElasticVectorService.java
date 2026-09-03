package com.ragapi.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.TermQuery;
import co.elastic.clients.elasticsearch.core.IndexRequest;
import co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.BulkRequest;
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
public class ElasticVectorService {

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

    public void indexChunk(
            String documentId,
            String content
    ) throws IOException {

        indexChunk(null, null, null, documentId, null, content);
    }

    public void indexChunk(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String content
    ) throws IOException {
        indexChunk(courseId, classId, teacherId, materialId, null, content);
    }

    public void indexChunk(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String content
    ) throws IOException {
        indexChunk(courseId, classId, teacherId, materialId, materialScope, null, null, null, content);
    }

    public void indexChunk(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            String content
    ) throws IOException {

        log.debug("Generating embedding for chunk of size: {}", content.length());

        Embedding embedding =
                embeddingService.generatePassageEmbedding(content);

        Map<String, Object> data = new HashMap<>();

        data.put("documentId", materialId);
        data.put("materialId", materialId);
        data.put("courseId", courseId);
        data.put("classId", classId);
        data.put("teacherId", teacherId);
        data.put("materialScope", materialScope);
        data.put("sourceType", sourceType);
        data.put("sourceUrl", sourceUrl);
        data.put("sourceDomain", sourceDomain);
        data.put("content", content);
        data.put("vector", embedding.vector());

        IndexRequest<Map<String, Object>> request =
                IndexRequest.of(i -> i
                        .index(index)
                        .document(data)
                );

        elasticsearchClient.index(request);

        log.debug("Chunk indexed to Elasticsearch");
    }

    public void indexChunks(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            List<String> contents
    ) throws IOException {
        if (contents == null || contents.isEmpty()) {
            return;
        }
        List<Embedding> embeddings = embeddingService.generatePassageEmbeddings(contents);
        if (embeddings.size() != contents.size()) {
            throw new IllegalStateException("Embedding count did not match chunk count");
        }
        BulkRequest.Builder bulk = new BulkRequest.Builder();
        for (int i = 0; i < contents.size(); i++) {
            Map<String, Object> data = new HashMap<>();
            data.put("documentId", materialId);
            data.put("materialId", materialId);
            data.put("courseId", courseId);
            data.put("classId", classId);
            data.put("teacherId", teacherId);
            data.put("materialScope", materialScope);
            data.put("sourceType", sourceType);
            data.put("sourceUrl", sourceUrl);
            data.put("sourceDomain", sourceDomain);
            data.put("content", contents.get(i));
            data.put("vector", embeddings.get(i).vector());
            bulk.operations(op -> op.index(idx -> idx.index(index).document(data)));
        }
        var response = elasticsearchClient.bulk(bulk.build());
        if (response.errors()) {
            throw new IOException("Elasticsearch bulk indexing reported one or more errors");
        }
        log.info("Indexed {} chunks in one embedding/bulk batch", contents.size());
    }

    public void indexHierarchicalChunks(
            String courseId,
            String classId,
            String teacherId,
            String materialId,
            String materialScope,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            List<CourseMaterialChunkingService.HierarchicalChunk> chunks
    ) throws IOException {
        if (chunks == null || chunks.isEmpty()) return;
        List<String> contents = chunks.stream().map(CourseMaterialChunkingService.HierarchicalChunk::content).toList();
        List<Embedding> embeddings = embeddingService.generatePassageEmbeddings(contents);
        if (embeddings.size() != chunks.size()) {
            throw new IllegalStateException("Embedding count did not match hierarchical chunk count");
        }
        BulkRequest.Builder bulk = new BulkRequest.Builder();
        for (int i = 0; i < chunks.size(); i++) {
            CourseMaterialChunkingService.HierarchicalChunk chunk = chunks.get(i);
            Map<String, Object> data = new HashMap<>();
            data.put("documentId", chunk.documentId());
            data.put("materialId", materialId);
            data.put("courseId", courseId);
            data.put("classId", classId);
            data.put("teacherId", teacherId);
            data.put("materialScope", materialScope);
            data.put("sourceType", sourceType);
            data.put("sourceUrl", sourceUrl);
            data.put("sourceDomain", sourceDomain);
            data.put("chapterId", chunk.chapterId());
            data.put("chapterTitle", chunk.chapterTitle());
            data.put("sectionId", chunk.sectionId());
            data.put("sectionTitle", chunk.sectionTitle());
            data.put("chunkId", chunk.chunkId());
            data.put("chunkIndex", chunk.chunkIndex());
            data.put("nodeType", "CHUNK");
            data.put("parentContent", parentWindow(chunk.parentContent(), chunk.content(), 3_600));
            data.put("content", chunk.content());
            data.put("vector", embeddings.get(i).vector());
            bulk.operations(op -> op.index(idx -> idx.index(index).document(data)));
        }
        var response = elasticsearchClient.bulk(bulk.build());
        if (response.errors()) throw new IOException("Elasticsearch hierarchical bulk indexing reported errors");
        log.info("Indexed {} hierarchical child chunks", chunks.size());
    }

    public List<String> search(String question)
            throws IOException {

        return search(question, null, null);
    }

    public List<String> search(String question, String courseId, String classId)
            throws IOException {
        return searchWithScores(question, courseId, classId).stream()
                .map(SearchChunk::content)
                .toList();
    }

    public List<SearchChunk> searchWithScores(String question, String courseId, String classId)
            throws IOException {
        return searchWithScores(question, courseId, classId, null, retrievalTopK);
    }

    public List<SearchChunk> searchApprovedKnowledgeWithScores(
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

    public List<SearchChunk> searchTextbookWithScores(
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

    public List<SearchChunk> searchTextbookKeywordWithScores(
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

        List<SearchChunk> results = new ArrayList<>();
        response.hits().hits().forEach(hit -> {
            Map source = hit.source();
            if (source == null) {
                return;
            }
            SearchChunk chunk = toSearchChunk(source, hit.score());
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
    public List<SearchChunk> searchGoldQaTeachingNotesWithScores(
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

    private List<SearchChunk> searchWithScores(
            String question,
            String courseId,
            String classId,
            String sourceType,
            int topK
    ) throws IOException {
        return searchWithScores(question, courseId, classId, sourceType, Set.of(), topK);
    }

    private List<SearchChunk> searchWithScores(
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

        List<SearchChunk> results = new ArrayList<>();

        response.hits().hits().forEach(hit -> {

            Map source = hit.source();

            if(source != null) {
                SearchChunk chunk = toSearchChunk(source, hit.score());
                if (chunk != null && isVisibleForClass(chunk, classId)) {
                    results.add(chunk);
                }
            }
        });

        log.info("Found {} matching chunks sourceType={}", results.size(), sourceType);

        return results;
    }

    private SearchChunk toSearchChunk(Map source, Double score) {
        Object childContent = source.get("content");
        Object parentContent = source.get("parentContent");
        Object content = parentContent != null ? parentContent : childContent;
        if (content == null) {
            return null;
        }
        return new SearchChunk(
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

    private String parentWindow(String parent, String child, int maxChars) {
        if (parent == null || parent.length() <= maxChars) return parent;
        int childPosition = child == null ? 0 : parent.indexOf(child);
        int start = Math.max(0, childPosition - 800);
        if (start > 0) {
            int boundary = parent.indexOf(' ', start);
            if (boundary > 0) start = boundary + 1;
        }
        int end = Math.min(parent.length(), start + maxChars);
        if (end < parent.length()) {
            int boundary = parent.lastIndexOf(' ', end);
            if (boundary > start) end = boundary;
        }
        return parent.substring(start, end).trim();
    }

    public long deleteChunksByMaterialId(String materialId) throws IOException {
        if (materialId == null || materialId.isBlank()) {
            return 0;
        }
        if (!indexExists()) {
            log.warn("Elasticsearch index {} does not exist yet. Nothing to delete for materialId={}", index, materialId);
            return 0;
        }

        DeleteByQueryResponse response = elasticsearchClient.deleteByQuery(d -> d
                .index(index)
                .query(TermQuery.of(t -> t
                        .field("materialId.keyword")
                        .value(materialId)
                )._toQuery())
        );
        long deleted = response.deleted() == null ? 0 : response.deleted();
        log.info("Deleted {} Elasticsearch chunks for materialId={}", deleted, materialId);
        return deleted;
    }

    public record SearchChunk(
            String content,
            Double score,
            String materialId,
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String sourceType,
            String documentId,
            String chapterId,
            String chapterTitle,
            String sectionId,
            String sectionTitle,
            String chunkId,
            Integer chunkIndex,
            String nodeType
    ) {
        public SearchChunk(
                String content,
                Double score,
                String materialId,
                String courseId,
                String classId,
                String teacherId,
                String materialScope
        ) {
            this(content, score, materialId, courseId, classId, teacherId, materialScope, null,
                    materialId, null, null, null, null, null, null, "CHUNK");
        }

        public SearchChunk(
                String content,
                Double score,
                String materialId,
                String courseId,
                String classId,
                String teacherId,
                String materialScope,
                String sourceType
        ) {
            this(content, score, materialId, courseId, classId, teacherId, materialScope, sourceType,
                    materialId, null, null, null, null, null, null, "CHUNK");
        }
    }

    private boolean isVisibleForClass(SearchChunk chunk, String requestedClassId) {
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






