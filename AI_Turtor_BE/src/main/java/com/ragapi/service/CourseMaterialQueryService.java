package com.ragapi.service;

import com.ragapi.dto.CourseMaterialListResponse;
import com.ragapi.dto.CourseMaterialSummary;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseMaterialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.TextSanitizer.normalizeAccentInsensitive;

@Service
@RequiredArgsConstructor
public class CourseMaterialQueryService {

    private final CourseMaterialRepository courseMaterialRepository;
    private final ClassSectionRepository classSectionRepository;

    public CourseMaterialListResponse listMaterials(
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType
    ) {
        return listMaterials(courseId, classId, teacherId, materialScope, indexingStatus, sourceType, null, null, null);
    }

    public CourseMaterialListResponse listMaterials(
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType,
            Integer page,
            Integer size,
            String query
    ) {
        String safeCourseId = requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
        return buildListResponse(
                courseMaterialRepository.findByCourseId(safeCourseId),
                safeCourseId,
                classId,
                teacherId,
                materialScope,
                indexingStatus,
                sourceType,
                page,
                size,
                query
        );
    }

    public CourseMaterialListResponse listAllMaterials(
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType
    ) {
        return listAllMaterials(courseId, classId, teacherId, materialScope, indexingStatus, sourceType, null, null, null);
    }

    public CourseMaterialListResponse listAllMaterials(
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType,
            Integer page,
            Integer size,
            String query
    ) {
        return buildListResponse(
                courseMaterialRepository.findAll(),
                normalizeOptionalFilter(courseId, "courseId"),
                classId,
                teacherId,
                materialScope,
                indexingStatus,
                sourceType,
                page,
                size,
                query
        );
    }

    public CourseMaterialListResponse listStudentClassMaterials(String courseId, String classId) {
        return listStudentClassMaterials(courseId, classId, null, null, null);
    }

    public CourseMaterialListResponse listStudentClassMaterials(
            String courseId,
            String classId,
            Integer page,
            Integer size,
            String query
    ) {
        String safeCourseId = requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
        String safeClassId = requireMaxLength(classId, "classId", SHORT_TEXT_MAX_LENGTH);
        String classTeacherId = resolveClassTeacherId(safeCourseId, safeClassId);
        List<CourseMaterial> teacherMaterials = courseMaterialRepository.findByCourseId(safeCourseId).stream()
                .filter(material -> matchesOptionalEquals(material.getClassId(), safeClassId))
                .filter(material -> matchesOptionalEquals(material.getTeacherId(), classTeacherId))
                .filter(material -> matchesOptionalEquals(material.getMaterialScope(), "CLASS_SECTION"))
                .filter(material -> matchesOptionalEquals(material.getUploadedByRole(), "TEACHER"))
                .toList();

        return buildListResponse(
                teacherMaterials,
                safeCourseId,
                safeClassId,
                classTeacherId,
                "CLASS_SECTION",
                null,
                null,
                page,
                size,
                query
        );
    }

    public CourseMaterial requireStudentClassMaterial(String courseId, String classId, String materialId) {
        String safeCourseId = requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
        String safeClassId = requireMaxLength(classId, "classId", SHORT_TEXT_MAX_LENGTH);
        String safeMaterialId = requireMaxLength(materialId, "materialId", SHORT_TEXT_MAX_LENGTH);
        String classTeacherId = resolveClassTeacherId(safeCourseId, safeClassId);

        return courseMaterialRepository.findById(safeMaterialId)
                .filter(material -> matchesOptionalEquals(material.getCourseId(), safeCourseId))
                .filter(material -> matchesOptionalEquals(material.getClassId(), safeClassId))
                .filter(material -> matchesOptionalEquals(material.getTeacherId(), classTeacherId))
                .filter(material -> matchesOptionalEquals(material.getMaterialScope(), "CLASS_SECTION"))
                .filter(material -> matchesOptionalEquals(material.getUploadedByRole(), "TEACHER"))
                .orElseThrow(() -> new SecurityException("Material is not available to this class"));
    }

