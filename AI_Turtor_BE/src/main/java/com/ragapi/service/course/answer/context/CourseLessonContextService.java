package com.ragapi.service.course.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** Stable facade for lesson-specific context used by the answer pipeline. */
@Service
@RequiredArgsConstructor
public class CourseLessonContextService {

    private final CourseImprovePlanContextService improvePlanContextService;
    private final CourseLessonPreviewService lessonPreviewService;
    private final CourseDraftTeachingNoteService draftTeachingNoteService;

    public List<RetrievedCourseChunk> retrieveImprovePlanChunks(
            RagQueryIntent ragQueryIntent,
            String courseId,
            String classId
    ) {
        return improvePlanContextService.retrieve(ragQueryIntent, courseId, classId);
    }

    public ChapterPreviewView resolveLessonPreview(String question, String courseId) {
        return lessonPreviewService.resolve(question, courseId);
    }

    public boolean hasUsableLessonPreview(ChapterPreviewView preview) {
        return lessonPreviewService.isUsable(preview);
    }

    public List<RetrievedCourseChunk> pinLessonPreviewChunk(
            ChapterPreviewView preview,
            List<RetrievedCourseChunk> ranked
    ) {
        return lessonPreviewService.pin(preview, ranked);
    }

    public String prependDraftTeachingNote(
            String context,
            String chapter,
            String teachingNote,
            String baselineDraftAnswer
    ) {
        return draftTeachingNoteService.prepend(context, chapter, teachingNote, baselineDraftAnswer);
    }
}
