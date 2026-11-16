package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.CourseMaterialAccessPolicy;
import com.ragapi.service.ExpertCoTrainingService;
import com.ragapi.service.HumanLearningService;
import com.ragapi.service.PdfPageRenderService;
import com.ragapi.service.PdfStorageService;
import com.ragapi.service.VisualVectorService;
import com.ragapi.service.course.gateway.CourseMaterialIndexGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Administrative lifecycle operations for indexed course material. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialIndexManagementService {

    private static final int MATERIAL_ATTEMPTS = 3;

    private final CourseMaterialStoreGateway materialRepository;
    private final CourseMaterialIndexGateway vectorService;
    private final PdfStorageService pdfStorageService;
    private final PdfPageRenderService pdfPageRenderService;
    private final VisualVectorService visualVectorService;
    private final CourseMaterialAccessPolicy accessPolicy;
    private final HumanLearningService humanLearningService;
    private final ExpertCoTrainingService expertCoTrainingService;
    private final CourseMaterialIndexExecutor indexExecutor;
    private final ReindexProgressTracker reindexProgress;
    private final ReindexCancellation reindexCancellation;

    public Map<String, Object> deleteMaterial(
            String courseId,
            String materialId,
            String requesterId,
            String requesterRole
    ) throws IOException {
        CourseMaterial material = requireMaterialInCourse(courseId, materialId);
        accessPolicy.requireManagePermission(material, requesterId, requesterRole);
        return deleteMaterial(material);
    }

    public Map<String, Object> deleteMaterialAsSystem(String courseId, String materialId) throws IOException {
        return deleteMaterial(requireMaterialInCourse(courseId, materialId));
    }

    private Map<String, Object> deleteMaterial(CourseMaterial material) throws IOException {
        String courseId = material.getCourseId();
        String materialId = material.getId();
        boolean approvedKnowledge = "KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType());
        boolean goldQaTeachingNote = "GOLD_QA".equalsIgnoreCase(material.getSourceType());
        long deletedChunks = vectorService.deleteChunksByMaterialId(materialId);
        long deletedVisualPages = visualVectorService.deleteMaterial(materialId);
        if (material.getPdfFileId() != null) {
            pdfStorageService.deleteByDocumentId(materialId);
        }
        pdfPageRenderService.evictMaterial(materialId);
        materialRepository.deleteById(materialId);
        if (approvedKnowledge) {
            humanLearningService.onApprovedKnowledgeMaterialDeleted(materialId);
        } else if (goldQaTeachingNote) {
            expertCoTrainingService.onTeachingNoteMaterialDeleted(materialId);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "DELETED");
        response.put("courseId", courseId);
        response.put("materialId", materialId);
        response.put("deletedChunks", deletedChunks);
        response.put("deletedVisualPages", deletedVisualPages);
        response.put("approvedKnowledgeCascaded", approvedKnowledge || goldQaTeachingNote);
        return response;
    }

    public Map<String, Object> reindexMaterial(
            String courseId,
            String materialId,
            String requesterRole
    ) throws IOException {
        accessPolicy.requireReindexPermission(requesterRole);
        CourseMaterial material = requireMaterialInCourse(courseId, materialId);
        reindexProgress.start(courseId, 1);
        reindexProgress.beginMaterial(courseId, 0, 1, materialTitle(material));
        CourseMaterialIndexExecutor.ReindexResult result;
        try {
            result = indexExecutor.reindexAndMark(material, progress -> reindexProgress.onChunk(
                    courseId, 0, 1, materialTitle(material), progress));
        } catch (IOException | RuntimeException error) {
            reindexProgress.fail(courseId, error.getMessage());
            throw error;
        }
        reindexProgress.complete(courseId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "REINDEXED");
        response.put("courseId", courseId);
        response.put("materialId", materialId);
        response.put("deletedChunks", result.deletedChunks());
        response.put("deletedVisualPages", result.deletedVisualPages());
        response.put("indexedChunks", result.indexedChunks());
        response.put("indexedVisualPages", result.indexedVisualPages());
        return response;
    }

    public Map<String, Object> reindexCourse(String courseId, String requesterRole) throws IOException {
        accessPolicy.requireReindexPermission(requesterRole);
        List<CourseMaterial> materials = materialRepository.findByCourseId(courseId);
        if (materials.isEmpty()) {
            throw new IllegalArgumentException("No course materials found for requested course");
        }

        int indexable = (int) materials.stream().filter(this::hasContent).count();
        reindexProgress.start(courseId, indexable);
        ReindexTotals totals = new ReindexTotals();
        int completed = 0;
        List<CourseMaterial> pending = new ArrayList<>();
        for (CourseMaterial material : materials) {
            if (!hasContent(material)) {
                totals.skippedMaterials++;
                continue;
            }
            pending.add(material);
        }
        List<String> failures = List.of();
        try {
            for (int attempt = 1; attempt <= MATERIAL_ATTEMPTS && !pending.isEmpty(); attempt++) {
                throwIfStopped();
                if (attempt > 1) {
                    log.warn("Retrying {} course materials for {}, attempt {}/{}",
                            pending.size(), courseId, attempt, MATERIAL_ATTEMPTS);
                    pauseBeforeRetry(attempt);
                }
                List<CourseMaterial> failed = new ArrayList<>();
                List<String> reasons = new ArrayList<>();
                for (CourseMaterial material : pending) {
                    String title = materialTitle(material);
                    int completedBefore = completed;
                    throwIfStopped();
                    reindexProgress.beginMaterial(courseId, completedBefore, indexable, title);
                    try {
                        CourseMaterialIndexExecutor.ReindexResult result = indexExecutor.reindexAndMark(
                                material,
                                progress -> {
                                    throwIfStopped();
                                    reindexProgress.onChunk(courseId, completedBefore, indexable, title, progress);
                                }
                        );
                        totals.add(result);
                        completed++;
                    } catch (ReindexCancelledException cancelled) {
                        throw cancelled;
                    } catch (IOException | RuntimeException error) {
                        failed.add(material);
                        reasons.add(title + ": " + brief(error.getMessage()));
                        log.warn("Reindex attempt {}/{} failed for {} in {}: {}",
                                attempt, MATERIAL_ATTEMPTS, title, courseId, error.getMessage());
                    }
                }
                pending = failed;
                failures = reasons;
            }
            if (!pending.isEmpty()) {
                throw new IllegalStateException("Reindex chưa xong: " + String.join("; ", failures));
            }
        } catch (ReindexCancelledException cancelled) {
            reindexProgress.cancel(courseId);
            throw cancelled;
        } catch (RuntimeException error) {
            reindexProgress.fail(courseId, error.getMessage());
            throw error;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "REINDEXED_COURSE");
        response.put("courseId", courseId);
        response.put("reindexedMaterials", totals.reindexedMaterials);
        response.put("skippedMaterials", totals.skippedMaterials);
        response.put("deletedChunks", totals.deletedChunks);
        response.put("deletedVisualPages", totals.deletedVisualPages);
        response.put("indexedChunks", totals.indexedChunks);
        response.put("indexedVisualPages", totals.indexedVisualPages);
        reindexProgress.complete(courseId);
        return response;
    }

    public Map<String, Object> reindexProgress(String courseId, String requesterRole) {
        accessPolicy.requireReindexPermission(requesterRole);
        return reindexProgress.snapshot(courseId);
    }

    public Map<String, Object> reindexApprovedKnowledge() throws IOException {
        List<CourseMaterial> materials = materialRepository.findBySourceType("KNOWLEDGE_CANDIDATE");
        int reindexed = 0;
        int skipped = 0;
        for (CourseMaterial material : materials) {
            if (!hasContent(material)) {
                skipped++;
                continue;
            }
            indexExecutor.reindexAndMark(material);
            reindexed++;
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "REINDEXED_APPROVED_KNOWLEDGE");
        response.put("reindexedMaterials", reindexed);
        response.put("skippedMaterials", skipped);
        return response;
    }

    private void throwIfStopped() {
        if (reindexCancellation.isStopRequested()) {
            throw new ReindexCancelledException();
        }
    }

    private void pauseBeforeRetry(int attempt) {
        long deadline = System.currentTimeMillis() + Math.min(8_000L, 1_000L << Math.max(0, attempt - 1));
        while (System.currentTimeMillis() < deadline) {
            throwIfStopped();
            try {
                Thread.sleep(200);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new ReindexCancelledException();
            }
        }
    }

    private static String brief(String message) {
        if (message == null || message.isBlank()) {
            return "lỗi không rõ";
        }
        String compact = message.replaceAll("\\s+", " ").trim();
        return compact.length() <= 180 ? compact : compact.substring(0, 180);
    }

    private boolean hasContent(CourseMaterial material) {
        return material != null && material.getContent() != null && !material.getContent().isBlank();
    }

    private static String materialTitle(CourseMaterial material) {
        if (material.getTitle() != null && !material.getTitle().isBlank()) {
            return material.getTitle().trim();
        }
        if (material.getSourceFileName() != null && !material.getSourceFileName().isBlank()) {
            return material.getSourceFileName().trim();
        }
        return material.getId() == null ? "Tài liệu" : material.getId();
    }

    private CourseMaterial requireMaterialInCourse(String courseId, String materialId) {
        CourseMaterial material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Course material not found"));
        if (material.getCourseId() == null || !material.getCourseId().equals(courseId)) {
            throw new IllegalArgumentException("Course material not found in requested course");
        }
        return material;
    }

    private static final class ReindexTotals {
        private int reindexedMaterials;
        private int skippedMaterials;
        private long deletedChunks;
        private long deletedVisualPages;
        private int indexedChunks;
        private int indexedVisualPages;

        private void add(CourseMaterialIndexExecutor.ReindexResult result) {
            reindexedMaterials++;
            deletedChunks += result.deletedChunks();
            deletedVisualPages += result.deletedVisualPages();
            indexedChunks += result.indexedChunks();
            indexedVisualPages += result.indexedVisualPages();
        }
    }
}