    private CourseMaterialListResponse buildListResponse(
            List<CourseMaterial> source,
            String courseIdFilter,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType,
            Integer requestedPage,
            Integer requestedSize,
            String query
    ) {
        String safeClassId = normalizeOptionalFilter(classId, "classId");
        String safeTeacherId = normalizeOptionalFilter(teacherId, "teacherId");
        String safeMaterialScope = normalizeOptionalFilter(materialScope, "materialScope");
        String safeIndexingStatus = normalizeOptionalFilter(indexingStatus, "indexingStatus");
        String safeSourceType = normalizeOptionalFilter(sourceType, "sourceType");

        String safeQuery = normalizeAccentInsensitive(optionalMaxLength(query, "query", SHORT_TEXT_MAX_LENGTH));
        List<CourseMaterialSummary> filteredMaterials = source.stream()
                .filter(material -> matchesOptionalEquals(material.getCourseId(), courseIdFilter))
                .filter(material -> matchesClassScope(material, safeClassId))
                .filter(material -> matchesOptionalEquals(material.getTeacherId(), safeTeacherId))
                .filter(material -> matchesOptionalEquals(material.getMaterialScope(), safeMaterialScope))
                .filter(material -> matchesOptionalEquals(material.getIndexingStatus(), safeIndexingStatus))
                .filter(material -> matchesOptionalEquals(material.getSourceType(), safeSourceType))
                .filter(material -> matchesQuery(material, safeQuery))
                .sorted(materialComparator())
                .map(this::toSummary)
                .toList();

        boolean paged = requestedPage != null || requestedSize != null || !safeQuery.isBlank();
        int pageSize = paged
                ? Math.max(1, Math.min(requestedSize == null ? 20 : requestedSize, 100))
                : Math.max(filteredMaterials.size(), 1);
        int totalPages = Math.max(1, (int) Math.ceil((double) filteredMaterials.size() / pageSize));
        int page = Math.max(0, Math.min(requestedPage == null ? 0 : requestedPage, totalPages - 1));
        int fromIndex = Math.min(page * pageSize, filteredMaterials.size());
        int toIndex = Math.min(fromIndex + pageSize, filteredMaterials.size());
        List<CourseMaterialSummary> materials = filteredMaterials.subList(fromIndex, toIndex);

        return CourseMaterialListResponse.builder()
                .courseId(courseIdFilter == null ? "" : courseIdFilter)
                .classId(safeClassId == null ? "" : safeClassId)
                .teacherId(safeTeacherId == null ? "" : safeTeacherId)
                .materialScope(safeMaterialScope == null ? "" : safeMaterialScope)
                .indexingStatus(safeIndexingStatus == null ? "" : safeIndexingStatus)
                .sourceType(safeSourceType == null ? "" : safeSourceType)
                .count(filteredMaterials.size())
                .page(page)
                .size(pageSize)
                .totalElements((long) filteredMaterials.size())
                .totalPages(totalPages)
                .materials(materials)
                .build();
    }

    private boolean matchesQuery(CourseMaterial material, String query) {
        if (query == null || query.isBlank()) return true;
        return Stream.of(
                        material.getTitle(),
                        material.getSourceFileName(),
                        material.getSourceUrl(),
                        material.getSourceDomain(),
                        material.getIndexingStatus()
                )
                .filter(value -> value != null && !value.isBlank())
                .anyMatch(value -> normalizeAccentInsensitive(value).contains(query));
    }

    private CourseMaterialSummary toSummary(CourseMaterial material) {
        return CourseMaterialSummary.builder()
                .id(material.getId())
                .title(material.getTitle())
                .category(material.getCategory())
                .courseId(material.getCourseId())
                .classId(material.getClassId())
                .teacherId(material.getTeacherId())
                .materialScope(material.getMaterialScope())
                .uploadedByRole(material.getUploadedByRole())
                .sourceFileName(material.getSourceFileName())
                .sourceType(material.getSourceType())
                .sourceUrl(material.getSourceUrl())
                .sourceDomain(material.getSourceDomain())
                .sourceSection(material.getSourceSection())
                .importedPageCount(material.getImportedPageCount())
                .pdfFileId(material.getPdfFileId())
                .pdfFileSize(material.getPdfFileSize())
                .hasPdf(material.getPdfFileId() != null && !material.getPdfFileId().isBlank())
                .indexingStatus(material.getIndexingStatus())
                .indexedAt(material.getIndexedAt())
                .indexingError(material.getIndexingError())
                .pageCount(material.getPageCount())
                .tocItemCount(material.getTableOfContents() == null ? 0 : material.getTableOfContents().size())
                .build();
    }

    private Comparator<CourseMaterial> materialComparator() {
        return Comparator
                .comparing(CourseMaterial::getIndexedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(material -> material.getTitle() == null ? "" : material.getTitle(), String.CASE_INSENSITIVE_ORDER);
    }

    private String resolveClassTeacherId(String courseId, String classId) {
        return classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                .map(section -> requireMaxLength(section.getTeacherId(), "teacherId", SHORT_TEXT_MAX_LENGTH))
                .orElseThrow(() -> new IllegalArgumentException("Class section not found"));
    }

    private boolean matchesClassScope(CourseMaterial material, String classId) {
        if (classId == null || classId.isBlank()) {
            return true;
        }
        String materialClassId = material.getClassId();
        return materialClassId == null
                || materialClassId.isBlank()
                || classId.equalsIgnoreCase(materialClassId);
    }

    private boolean matchesOptionalEquals(String actual, String expected) {
        if (expected == null || expected.isBlank()) {
            return true;
        }
        return actual != null && expected.equalsIgnoreCase(actual.trim());
    }

    private String normalizeOptionalFilter(String value, String fieldName) {
        String normalized = optionalMaxLength(value, fieldName, SHORT_TEXT_MAX_LENGTH);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        return normalized.trim();
    }
}
