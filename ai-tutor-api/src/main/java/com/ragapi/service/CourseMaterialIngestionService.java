package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialIngestionService {

    private static final int EMBEDDING_BATCH_SIZE = 16;

    public static final String INDEXING_PROCESSING = "PROCESSING";
    public static final String INDEXING_INDEXED = "INDEXED";
    public static final String INDEXING_FAILED = "FAILED";

    private final CourseMaterialRepository repository;
    private final CourseMaterialChunkingService chunkingService;
    private final ElasticVectorService vectorService;
    private final PdfExtractionService pdfExtractionService;
    private final PdfStorageService pdfStorageService;
    private final RealtimeEventService realtimeEvents;
    private final ChapterOutlineService chapterOutlineService;
    private final VisualVectorService visualVectorService;

    public void ingest(CourseMaterial material) throws IOException {
        log.info("Starting ingestion for course material: {}", material.getTitle());
        material.setIndexingStatus(INDEXING_PROCESSING);
        repository.save(material);
        log.info("Course material saved to MongoDB with id: {}", material.getId());
        publishMaterialEvent(material, "MATERIAL_INDEXING", INDEXING_PROCESSING);
        indexAndMark(material);
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
        CourseMaterial material = createAndStorePdfMaterial(file, title, category, courseId, classId, teacherId, materialScope, uploadedByRole);
        indexAndMark(material);
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
        CourseMaterial material = createAndStorePdfMaterial(file, title, category, courseId, classId, teacherId, materialScope, uploadedByRole);
        CompletableFuture.runAsync(() -> {
            try {
                indexAndMark(material);
            } catch (Exception e) {
                log.error("Background indexing failed for materialId={}", material.getId(), e);
                markIndexingFailed(material, e.getMessage());
            }
        });
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
        CourseMaterial material = createExtractedMaterial(
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
        CompletableFuture.runAsync(() -> {
            try {
                indexAndMark(material);
            } catch (Exception e) {
                log.error("Background indexing failed for imported materialId={}", material.getId(), e);
                markIndexingFailed(material, e.getMessage());
            }
        });
        return material;
    }

    private CourseMaterial createExtractedMaterial(
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
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("content must not be blank");
        }

        CourseMaterial material = new CourseMaterial();
        material.setTitle(title.trim());
        material.setCategory(category != null && !category.isBlank() ? category.trim() : "course-material");
        material.setCourseId(normalizeScopeValue(courseId));
        material.setClassId(normalizeScopeValue(classId));
        material.setTeacherId(normalizeScopeValue(teacherId));
        material.setMaterialScope(normalizeScopeValue(materialScope) != null ? normalizeScopeValue(materialScope) : "CLASS_SECTION");
        material.setUploadedByRole(normalizeScopeValue(uploadedByRole));
        material.setContent(content.trim());
        material.setSourceFileName(sourceUrl);
        material.setSourceType(sourceType == null || sourceType.isBlank() ? "TEXT" : sourceType.trim());
        material.setSourceUrl(normalizeScopeValue(sourceUrl));
        material.setSourceDomain(normalizeScopeValue(sourceDomain));
        material.setSourceSection(normalizeScopeValue(sourceSection));
        material.setImportedPageCount(importedPageCount);
        material.setIndexingStatus(INDEXING_PROCESSING);
        material.setIndexedAt(null);
        material.setIndexingError(null);

        repository.save(material);
        log.info("Extracted course material saved to MongoDB with id: {}", material.getId());
        publishMaterialEvent(material, "MATERIAL_INDEXING", INDEXING_PROCESSING);
        return material;
    }
    private CourseMaterial createAndStorePdfMaterial(
            MultipartFile file,
            String title,
            String category,
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String uploadedByRole
    ) throws IOException {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }

        byte[] pdfBytes = file.getBytes();
        String normalizedCourseId = normalizeScopeValue(courseId);
        String contentHash = sha256(pdfBytes);
        CourseMaterial duplicate = repository.findFirstByCourseIdAndContentHash(normalizedCourseId, contentHash)
                .orElseGet(() -> findLegacyDuplicate(normalizedCourseId, file.getOriginalFilename(), pdfBytes.length));
        if (duplicate != null) {
            if (duplicate.getContentHash() == null || duplicate.getContentHash().isBlank()) {
                duplicate.setContentHash(contentHash);
                repository.save(duplicate);
            }
            log.info("Duplicate PDF upload reused existing materialId={} for courseId={}", duplicate.getId(), normalizedCourseId);
            return duplicate;
        }
        var extraction = pdfExtractionService.extract(pdfBytes, file.getOriginalFilename());

        CourseMaterial material = new CourseMaterial();
        material.setTitle(title.trim());
        material.setCategory(category != null && !category.isBlank() ? category.trim() : "course-material");
        material.setCourseId(normalizedCourseId);
        material.setClassId(normalizeScopeValue(classId));
        material.setTeacherId(normalizeScopeValue(teacherId));
        material.setMaterialScope(normalizeScopeValue(materialScope) != null ? normalizeScopeValue(materialScope) : "CLASS_SECTION");
        material.setUploadedByRole(normalizeScopeValue(uploadedByRole));
        material.setContent(extraction.text());
        material.setPageCount(extraction.pageCount());
        material.setTableOfContents(extraction.tableOfContents());
        material.setSourceFileName(file.getOriginalFilename());
        material.setSourceType("PDF");
        material.setPdfFileSize((long) pdfBytes.length);
        material.setContentHash(contentHash);
        material.setIndexingStatus(INDEXING_PROCESSING);
        material.setIndexedAt(null);
        material.setIndexingError(null);

        repository.save(material);
        log.info("Course material saved to MongoDB with id: {}", material.getId());
        publishMaterialEvent(material, "MATERIAL_INDEXING", INDEXING_PROCESSING);

        String pdfFileId = pdfStorageService.store(
                pdfBytes,
                file.getOriginalFilename(),
                material.getId()
        );
        material.setPdfFileId(pdfFileId);
        repository.save(material);
        log.info("PDF file stored in GridFS with id: {}", pdfFileId);
        return material;
    }

    private CourseMaterial findLegacyDuplicate(String courseId, String fileName, long fileSize) {
        String normalizedFileName = fileName == null ? "" : fileName.trim();
        return repository.findByCourseId(courseId).stream()
                .filter(item -> item.getPdfFileSize() != null && item.getPdfFileSize() == fileSize)
                .filter(item -> normalizedFileName.equalsIgnoreCase(item.getSourceFileName() == null ? "" : item.getSourceFileName().trim()))
                .findFirst()
                .orElse(null);
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private void indexAndMark(CourseMaterial material) throws IOException {
        try {
            int indexedChunks = indexContent(material);
            indexVisualEvidence(material);
            material.setIndexingStatus(INDEXING_INDEXED);
            material.setIndexedAt(LocalDateTime.now());
            material.setIndexingError(null);
            repository.save(material);
            log.info("Course material {} indexed successfully with {} chunks", material.getId(), indexedChunks);
            publishMaterialEvent(material, "MATERIAL_INDEXED", INDEXING_INDEXED);
            refreshChapterOutlines(material.getCourseId());
        } catch (IOException | RuntimeException e) {
            markIndexingFailed(material, e.getMessage());
            throw e;
        }
    }

    private void indexVisualEvidence(CourseMaterial material) {
        if (!visualVectorService.isEnabled() || material.getPdfFileId() == null) {
            material.setVisualIndexingStatus("DISABLED");
            material.setVisualIndexingError(null);
            return;
        }
        material.setVisualIndexingStatus("PROCESSING");
        repository.save(material);
        try {
            int pages = visualVectorService.indexMaterial(material);
            material.setVisualIndexingStatus("INDEXED");
            material.setVisualIndexedPageCount(pages);
            material.setVisualIndexedAt(LocalDateTime.now());
            material.setVisualIndexingError(null);
        } catch (Exception e) {
            material.setVisualIndexingStatus("FAILED");
            material.setVisualIndexingError(e.getMessage());
            log.warn("Visual indexing failed for materialId={}: {}", material.getId(), e.getMessage());
        }
    }

    private void markIndexingFailed(CourseMaterial material, String errorMessage) {
        try {
            material.setIndexingStatus(INDEXING_FAILED);
            material.setIndexingError(errorMessage == null || errorMessage.isBlank() ? "Indexing failed" : errorMessage);
            material.setIndexedAt(null);
            repository.save(material);
            publishMaterialEvent(material, "MATERIAL_INDEXING_FAILED", INDEXING_FAILED);
        } catch (Exception saveError) {
            log.warn("Could not persist indexing failure for materialId={}", material == null ? null : material.getId(), saveError);
        }
    }

    private int indexContent(CourseMaterial material) throws IOException {
        if (material.getContent() == null || material.getContent().isBlank()) {
            throw new IllegalArgumentException("Course material has no extracted text to index");
        }
        List<String> chunks = chunkingService.chunk(material.getContent());
        if (chunks.isEmpty()) {
            chunks = List.of(material.getContent().trim());
        }
        log.info("Course material chunked into {} chunks", chunks.size());

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

        log.info("All course material chunks indexed to Elasticsearch");
        return chunks.size();
    }

    private String normalizeScopeValue(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
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
}
