package com.ragapi.harness.answer.context;

import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.retrieval.CourseSearchContextLimitService;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseLessonContextServiceTest {

    @Mock CourseMaterialStoreGateway materialRepository;
    @Mock CourseSearchContextLimitService contextLimitService;

    @Test
    void pinLessonPreviewAppliesFinalBudgetAfterPreviewIsPinned() {
        ChapterPreviewView preview = ChapterPreviewView.builder()
                .courseId("PRJ301")
                .chapterKey("chapter-1")
                .title("Chapter")
                .hasMaterialContent(true)
                .excerpt("chapter preview")
                .primarySourceMaterialId("material-1")
                .build();
        CourseMaterial material = new CourseMaterial();
        material.setId("material-1");
        material.setCourseId("PRJ301");
        when(materialRepository.findMetadataById("material-1")).thenReturn(Optional.of(material));
        RetrievedCourseChunk retrieved = chunk("retrieved");
        RetrievedCourseChunk trimmed = chunk("trimmed");
        when(contextLimitService.applyBudget(anyList())).thenReturn(List.of(trimmed));
        CourseLessonContextService service = new CourseLessonContextService(
                materialRepository, null, null, contextLimitService);

        List<RetrievedCourseChunk> result = service.pinLessonPreviewChunk(preview, List.of(retrieved));

        assertThat(result).containsExactly(trimmed);
        verify(contextLimitService).applyBudget(org.mockito.ArgumentMatchers.argThat(pinned ->
                pinned.size() == 2 && pinned.get(0).content().contains("chapter preview")));
    }

    private RetrievedCourseChunk chunk(String content) {
        return new RetrievedCourseChunk(
                content, 0.9, "material-1", "PRJ301", "PRJ301-01", "teacher-1", "COURSE_SHARED");
    }
}
