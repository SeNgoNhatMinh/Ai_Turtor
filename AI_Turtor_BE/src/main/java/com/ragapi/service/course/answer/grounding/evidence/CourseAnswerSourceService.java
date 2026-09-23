package com.ragapi.service.course.answer.grounding.evidence;

import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.MaterialTocEntry;
import com.ragapi.repository.CourseRepository;
import com.ragapi.service.PdfEvidenceLocatorService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextSanitizer;
import com.ragapi.util.TextbookChunkAlignment;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CourseAnswerSourceService {

    private final CourseRepository courseRepository;
    private final PdfEvidenceLocatorService pdfEvidenceLocatorService;
    private final CourseAnswerEvidenceSelector evidenceSelector;

    public List<String> buildSourceLabels(
            List<RetrievedCourseChunk> chunks,
            Map<String, CourseMaterial> materialsById
    ) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        List<String> sources = new ArrayList<>();
        Set<String> seenMaterials = new LinkedHashSet<>();
        for (RetrievedCourseChunk chunk : chunks) {
            CourseMaterial material = chunk.materialId() == null
                    ? null
                    : materialsById.get(chunk.materialId());
            String identity = materialIdentity(material, chunk.materialId());
            if (!seenMaterials.add(identity + "|" + normalizedEvidenceText(chunk.content()))) {
                continue;
            }
            String label;
            if (isGoldQaTeachingNote(chunk, material)) {
                label = "teachingNoteId=" + (chunk.materialId() == null ? "unknown" : chunk.materialId());
            } else if (isApprovedKnowledge(material)) {
                label = "approvedKnowledgeId=" + (material.getKnowledgeCandidateId() == null
                        ? chunk.materialId()
                        : material.getKnowledgeCandidateId());
            } else {
                label = "materialId=" + (chunk.materialId() == null ? "unknown" : chunk.materialId());
            }
            if (!sources.contains(label)) {
                sources.add(label);
            }
        }
        return sources;
    }

    public String resolveGroundingType(
            List<RetrievedCourseChunk> chunks,
            Map<String, CourseMaterial> materialsById
    ) {
        boolean hasApproved = false;
        boolean hasCourseMaterial = false;
        boolean hasTeachingNote = false;
        for (RetrievedCourseChunk chunk : chunks) {
            CourseMaterial material = chunk.materialId() == null
                    ? null
                    : materialsById.get(chunk.materialId());
            if (isGoldQaTeachingNote(chunk, material)) {
                hasTeachingNote = true;
            } else if (isApprovedKnowledge(material)) {
                hasApproved = true;
            } else {
                hasCourseMaterial = true;
            }
        }
        if (hasApproved && hasCourseMaterial) {
            return "COURSE_MATERIAL_WITH_APPROVED_KNOWLEDGE";
        }
        if (hasApproved) {
            return "SENIOR_APPROVED_KNOWLEDGE";
        }
        if (hasTeachingNote && hasCourseMaterial) {
            return "COURSE_MATERIAL_WITH_TEACHING_NOTE";
        }
        if (hasTeachingNote) {
            return "GOLD_QA_TEACHING_NOTE";
        }
        return "COURSE_MATERIAL";
    }

    public List<RagSourceEvidence> buildSourceEvidence(
            List<RetrievedCourseChunk> chunks,
            String courseId,
            Map<String, CourseMaterial> materialsById,
            String answerFocus
    ) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        String courseName = courseRepository.findByCourseId(courseId)
                .map(course -> course.getCourseName())
                .orElse(courseId);
        Map<String, RagSourceEvidence> result = new java.util.LinkedHashMap<>();
        for (RetrievedCourseChunk chunk : chunks) {
            if (chunk.materialId() == null || TextbookChunkAlignment.isLikelyNavigationChunk(chunk)) {
                continue;
            }
            CourseMaterial material = materialsById.get(chunk.materialId());
            String evidenceExcerpt = evidenceSelector.focusedExcerpt(chunk.content(), answerFocus);
            if (!isUsefulEvidenceExcerpt(evidenceExcerpt)
                    || !isExcerptVerified(material, chunk.content())) {
                continue;
            }
            boolean approvedKnowledge = isApprovedKnowledge(material);
            boolean teachingNote = isGoldQaTeachingNote(chunk, material);
            PdfEvidenceLocatorService.PageLocation exactLocation = approvedKnowledge || teachingNote
                    ? null
                    : pdfEvidenceLocatorService.locate(material, evidenceExcerpt);
            int page = exactLocation == null ? -1 : exactLocation.pageStart();
            MaterialTocEntry toc = findToc(material, page);
            String hierarchyTitle = firstNonBlank(
                    chunk.sectionTitle(),
                    toc == null ? chunk.chapterTitle() : toc.getTitle()
            );
            RagSourceEvidence candidate = RagSourceEvidence.builder()
                    .courseId(courseId)
                    .courseName(courseName)
                    .materialId(chunk.materialId())
                    .chunkId(chunk.chunkId())
                    .materialTitle(teachingNote
                            ? "Ghi chú giảng dạy (Gold Q&A)"
                            : (material == null ? chunk.materialId() : material.getTitle()))
                    .chapter(hierarchyTitle != null ? hierarchyTitle : (toc == null ? null : toc.getTitle()))
                    .pageStart(page > 0 ? page : null)
                    .pageEnd(exactLocation == null ? null : exactLocation.pageEnd())
                    .pageEstimated(exactLocation == null
                            && material != null
                            && "PDF".equalsIgnoreCase(material.getSourceType()))
                    .excerpt(evidenceExcerpt)
                    .excerptVerified(true)
                    .visualEvidence(List.of())
                    .sourceKind(teachingNote
                            ? "GOLD_QA_TEACHING_NOTE"
                            : (approvedKnowledge ? "SENIOR_APPROVED_KNOWLEDGE" : "COURSE_MATERIAL"))
                    .knowledgeCandidateId(approvedKnowledge ? material.getKnowledgeCandidateId() : null)
                    .provenanceLabel(teachingNote
                            ? "Ghi chú giảng dạy"
                            : (approvedKnowledge ? "Kiến thức bổ sung" : null))
                    .reviewerName(approvedKnowledge ? material.getApprovedByName() : null)
                    .build();
            result.putIfAbsent(evidenceIdentity(candidate, material), candidate);
            if (result.size() >= 6) {
                break;
            }
        }
        return new ArrayList<>(result.values());
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first.trim();
        }
        if (second != null && !second.isBlank()) {
            return second.trim();
        }
        return null;
    }

    private boolean isUsefulEvidenceExcerpt(String value) {
        String clean = TextSanitizer.clean(value);
        if (clean == null || clean.length() < 50) {
            return false;
        }
        return Pattern.compile("(?U)\\b\\p{L}[\\p{L}\\p{N}_-]+\\b")
                .matcher(clean)
                .results()
                .limit(8)
                .count() >= 8;
    }

    private boolean isExcerptVerified(CourseMaterial material, String chunkContent) {
        if (material == null || material.getContent() == null || chunkContent == null) {
            return false;
        }
        if (material.getContent().contains(chunkContent)) {
            return true;
        }
        String materialText = TextSanitizer.clean(material.getContent());
        String chunkText = TextSanitizer.clean(chunkContent);
        if (materialText == null || chunkText == null || chunkText.isBlank()) {
            return false;
        }
        return materialText.replaceAll("\\s+", " ")
                .contains(chunkText.replaceAll("\\s+", " "));
    }

    private String evidenceIdentity(RagSourceEvidence evidence, CourseMaterial material) {
        String text = normalizedEvidenceText(evidence.getExcerpt());
        if (!text.isBlank()) {
            return evidence.getCourseId() + "|text:" + text;
        }
        return evidence.getCourseId() + '|' + materialIdentity(material, evidence.getMaterialId())
                + "|page:" + evidence.getPageStart();
    }

    private MaterialTocEntry findToc(CourseMaterial material, int page) {
        if (material == null || page < 1 || material.getTableOfContents() == null) {
            return null;
        }
        return material.getTableOfContents().stream()
                .filter(item -> item.getPageStart() <= page
                        && (item.getPageEnd() == null || item.getPageEnd() >= page))
                .max(java.util.Comparator.comparingInt(MaterialTocEntry::getPageStart)
                        .thenComparingInt(MaterialTocEntry::getLevel))
                .orElse(null);
    }

    private String materialIdentity(CourseMaterial material, String fallbackId) {
        if (material == null) {
            return "id:" + String.valueOf(fallbackId);
        }
        String contentFingerprint = materialContentFingerprint(material);
        if (contentFingerprint != null) {
            return contentFingerprint;
        }
        if (material.getContentHash() != null && !material.getContentHash().isBlank()) {
            return "hash:" + material.getContentHash().trim().toLowerCase(Locale.ROOT);
        }
        String fileName = material.getSourceFileName() == null
                ? ""
                : material.getSourceFileName().trim().toLowerCase(Locale.ROOT);
        if (!fileName.isBlank() && material.getPdfFileSize() != null) {
            return "file:" + fileName + ":" + material.getPdfFileSize();
        }
        return "id:" + String.valueOf(fallbackId);
    }

    private String materialContentFingerprint(CourseMaterial material) {
        String content = material.getContent();
        if (content == null || content.isBlank()) {
            return null;
        }
        String clean = TextSanitizer.clean(content);
        if (clean == null || clean.isBlank()) {
            return null;
        }
        int sampleSize = Math.min(4000, clean.length());
        String sample = clean.substring(0, sampleSize)
                + clean.substring(Math.max(sampleSize, clean.length() - sampleSize));
        sample = sample.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        return "content:" + clean.length() + ":" + Integer.toHexString(sample.hashCode());
    }

    private String normalizedEvidenceText(String value) {
        String clean = TextSanitizer.clean(value);
        if (clean == null) {
            return "";
        }
        clean = clean.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        return clean.length() <= 320 ? clean : clean.substring(0, 320);
    }

    private boolean isApprovedKnowledge(CourseMaterial material) {
        return material != null
                && ("KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType())
                || "senior-approved-knowledge".equalsIgnoreCase(material.getCategory()));
    }

    private boolean isGoldQaTeachingNote(
            RetrievedCourseChunk chunk,
            CourseMaterial material
    ) {
        return (chunk != null && "GOLD_QA".equalsIgnoreCase(chunk.sourceType()))
                || (material != null && "GOLD_QA".equalsIgnoreCase(material.getSourceType()));
    }
}
