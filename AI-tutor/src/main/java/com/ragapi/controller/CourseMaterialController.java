package com.ragapi.controller;

import com.ragapi.dto.CourseMaterialListResponse;
import com.ragapi.dto.HtmlTableOfContentsRequest;
import com.ragapi.dto.ImportCourseMaterialUrlRequest;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.service.CourseMaterialQueryService;
import com.ragapi.service.CourseMaterialHtmlImportService;
import com.ragapi.service.CourseMaterialIngestionService;
import com.ragapi.service.CourseMaterialLifecycleService;
import com.ragapi.service.PdfStorageService;
import com.ragapi.service.PdfPageRenderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.validateFile;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Course Materials", description = "Upload, store and index course materials for RAG")
public class CourseMaterialController {

    private final CourseMaterialIngestionService ingestionService;
    private final CourseMaterialHtmlImportService htmlImportService;
    private final CourseMaterialRepository courseMaterialRepository;
    private final PdfStorageService pdfStorageService;
    private final PdfPageRenderService pdfPageRenderService;
    private final CourseMaterialLifecycleService lifecycleService;
    private final CourseMaterialQueryService queryService;

    @Value("${upload.pdf.max-size-mb:50}")
    private long maxMaterialUploadMb;

    private static final Set<String> MATERIAL_EXTENSIONS = Set.of("pdf");
    private static final Set<String> MATERIAL_CONTENT_TYPES = Set.of("application/pdf", "application/x-pdf");

