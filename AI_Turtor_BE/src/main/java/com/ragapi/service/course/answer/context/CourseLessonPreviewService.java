package com.ragapi.service.course.answer.context;

import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.dto.cotraining.ChapterSourceMaterialView;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.ChapterOutlineService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Resolves a named lesson preview and pins it ahead of ranked search results. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseLessonPreviewService {

    private static final Pattern NUMBERED_LESSON_TITLE = Pattern.compile(
            "(?iu)(?:bắt đầu\\s+|bat dau\\s+|đào sâu\\s+|dao sau\\s+)?(?:bài|bai)\\s+\\d+\\s*[:：.\\-–—]\\s*(.+)"
    );

    private final CourseMaterialStoreGateway materialRepository;
    private final ChapterOutlineService chapterOutlineService;

    public ChapterPreviewView resolve(String question, String courseId) {
        String lessonTitle = extractLessonTitle(question);
        if (lessonTitle == null || lessonTitle.isBlank()) {
            return null;
        }
        try {
            ChapterPreviewView preview = chapterOutlineService.previewChapterByTitle(courseId, lessonTitle, true);
            if (isUsable(preview)) {
                log.info(
                        "Pinned chapter preview context for lesson title '{}' (courseId={}, chapterKey={}, chars={})",
                        lessonTitle,
                        courseId,
                        preview.getChapterKey(),
                        preview.getExcerpt() == null ? 0 : preview.getExcerpt().length()
                );
                return preview;
            }
        } catch (Exception exception) {
            log.debug("Could not resolve chapter preview for lesson '{}': {}", lessonTitle, exception.getMessage());
        }
        return null;
    }

    public boolean isUsable(ChapterPreviewView preview) {
        return preview != null
                && preview.isHasMaterialContent()
                && preview.getExcerpt() != null
                && !preview.getExcerpt().isBlank();
    }

    public List<RetrievedCourseChunk> pin(
            ChapterPreviewView preview,
            List<RetrievedCourseChunk> ranked
    ) {
        if (!isUsable(preview)) {
            return ranked == null ? List.of() : ranked;
        }
        String materialId = resolvePreviewMaterialId(preview);
        if (materialId == null || materialId.isBlank()) {
            return ranked == null ? List.of() : ranked;
        }
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null || material.getCourseId() == null
                || !material.getCourseId().equalsIgnoreCase(preview.getCourseId())) {
            return ranked == null ? List.of() : ranked;
        }
        RetrievedCourseChunk previewChunk = new RetrievedCourseChunk(
                "Chapter: " + preview.getTitle() + "\n" + preview.getExcerpt(),
                0.99,
                material.getId(),
                material.getCourseId(),
                material.getClassId(),
                material.getTeacherId(),
                material.getMaterialScope(),
                material.getSourceType(),
                material.getId(),
                preview.getChapterKey(),
                preview.getTitle(),
                preview.getChapterKey(),
                preview.getTitle(),
                preview.getChapterKey(),
                0,
                "SECTION"
        );

        LinkedHashMap<String, RetrievedCourseChunk> merged = new LinkedHashMap<>();
        merged.put(chunkIdentity(previewChunk), previewChunk);
        if (ranked != null) {
            for (RetrievedCourseChunk chunk : ranked) {
                merged.putIfAbsent(chunkIdentity(chunk), chunk);
            }
        }
        return new ArrayList<>(merged.values());
    }

    private String extractLessonTitle(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        Matcher matcher = NUMBERED_LESSON_TITLE.matcher(question.trim());
        if (!matcher.find()) {
            return null;
        }
        String title = matcher.group(1);
        if (title == null) {
            return null;
        }
        return title
                .replaceAll("[*_`]+", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String resolvePreviewMaterialId(ChapterPreviewView preview) {
        if (preview.getPrimarySourceMaterialId() != null && !preview.getPrimarySourceMaterialId().isBlank()) {
            return preview.getPrimarySourceMaterialId().trim();
        }
        List<ChapterSourceMaterialView> sources = preview.getSourceMaterials();
        if (sources == null || sources.isEmpty()) {
            return null;
        }
        return sources.stream()
                .filter(Objects::nonNull)
                .map(ChapterSourceMaterialView::getId)
                .filter(id -> id != null && !id.isBlank())
                .findFirst()
                .orElse(null);
    }

    private String chunkIdentity(RetrievedCourseChunk chunk) {
        return String.join(
                "|",
                Objects.toString(chunk.sourceType(), ""),
                Objects.toString(chunk.materialId(), ""),
                Objects.toString(chunk.content(), "").strip().replaceAll("\\s+", " ")
        );
    }
}
