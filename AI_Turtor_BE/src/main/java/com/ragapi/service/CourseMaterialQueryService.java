package com.ragapi.service;

import com.ragapi.dto.CourseMaterialListResponse;
import com.ragapi.dto.CourseMaterialSummary;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.optionalMaxLength;
import static com.ragapi.util.ValidationUtils.requireMaxLength;

@Service
@RequiredArgsConstructor
public class CourseMaterialQueryService {

    private final CourseMaterialRepository courseMaterialRepository;

    public CourseMaterialListResponse listMaterials(
            String courseId,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType
    ) {
        String safeCourseId = requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
        return buildListResponse(
                courseMaterialRepository.findByCourseId(safeCourseId),
                safeCourseId,
                classId,
                teacherId,
                materialScope,
                indexingStatus,
                sourceType
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
        return buildListResponse(
                courseMaterialRepository.findAll(),
                normalizeOptionalFilter(courseId, "courseId"),
                classId,
                teacherId,
                materialScope,
                indexingStatus,
                sourceType
        );
    }

    private CourseMaterialListResponse buildListResponse(
            List<CourseMaterial> source,
            String courseIdFilter,
            String classId,
            String teacherId,
            String materialScope,
            String indexingStatus,
            String sourceType
    ) {
        String safeClassId = normalizeOptionalFilter(classId, "classId");
        String safeTeacherId = normalizeOptionalFilter(teacherId, "teacherId");
        String safeMaterialScope = normalizeOptionalFilter(materialScope, "materialScope");
        String safeIndexingStatus = normalizeOptionalFilter(indexingStatus, "indexingStatus");
        String safeSourceType = normalizeOptionalFilter(sourceType, "sourceType");

        List<CourseMaterialSummary> materials = source.stream()
                .filter(material -> matchesOptionalEquals(material.getCourseId(), courseIdFilter))
                .filter(material -> matchesClassScope(material, safeClassId))
                .filter(material -> matchesOptionalEquals(material.getTeacherId(), safeTeacherId))
                .filter(material -> matchesOptionalEquals(material.getMaterialScope(), safeMaterialScope))
                .filter(material -> matchesOptionalEquals(material.getIndexingStatus(), safeIndexingStatus))
                .filter(material -> matchesOptionalEquals(material.getSourceType(), safeSourceType))
                .sorted(materialComparator())
                .map(this::toSummary)
                .toList();

        return CourseMaterialListResponse.builder()
                .courseId(courseIdFilter == null ? "" : courseIdFilter)
                .classId(safeClassId == null ? "" : safeClassId)
                .teacherId(safeTeacherId == null ? "" : safeTeacherId)
                .materialScope(safeMaterialScope == null ? "" : safeMaterialScope)
                .indexingStatus(safeIndexingStatus == null ? "" : safeIndexingStatus)
                .sourceType(safeSourceType == null ? "" : safeSourceType)
                .count(materials.size())
                .materials(materials)
                .build();
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