    @PostMapping(
            value = "/courses/{courseId}/materials/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @Operation(summary = "Upload course material and index it by course scope")
    public ResponseEntity<?> uploadCourseMaterial(
            @PathVariable String courseId,
            @RequestParam(value = "classId", required = false) String classId,
            @RequestParam(value = "teacherId", required = false) String teacherId,
            @RequestParam("title") String title,
            @RequestParam(value = "uploaderRole", required = false) String uploaderRole,
            @Parameter(description = "Course material file", required = true, schema = @Schema(type = "string", format = "binary"))
            @RequestPart("file") MultipartFile file
    ) {
        try {
            validateScope(courseId);
            MaterialUploadScope uploadScope = resolveUploadScope(uploaderRole, classId, teacherId);
            validateFile(file, "file", maxMaterialUploadMb, MATERIAL_EXTENSIONS, MATERIAL_CONTENT_TYPES);
            String safeTitle = requireMaxLength(title, "title", SHORT_TEXT_MAX_LENGTH);
            CourseMaterial material = ingestionService.ingestPdfAsync(
                    file,
                    safeTitle,
                    "course-material",
                    courseId,
                    uploadScope.classId(),
                    uploadScope.uploaderId(),
                    uploadScope.materialScope(),
                    uploadScope.uploaderRole()
            );

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "Material uploaded. Indexing is running in background.");
            response.put("materialId", material.getId());
            response.put("documentId", material.getId());
            response.put("courseId", material.getCourseId());
            response.put("classId", material.getClassId());
            response.put("teacherId", material.getTeacherId());
            response.put("materialScope", material.getMaterialScope());
            response.put("uploadedByRole", material.getUploadedByRole());
            response.put("pdfFileId", material.getPdfFileId());
            response.put("fileName", material.getSourceFileName());
            response.put("pdfFileSize", material.getPdfFileSize());
            response.put("title", material.getTitle());
            response.put("pageCount", material.getPageCount());
            response.put("tocItemCount", material.getTableOfContents() == null ? 0 : material.getTableOfContents().size());
            response.put("indexingStatus", material.getIndexingStatus());
            response.put("indexedAt", material.getIndexedAt());
            response.put("indexingError", material.getIndexingError());
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Elasticsearch error during course material ingestion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Elasticsearch error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during course material upload", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }



    @PostMapping("/courses/{courseId}/materials/url-toc")
    @Operation(summary = "Preview table of contents from an HTML documentation URL")
    public ResponseEntity<?> previewHtmlTableOfContents(
            @PathVariable String courseId,
            @RequestBody HtmlTableOfContentsRequest request
    ) {
        try {
            validateScope(courseId);
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
            }
            CourseMaterialHtmlImportService.TableOfContentsResult result = htmlImportService.previewTableOfContents(request.getUrl());
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("courseId", courseId);
            response.put("title", result.title());
            response.put("sourceUrl", result.sourceUrl());
            response.put("items", result.items());
            response.put("itemCount", result.items().size());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("HTML TOC preview failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "HTML TOC preview error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during HTML TOC preview", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }
    @PostMapping("/courses/{courseId}/materials/import-url")
    @Operation(summary = "Import HTML documentation URL as course material")
    public ResponseEntity<?> importCourseMaterialUrl(
            @PathVariable String courseId,
            @RequestBody ImportCourseMaterialUrlRequest request
    ) {
        try {
            validateScope(courseId);
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
            }
            MaterialUploadScope uploadScope = resolveUploadScope(request.getUploaderRole(), request.getClassId(), request.getTeacherId());
            CourseMaterialHtmlImportService.ImportResult result = htmlImportService.importHtml(
                    request,
                    courseId,
                    uploadScope.classId(),
                    uploadScope.uploaderId(),
                    uploadScope.materialScope(),
                    uploadScope.uploaderRole()
            );

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("message", "HTML material imported. Indexing is running in background.");
            response.put("materialId", result.materialId());
            response.put("title", result.title());
            response.put("courseId", courseId);
            response.put("classId", uploadScope.classId());
            response.put("teacherId", uploadScope.uploaderId());
            response.put("materialScope", uploadScope.materialScope());
            response.put("uploadedByRole", uploadScope.uploaderRole());
            response.put("sourceType", "HTML_URL");
            response.put("importedUrls", result.importedUrls());
            response.put("importedPageCount", result.importedUrls().size());
            response.put("indexingStatus", result.indexingStatus());
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("HTML URL import failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "HTML import error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during HTML material import", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }
    @GetMapping("/courses/{courseId}/materials/{materialId}")
    @Operation(summary = "Get course material detail")
    public ResponseEntity<?> getCourseMaterial(
            @PathVariable String courseId,
            @PathVariable String materialId
    ) {
        CourseMaterial material = courseMaterialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Course material not found"));
        if (material.getCourseId() == null || !material.getCourseId().equals(courseId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Course material not found in requested course"));
        }
        return ResponseEntity.ok(material);
    }

    @PutMapping("/courses/{courseId}/materials/{materialId}")
    @Operation(summary = "Update course material metadata")
    public ResponseEntity<?> updateCourseMaterialMetadata(
            @PathVariable String courseId,
            @PathVariable String materialId,
            @RequestBody CourseMaterial request
    ) {
        try {
            CourseMaterial material = courseMaterialRepository.findById(materialId)
                    .orElseThrow(() -> new IllegalArgumentException("Course material not found"));
            if (material.getCourseId() == null || !material.getCourseId().equals(courseId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Course material not found in requested course"));
            }
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
            }
            if (request.getTitle() != null) {
                material.setTitle(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH));
            }
            if (request.getCategory() != null) {
                material.setCategory(optionalMaxLength(request.getCategory(), "category", SHORT_TEXT_MAX_LENGTH));
            }
            return ResponseEntity.ok(courseMaterialRepository.save(material));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    @GetMapping("/courses/{courseId}/materials/{materialId}/pdf")
    @Operation(summary = "Download stored course material PDF")
    public ResponseEntity<?> downloadCourseMaterialPdf(
            @PathVariable String courseId,
            @PathVariable String materialId
    ) {
        try {
            CourseMaterial material = courseMaterialRepository.findById(materialId)
                    .orElseThrow(() -> new IllegalArgumentException("Course material not found"));

            if (material.getCourseId() == null || !material.getCourseId().equals(courseId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Course material not found in requested course"));
            }
            if (material.getPdfFileId() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "This material does not have a stored PDF"));
            }

            GridFsResource resource = pdfStorageService.loadByDocumentId(materialId);
            String fileName = material.getSourceFileName() != null
                    ? material.getSourceFileName()
                    : "course-material.pdf";

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"")
                    .body(resource);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot read PDF: " + e.getMessage()));
        }
    }

    @GetMapping(value = "/courses/{courseId}/materials/{materialId}/pages/{pageNumber}/image", produces = MediaType.IMAGE_PNG_VALUE)
    @Operation(summary = "Render one course-material PDF page as visual RAG evidence")
    public ResponseEntity<?> renderCourseMaterialPage(
            @PathVariable String courseId,
            @PathVariable String materialId,
            @PathVariable int pageNumber
    ) {
        try {
            CourseMaterial material = courseMaterialRepository.findById(materialId)
                    .orElseThrow(() -> new IllegalArgumentException("Course material not found"));
            if (!courseId.equals(material.getCourseId())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Course material not found in requested course"));
            }
            if (material.getPdfFileId() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "This material does not have a stored PDF"));
            }
            return ResponseEntity.ok()
                    .cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofHours(6)).cachePrivate())
                    .contentType(MediaType.IMAGE_PNG)
                    .body(pdfPageRenderService.renderPage(materialId, pageNumber));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Cannot render PDF page for materialId={}, page={}", materialId, pageNumber, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Cannot render PDF page"));
        }
    }

