package com.ragapi.service;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.TermQuery;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import com.ragapi.entity.CourseMaterial;
import dev.langchain4j.data.embedding.Embedding;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class VisualVectorService {
    private final ElasticsearchClient elasticsearchClient;
    private final EmbeddingService embeddingService;
    private final OpenRouterVisualEmbeddingClient visualClient;
    private final PdfPageRenderService pageRenderer;

    @Value("${rag.visual.elasticsearch-index:course_material_vectors_visual_nemotron_v1}") private String index;
    @Value("${rag.visual.max-pages-per-material:200}") private int maxPages;
    @Value("${rag.visual.retrieval.top-k:4}") private int topK;
    @Value("${rag.visual.retrieval.num-candidates:40}") private int numCandidates;

    public boolean isEnabled() { return visualClient.isEnabled(); }

    public int indexMaterial(CourseMaterial material) throws IOException {
        if (!isEnabled() || material == null || material.getPdfFileId() == null) return 0;
        int detectedPages = material.getPageCount() == null || material.getPageCount() < 1
                ? pageRenderer.countPages(material.getId()) : material.getPageCount();
        material.setPageCount(detectedPages);
        int pages = Math.min(detectedPages, Math.max(1, maxPages));
        BulkRequest.Builder bulk = new BulkRequest.Builder();
        for (int page = 1; page <= pages; page++) {
            byte[] png = pageRenderer.renderPage(material.getId(), page);
            float[] vector = visualClient.embedPng(png, material.getTitle() + " - page " + page);
            Map<String, Object> data = new HashMap<>();
            data.put("materialId", material.getId()); data.put("courseId", material.getCourseId());
            data.put("classId", material.getClassId()); data.put("teacherId", material.getTeacherId());
            data.put("materialScope", material.getMaterialScope()); data.put("pageNumber", page);
            data.put("modality", "IMAGE"); data.put("embeddingProvider", "OPENROUTER");
            data.put("embeddingModel", visualClient.model()); data.put("indexedAt", LocalDateTime.now().toString());
            data.put("vector", vector);
            bulk.operations(op -> op.index(i -> i.index(index).id(material.getId() + "-p" + data.get("pageNumber")).document(data)));
        }
        var response = elasticsearchClient.bulk(bulk.build());
        if (response.errors()) throw new IOException("Visual Elasticsearch bulk indexing reported errors");
        return pages;
    }

    public List<VisualHit> search(String question, String courseId, String classId) throws IOException {
        if (!isEnabled() || !indexExists()) return List.of();
        Embedding embedding = embeddingService.generateQueryEmbedding(question);
        List<Float> vector = new ArrayList<>(); for (float value : embedding.vector()) vector.add(value);
        List<Query> filters = List.of(TermQuery.of(t -> t.field("courseId.keyword").value(courseId))._toQuery());
        var response = elasticsearchClient.search(s -> s.index(index).knn(k -> k.field("vector").queryVector(vector)
                .k(Math.max(1, topK)).numCandidates(Math.max(topK, numCandidates)).filter(filters)), Map.class);
        List<VisualHit> hits = new ArrayList<>();
        response.hits().hits().forEach(hit -> {
            Map source = hit.source(); if (source == null) return;
            String hitClass = Objects.toString(source.get("classId"), null);
            if (hitClass != null && !hitClass.isBlank() && (classId == null || !hitClass.equalsIgnoreCase(classId))) return;
            hits.add(new VisualHit(Objects.toString(source.get("materialId"), null),
                    ((Number) source.get("pageNumber")).intValue(), hit.score(), Objects.toString(source.get("embeddingModel"), null)));
        });
        return hits;
    }

    public long deleteMaterial(String materialId) throws IOException {
        if (!indexExists()) return 0;
        DeleteByQueryResponse response = elasticsearchClient.deleteByQuery(d -> d.index(index)
                .query(TermQuery.of(t -> t.field("materialId.keyword").value(materialId))._toQuery()));
        return response.deleted() == null ? 0 : response.deleted();
    }
    private boolean indexExists() throws IOException { return elasticsearchClient.indices().exists(ExistsRequest.of(e -> e.index(index))).value(); }
    public record VisualHit(String materialId, int pageNumber, Double score, String model) {}
}
