package com.ragapi.service.course.indexing;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.PdfExtractionService;
import com.ragapi.service.PdfPageRenderService;
import com.ragapi.service.PdfStorageService;
import com.ragapi.service.RealtimeEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialStorageService {

    private final CourseMaterialStoreGateway repository;
    private final PdfExtractionService pdfExtractionService;
    private final PdfStorageService pdfStorageService;
    private final PdfPageRenderService pdfPageRenderService;
    private final RealtimeEventService realtimeEvents;

    public CourseMaterial storeExtractedMaterial(
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
        material.setContentHash(sha256(content.trim().getBytes(StandardCharsets.UTF_8)));
        material.setIndexingStatus(CourseMaterialIndexStatus.PROCESSING);
        material.setIndexedAt(null);
        material.setIndexingError(null);

        repository.save(material);
        log.info("Extracted course material saved to MongoDB with id: {}", material.getId());
        publishMaterialEvent(material, "MATERIAL_INDEXING", CourseMaterialIndexStatus.PROCESSING);
        return material;
    }
    public CourseMaterial storePdfMaterial(
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
            pdfPageRenderService.cacheDocument(duplicate.getCourseId(), duplicate.getId(), pdfBytes);
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
        material.setIndexingStatus(CourseMaterialIndexStatus.PROCESSING);
        material.setIndexedAt(null);
        material.setIndexingError(null);

        repository.save(material);
        log.info("Course material saved to MongoDB with id: {}", material.getId());
        publishMaterialEvent(material, "MATERIAL_INDEXING", CourseMaterialIndexStatus.PROCESSING);

        String pdfFileId = pdfStorageService.store(
                pdfBytes,
                file.getOriginalFilename(),
                material.getId()
        );
        pdfPageRenderService.cacheDocument(normalizedCourseId, material.getId(), pdfBytes);
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

    private String normalizeScopeValue(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
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
