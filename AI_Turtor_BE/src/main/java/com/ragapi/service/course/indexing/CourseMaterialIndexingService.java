package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
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

    void processQueuedIndex(String materialId) throws IOException {
        CourseMaterial material = repository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Course material not found: " + materialId));
        indexExecutor.markProcessing(material);
        indexExecutor.indexAndMark(material);
    }
}
