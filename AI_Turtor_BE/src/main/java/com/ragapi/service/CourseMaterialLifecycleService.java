package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@AllArgsConstructor
public class CourseMaterialLifecycleService {

    private static final int EMBEDDING_BATCH_SIZE = 16;

    private final CourseMaterialRepository materialRepository;
    private final CourseMaterialChunkingService chunkingService;
    private final ElasticVectorService vectorService;
    private final PdfStorageService pdfStorageService;
    private final PdfPageRenderService pdfPageRenderService;
    private final VisualVectorService visualVectorService;

    public Map<String, Object> deleteMaterial(String courseId, String materialId, String requesterTeacherId) throws IOException {
        CourseMaterial material = requireMaterialInCourse(courseId, materialId);
        validateTeacherIfProvided(material, requesterTeacherId);

        long deletedChunks = vectorService.deleteChunksByMaterialId(materialId);
        long deletedVisualPages = visualVectorService.deleteMaterial(materialId);
        if (material.getPdfFileId() != null) {
            pdfStorageService.deleteByDocumentId(materialId);
        }
        pdfPageRenderService.evictMaterial(materialId);
        materialRepository.deleteById(materialId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "DELETED");
        response.put("courseId", courseId);
        response.put("materialId", materialId);
        response.put("deletedChunks", deletedChunks);
        response.put("deletedVisualPages", deletedVisualPages);
        return response;
    }

    public Map<String, Object> reindexMaterial(String courseId, String materialId, String requesterTeacherId) throws IOException {
        CourseMaterial material = requireMaterialInCourse(courseId, materialId);
        validateTeacherIfProvided(material, requesterTeacherId);
        if (material.getContent() == null || material.getContent().isBlank()) {
            throw new IllegalArgumentException("Course material has no extracted content to reindex");
        }

        material.setIndexingStatus(CourseMaterialIngestionService.INDEXING_PROCESSING);
        material.setIndexingError(null);
        materialRepository.save(material);

        long deletedChunks = vectorService.deleteChunksByMaterialId(materialId);
        visualVectorService.deleteMaterial(materialId);
        List<String> chunks = chunkingService.chunk(material.getContent());
        if (chunks.isEmpty()) {
            chunks = List.of(material.getContent().trim());
        }
        for (int start = 0; start < chunks.size(); start += EMBEDDING_BATCH_SIZE) {
            List<String> batch = chunks.subList(start, Math.min(start + EMBEDDING_BATCH_SIZE, chunks.size()));
            vectorService.indexChunks(
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

        material.setIndexingStatus(CourseMaterialIngestionService.INDEXING_INDEXED);
        material.setIndexedAt(LocalDateTime.now());
        material.setIndexingError(null);
        try {
            int visualPages = visualVectorService.indexMaterial(material);
            material.setVisualIndexingStatus(visualVectorService.isEnabled() ? "INDEXED" : "DISABLED");
            material.setVisualIndexedPageCount(visualPages);
            material.setVisualIndexedAt(visualPages > 0 ? LocalDateTime.now() : null);
            material.setVisualIndexingError(null);
        } catch (Exception e) {
            material.setVisualIndexingStatus("FAILED");
            material.setVisualIndexingError(e.getMessage());
        }
        materialRepository.save(material);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "REINDEXED");
        response.put("courseId", courseId);
        response.put("materialId", materialId);
        response.put("deletedChunks", deletedChunks);
        response.put("indexedChunks", chunks.size());
        return response;
    }


    public Map<String, Object> reindexCourse(String courseId, String requesterTeacherId) throws IOException {
        List<CourseMaterial> materials = materialRepository.findByCourseId(courseId);
        if (materials.isEmpty()) {
            throw new IllegalArgumentException("No course materials found for requested course");
        }

        int reindexedMaterials = 0;
        int skippedMaterials = 0;
        long deletedChunks = 0;
        long deletedVisualPages = 0;
        int indexedChunks = 0;
        int indexedVisualPages = 0;

        for (CourseMaterial material : materials) {
            if (requesterTeacherId != null && !requesterTeacherId.isBlank()) {
                if (material.getTeacherId() == null || !requesterTeacherId.equals(material.getTeacherId())) {
                    skippedMaterials++;
                    continue;
                }
            }
            if (material.getContent() == null || material.getContent().isBlank()) {
                skippedMaterials++;
                continue;
            }

            deletedChunks += vectorService.deleteChunksByMaterialId(material.getId());
            deletedVisualPages += visualVectorService.deleteMaterial(material.getId());
            List<String> chunks = chunkingService.chunk(material.getContent());
            if (chunks.isEmpty()) {
                chunks = List.of(material.getContent().trim());
            }
            for (int start = 0; start < chunks.size(); start += EMBEDDING_BATCH_SIZE) {
                List<String> batch = chunks.subList(start, Math.min(start + EMBEDDING_BATCH_SIZE, chunks.size()));
                vectorService.indexChunks(
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
            reindexedMaterials++;
            indexedChunks += chunks.size();
            try {
                int pages = visualVectorService.indexMaterial(material);
                indexedVisualPages += pages;
                material.setVisualIndexingStatus(visualVectorService.isEnabled() ? "INDEXED" : "DISABLED");
                material.setVisualIndexedPageCount(pages);
                material.setVisualIndexedAt(pages > 0 ? LocalDateTime.now() : null);
                material.setVisualIndexingError(null);
            } catch (Exception e) {
                material.setVisualIndexingStatus("FAILED");
                material.setVisualIndexingError(e.getMessage());
            }
            materialRepository.save(material);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "REINDEXED_COURSE");
        response.put("courseId", courseId);
        response.put("reindexedMaterials", reindexedMaterials);
        response.put("skippedMaterials", skippedMaterials);
        response.put("deletedChunks", deletedChunks);
        response.put("deletedVisualPages", deletedVisualPages);
        response.put("indexedChunks", indexedChunks);
        response.put("indexedVisualPages", indexedVisualPages);
        return response;
    }
    private CourseMaterial requireMaterialInCourse(String courseId, String materialId) {
        CourseMaterial material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Course material not found"));
        if (material.getCourseId() == null || !material.getCourseId().equals(courseId)) {
            throw new IllegalArgumentException("Course material not found in requested course");
        }
        return material;
    }

    private void validateTeacherIfProvided(CourseMaterial material, String requesterTeacherId) {
        if (requesterTeacherId == null || requesterTeacherId.isBlank()) {
            return;
        }
        if (material.getTeacherId() == null || !requesterTeacherId.equals(material.getTeacherId())) {
            throw new IllegalArgumentException("Only the material owner teacher can perform this operation");
        }
    }
}
