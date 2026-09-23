package com.ragapi.infrastructure.elasticsearch;

import com.ragapi.service.CourseMaterialChunkingService;
import com.ragapi.service.EmbeddingService;
import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.TermQuery;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import co.elastic.clients.elasticsearch.core.IndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import dev.langchain4j.data.embedding.Embedding;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ElasticsearchCourseIndexAdapter implements CourseMaterialIndexGateway {

    private final ElasticsearchClient elasticsearchClient;
    private final EmbeddingService embeddingService;

    @Value("${elasticsearch.index}")
    private String index;

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
            bulk.operations(op -> op.index(idx -> idx
                    .index(index)
                    .id(chunk.chunkId())
                    .document(data)));
        }
        var response = elasticsearchClient.bulk(bulk.build());
        if (response.errors()) throw new IOException("Elasticsearch hierarchical bulk indexing reported errors");
        log.info("Indexed {} hierarchical child chunks", chunks.size());
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

    private boolean indexExists() throws IOException {
        return elasticsearchClient.indices()
                .exists(ExistsRequest.of(e -> e.index(index)))
                .value();
    }
}
