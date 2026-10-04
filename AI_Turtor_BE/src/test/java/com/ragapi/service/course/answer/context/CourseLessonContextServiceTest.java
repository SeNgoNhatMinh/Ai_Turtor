package com.ragapi.service.course.answer.context;

import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.course.search.CourseSearchContextLimitService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseLessonContextServiceTest {

    @Mock CourseImprovePlanContextService improvePlanContextService;
    @Mock CourseLessonPreviewService lessonPreviewService;
    @Mock CourseDraftTeachingNoteService draftTeachingNoteService;
    @Mock CourseSearchContextLimitService contextLimitService;
    @Mock ChapterPreviewView preview;

    @Test
    void pinLessonPreviewAppliesFinalBudgetAfterPreviewIsPinned() {
        RetrievedCourseChunk retrieved = chunk("retrieved");
        RetrievedCourseChunk fullPreview = chunk("chapter preview".repeat(8_000));
        RetrievedCourseChunk trimmedPreview = chunk("chapter preview".repeat(400));
        List<RetrievedCourseChunk> ranked = List.of(retrieved);
        List<RetrievedCourseChunk> pinned = List.of(fullPreview, retrieved);
        List<RetrievedCourseChunk> budgeted = List.of(trimmedPreview);
        when(lessonPreviewService.pin(preview, ranked)).thenReturn(pinned);
        when(contextLimitService.applyBudget(pinned)).thenReturn(budgeted);
        CourseLessonContextService service = new CourseLessonContextService(
                improvePlanContextService,
                lessonPreviewService,
                draftTeachingNoteService,
                contextLimitService
        );

        List<RetrievedCourseChunk> result = service.pinLessonPreviewChunk(preview, ranked);

        assertThat(result).isSameAs(budgeted);
        InOrder order = inOrder(lessonPreviewService, contextLimitService);
        order.verify(lessonPreviewService).pin(preview, ranked);
        order.verify(contextLimitService).applyBudget(pinned);
    }

    private RetrievedCourseChunk chunk(String content) {
        return new RetrievedCourseChunk(
                content, 0.9, "material-1", "PRJ301", "PRJ301-01", "teacher-1", "COURSE_SHARED");
    }
}