    @GetMapping("/materials")
    @Operation(summary = "List all uploaded course materials", description = "Returns all uploaded materials across every course. Optional filters: courseId, classId, teacherId, materialScope, indexingStatus, sourceType.")
    public ResponseEntity<?> listAllCourseMaterials(
            @RequestParam(value = "courseId", required = false) String courseId,
            @RequestParam(value = "classId", required = false) String classId,
            @RequestParam(value = "teacherId", required = false) String teacherId,
            @RequestParam(value = "materialScope", required = false) String materialScope,
            @RequestParam(value = "indexingStatus", required = false) String indexingStatus,
            @RequestParam(value = "sourceType", required = false) String sourceType
    ) {
        try {
            CourseMaterialListResponse response = queryService.listAllMaterials(
                    courseId,
                    classId,
                    teacherId,
                    materialScope,
                    indexingStatus,
                    sourceType
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/courses/{courseId}/materials")
    @Operation(summary = "List uploaded course materials", description = "Returns material metadata without extracted content. Supports optional filters by class, teacher, scope, indexing status, and source type.")
    public ResponseEntity<?> listCourseMaterials(
            @PathVariable String courseId,
            @RequestParam(value = "classId", required = false) String classId,
            @RequestParam(value = "teacherId", required = false) String teacherId,
            @RequestParam(value = "materialScope", required = false) String materialScope,
            @RequestParam(value = "indexingStatus", required = false) String indexingStatus,
            @RequestParam(value = "sourceType", required = false) String sourceType
    ) {
        try {
            CourseMaterialListResponse response = queryService.listMaterials(
                    courseId,
                    classId,
                    teacherId,
                    materialScope,
                    indexingStatus,
                    sourceType
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }


    @PostMapping("/courses/{courseId}/materials/reindex")
    @Operation(summary = "Reindex all course materials into Elasticsearch")
    public ResponseEntity<?> reindexCourseMaterials(
            @PathVariable String courseId,
            @RequestParam(value = "teacherId", required = false) String teacherId
    ) {
        try {
            validateScope(courseId);
            return ResponseEntity.ok(lifecycleService.reindexCourse(courseId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Elasticsearch error during course materials reindex", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Elasticsearch error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during course materials reindex", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    @PostMapping("/courses/{courseId}/materials/{materialId}/reindex")
    @Operation(summary = "Reindex one course material into Elasticsearch")
    public ResponseEntity<?> reindexCourseMaterial(
            @PathVariable String courseId,
            @PathVariable String materialId,
            @RequestParam(value = "teacherId", required = false) String teacherId
    ) {
        try {
            return ResponseEntity.ok(lifecycleService.reindexMaterial(courseId, materialId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Elasticsearch error during course material reindex", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Elasticsearch error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during course material reindex", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }

    @DeleteMapping("/courses/{courseId}/materials/{materialId}")
    @Operation(summary = "Delete one course material and its indexed chunks")
    public ResponseEntity<?> deleteCourseMaterial(
            @PathVariable String courseId,
            @PathVariable String materialId,
            @RequestParam(value = "teacherId", required = false) String teacherId
    ) {
        try {
            return ResponseEntity.ok(lifecycleService.deleteMaterial(courseId, materialId, teacherId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Elasticsearch error during course material delete", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Elasticsearch error: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error during course material delete", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Server error: " + e.getMessage()));
        }
    }
    private void validateScope(String courseId) {
        requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
    }

    private MaterialUploadScope resolveUploadScope(String uploaderRole, String classId, String teacherId) {
        String safeClassId = normalizeOptionalFormValue(optionalMaxLength(classId, "classId", SHORT_TEXT_MAX_LENGTH));
        String safeRole = normalizeOptionalFormValue(uploaderRole);
        String role = safeRole == null
                ? (safeClassId == null ? "ADMIN" : "TEACHER")
                : safeRole.toUpperCase();

        if ("ADMIN".equals(role)) {
            String uploaderId = normalizeOptionalFormValue(optionalMaxLength(teacherId, "teacherId", SHORT_TEXT_MAX_LENGTH));
            return new MaterialUploadScope(null, uploaderId == null ? "ADMIN" : uploaderId, "COURSE_SHARED", "ADMIN");
        }

        String safeTeacherId = normalizeOptionalFormValue(optionalMaxLength(teacherId, "teacherId", SHORT_TEXT_MAX_LENGTH));
        if (safeTeacherId == null) {
            throw new IllegalArgumentException("teacherId is required when a teacher uploads class material");
        }
        if (safeClassId == null) {
            throw new IllegalArgumentException("classId is required when a teacher uploads class material");
        }
        return new MaterialUploadScope(safeClassId, safeTeacherId, "CLASS_SECTION", "TEACHER");
    }

    private String normalizeOptionalFormValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if ("undefined".equalsIgnoreCase(trimmed) || "null".equalsIgnoreCase(trimmed)) {
            return null;
        }
        return trimmed;
    }

    private record MaterialUploadScope(String classId, String uploaderId, String materialScope, String uploaderRole) {}

}
