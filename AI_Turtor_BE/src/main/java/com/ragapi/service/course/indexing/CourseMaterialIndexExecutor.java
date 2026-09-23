package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.ChapterOutlineService;
import com.ragapi.service.CourseMaterialChunkingService;
import com.ragapi.service.PdfExtractionService;
import com.ragapi.service.PdfStorageService;
import com.ragapi.service.RealtimeEventService;
import com.ragapi.service.VisualVectorService;
import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialIndexExecutor {

    private static final int EMBEDDING_BATCH_SIZE = 16;

    private final CourseMaterialStoreGateway repository;
    private final CourseMaterialChunkingService chunkingService;
    private final CourseMaterialIndexGateway vectorService;
    private final PdfExtractionService pdfExtractionService;
    private final PdfStorageService pdfStorageService;
    private final RealtimeEventService realtimeEvents;
    private final ChapterOutlineService chapterOutlineService;
    private final VisualVectorService visualVectorService;

    public void markProcessing(CourseMaterial material) {
        material.setIndexingStatus(CourseMaterialIndexStatus.PROCESSING);
        material.setIndexedAt(null);
        material.setIndexingError(null);
        repository.save(material);
        publishMaterialEvent(material, "MATERIAL_INDEXING", CourseMaterialIndexStatus.PROCESSING);
    }

    public IndexResult indexAndMark(CourseMaterial material) throws IOException {
        try {
            int indexedChunks = indexContent(material);
            int indexedVisualPages = indexVisualEvidence(material);
            material.setIndexingStatus(CourseMaterialIndexStatus.INDEXED);
            material.setIndexedAt(LocalDateTime.now());
            material.setIndexingError(null);
            repository.save(material);
            log.info("Course material {} indexed successfully with {} chunks", material.getId(), indexedChunks);
            publishMaterialEvent(material, "MATERIAL_INDEXED", CourseMaterialIndexStatus.INDEXED);
            refreshChapterOutlines(material.getCourseId());
            return new IndexResult(indexedChunks, indexedVisualPages);
        } catch (IOException | RuntimeException e) {
            markIndexingFailed(material, e.getMessage());
            throw e;
        }
    }

    public ReindexResult reindexAndMark(CourseMaterial material) throws IOException {
        if (material == null || material.getContent() == null || material.getContent().isBlank()) {
            throw new IllegalArgumentException("Course material has no extracted content to reindex");
        }
        markProcessing(material);
        try {
            long deletedChunks = vectorService.deleteChunksByMaterialId(material.getId());
            long deletedVisualPages = visualVectorService.deleteMaterial(material.getId());
            IndexResult indexed = indexAndMark(material);
            return new ReindexResult(
                    deletedChunks,
                    deletedVisualPages,
                    indexed.indexedChunks(),
                    indexed.indexedVisualPages()
            );
        } catch (IOException | RuntimeException failure) {
            if (!CourseMaterialIndexStatus.FAILED.equals(material.getIndexingStatus())) {
                markIndexingFailed(material, failure.getMessage());
            }
            throw failure;
        }
    }

    private int indexVisualEvidence(CourseMaterial material) {
        if (!visualVectorService.isEnabled() || material.getPdfFileId() == null) {
            material.setVisualIndexingStatus("DISABLED");
            material.setVisualIndexingError(null);
            return 0;
        }
        material.setVisualIndexingStatus("PROCESSING");
        repository.save(material);
        try {
            int pages = visualVectorService.indexMaterial(material);
            material.setVisualIndexingStatus("INDEXED");
            material.setVisualIndexedPageCount(pages);
            material.setVisualIndexedAt(LocalDateTime.now());
            material.setVisualIndexingError(null);
            return pages;
        } catch (Exception e) {
            material.setVisualIndexingStatus("FAILED");
            material.setVisualIndexingError(e.getMessage());
            log.warn("Visual indexing failed for materialId={}: {}", material.getId(), e.getMessage());
            return 0;
        }
    }

    private void markIndexingFailed(CourseMaterial material, String errorMessage) {
        try {
            material.setIndexingStatus(CourseMaterialIndexStatus.FAILED);
            material.setIndexingError(errorMessage == null || errorMessage.isBlank() ? "Indexing failed" : errorMessage);
            material.setIndexedAt(null);
            repository.save(material);
            publishMaterialEvent(material, "MATERIAL_INDEXING_FAILED", CourseMaterialIndexStatus.FAILED);
        } catch (Exception saveError) {
            log.warn("Could not persist indexing failure for materialId={}", material == null ? null : material.getId(), saveError);
        }
    }

    private int indexContent(CourseMaterial material) throws IOException {
        if (material.getContent() == null || material.getContent().isBlank()) {
            throw new IllegalArgumentException("Course material has no extracted text to index");
        }
        List<CourseMaterialChunkingService.HierarchicalChunk> chunks =
                prepareHierarchicalChunks(material);
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("Course material could not be chunked for indexing");
        }
        log.info("Course material chunked into {} hierarchical child chunks", chunks.size());

        for (int start = 0; start < chunks.size(); start += EMBEDDING_BATCH_SIZE) {
            List<CourseMaterialChunkingService.HierarchicalChunk> batch =
                    chunks.subList(start, Math.min(start + EMBEDDING_BATCH_SIZE, chunks.size()));
            vectorService.indexHierarchicalChunks(
                    material.getCourseId(),
                    material.getClassId(),
                    material.getTeacherId(),
                    material.getId(),
                    material.getMaterialScope(),
                    material.getSourceType(),
                    material.getSourceUrl(),
                    material.getSourceDomain(),
                    batch
            );
        }

        log.info("All hierarchical course material chunks indexed to Elasticsearch");
        return chunks.size();
    }

    private List<CourseMaterialChunkingService.HierarchicalChunk> prepareHierarchicalChunks(
            CourseMaterial material) {
        if (material == null || !"PDF".equalsIgnoreCase(material.getSourceType())
                || material.getPdfFileId() == null || material.getPdfFileId().isBlank()) {
            return chunkingService.chunkHierarchically(material);
        }
        try {
            var resource = pdfStorageService.loadByFileId(material.getPdfFileId());
            byte[] pdfBytes;
            try (var input = resource.getInputStream()) {
                pdfBytes = input.readAllBytes();
            }
            var refreshedToc = pdfExtractionService.extractTableOfContents(pdfBytes);
            if (!refreshedToc.isEmpty()) {
                material.setTableOfContents(refreshedToc);
                repository.save(material);
            }
            List<String> pages = pdfExtractionService.extractPages(pdfBytes);
            List<CourseMaterialChunkingService.HierarchicalChunk> pageChunks =
                    chunkingService.chunkPdfPages(material, pages);
            if (!pageChunks.isEmpty()) return pageChunks;
        } catch (Exception error) {
            log.warn("Could not build page-aware PDF hierarchy for materialId={}: {}",
                    material.getId(), error.getMessage());
        }
        return chunkingService.chunkHierarchically(material);
    }

    private void refreshChapterOutlines(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return;
        }
        try {
            chapterOutlineService.refreshOutlinesForCourse(courseId.trim());
        } catch (Exception e) {
            log.warn("Could not refresh chapter outlines for courseId={}: {}", courseId, e.getMessage());
        }
    }

    private void publishMaterialEvent(CourseMaterial material, String type, String status) {
        if (material == null) return;
        realtimeEvents.publishToUser(material.getTeacherId(), type, "COURSE_MATERIAL", material.getId(), status, Map.of(
                "courseId", material.getCourseId() == null ? "" : material.getCourseId(),
                "classId", material.getClassId() == null ? "" : material.getClassId(),
                "title", material.getTitle() == null ? "" : material.getTitle(),
                "indexingError", material.getIndexingError() == null ? "" : material.getIndexingError()));
    }

    public record IndexResult(int indexedChunks, int indexedVisualPages) {
    }

    public record ReindexResult(
            long deletedChunks,
            long deletedVisualPages,
            int indexedChunks,
            int indexedVisualPages
    ) {
    }
}
