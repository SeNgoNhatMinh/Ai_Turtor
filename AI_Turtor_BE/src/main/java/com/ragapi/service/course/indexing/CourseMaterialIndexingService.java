package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.RealtimeEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialIndexingService {

    public static final String INDEXING_PROCESSING = CourseMaterialIndexStatus.PROCESSING;
    public static final String INDEXING_INDEXED = CourseMaterialIndexStatus.INDEXED;
    public static final String INDEXING_FAILED = CourseMaterialIndexStatus.FAILED;

    private final CourseMaterialStoreGateway repository;
    private final CourseMaterialStorageService storageService;
    private final CourseMaterialIndexExecutor indexExecutor;
    private final CourseMaterialIndexJobService indexJobService;
    private final RealtimeEventService realtimeEvents;

    public void ingest(CourseMaterial material) throws IOException {
        log.info("Starting ingestion for course material: {}", material.getTitle());
        indexExecutor.markProcessing(material);
        indexExecutor.indexAndMark(material);
    }

    public CourseMaterial ingestPdf(
            MultipartFile file,
            String title,
            String category
    ) throws IOException {
        return ingestPdf(file, title, category, null, null, null);
    }

    public CourseMaterial ingestPdf(
            MultipartFile file,
            String title,
            String category,
            String courseId,
            String classId,
            String teacherId
    ) throws IOException {
        return ingestPdf(file, title, category, courseId, classId, teacherId, null, null);
    }

    public CourseMaterial ingestPdf(
            MultipartFile file,
            String title,
            String category,
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String uploadedByRole
    ) throws IOException {
        CourseMaterial material = storageService.storePdfMaterial(
                file,
                title,
                category,
                courseId,
                classId,
                teacherId,
                materialScope,
                uploadedByRole
        );
        indexExecutor.indexAndMark(material);
        return material;
    }

    public CourseMaterial ingestPdfAsync(
            MultipartFile file,
            String title,
            String category,
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String uploadedByRole
    ) throws IOException {
        CourseMaterial material = isMarkdown(file)
                ? storageService.storeMarkdownMaterial(file, title, category, courseId, classId,
                        teacherId, materialScope, uploadedByRole)
                : storageService.storePdfMaterial(file, title, category, courseId, classId,
                        teacherId, materialScope, uploadedByRole);
        indexJobService.enqueue(material);
        return material;
    }

    public CourseMaterial ingestExtractedMaterialAsync(
            String title,
            String category,
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String uploadedByRole,
            String content,
            String sourceType,
            String sourceUrl,
            String sourceDomain,
            String sourceSection,
            Integer importedPageCount
    ) {
        CourseMaterial material = storageService.storeExtractedMaterial(
                title,
                category,
                courseId,
                classId,
                teacherId,
                materialScope,
                uploadedByRole,
                content,
                sourceType,
                sourceUrl,
                sourceDomain,
                sourceSection,
                importedPageCount
        );
        indexJobService.enqueue(material);
        return material;
    }

    void processQueuedIndex(String materialId, String jobId) throws IOException {
        CourseMaterial material = repository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Course material not found: " + materialId));
        indexExecutor.markProcessing(material);
        indexJobService.updateProgress(jobId, "CHUNKING", 0, 0, 0, 0, 0, 0, 0,
                null, 0, java.util.List.of());
        indexExecutor.indexAndMark(material, progress -> {
            indexJobService.updateProgress(jobId, progress.stage(), progress.totalChunks(), progress.completedChunks(),
                    progress.failedChunks(), progress.translatedChunks(), progress.embeddedChunks(),
                    progress.indexedChunks(), progress.technicalTermsPreserved(), progress.currentChapter(),
                    progress.currentChunk(), progress.failedChunkIds());
            java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
            data.put("jobId", jobId);
            data.put("materialId", materialId);
            data.put("courseId", material.getCourseId());
            data.put("stage", progress.stage());
            data.put("totalChunks", progress.totalChunks());
            data.put("completedChunks", progress.completedChunks());
            data.put("failedChunks", progress.failedChunks());
            data.put("translatedChunks", progress.translatedChunks());
            data.put("embeddedChunks", progress.embeddedChunks());
            data.put("indexedChunks", progress.indexedChunks());
            data.put("technicalTermsPreserved", progress.technicalTermsPreserved());
            realtimeEvents.publishToUser(material.getTeacherId(), "MATERIAL_IMPORT_PROGRESS",
                    "MATERIAL_IMPORT_JOB", jobId, progress.stage(), data);
        });
    }

    void publishJobCompleted(String materialId, String jobId) {
        repository.findById(materialId).ifPresent(material -> realtimeEvents.publishToUser(
                material.getTeacherId(), "MATERIAL_IMPORT_PROGRESS", "MATERIAL_IMPORT_JOB",
                jobId, "COMPLETED", java.util.Map.of(
                        "jobId", jobId,
                        "materialId", materialId,
                        "courseId", material.getCourseId() == null ? "" : material.getCourseId(),
                        "stage", "COMPLETED",
                        "progressPercent", 100)));
    }

    void publishJobOutcome(String materialId, String jobId, String status, String errorMessage) {
        repository.findById(materialId).ifPresent(material -> realtimeEvents.publishToUser(
                material.getTeacherId(), "MATERIAL_IMPORT_PROGRESS", "MATERIAL_IMPORT_JOB",
                jobId, status, java.util.Map.of(
                        "jobId", jobId,
                        "materialId", materialId,
                        "courseId", material.getCourseId() == null ? "" : material.getCourseId(),
                        "stage", status,
                        "errorMessage", errorMessage == null ? "" : errorMessage)));
    }

    private boolean isMarkdown(MultipartFile file) {
        String name = file == null ? null : file.getOriginalFilename();
        if (name == null) return false;
        String lower = name.toLowerCase(java.util.Locale.ROOT);
        return lower.endsWith(".md") || lower.endsWith(".markdown");
    }
}
