package com.ragapi.service.course.answer;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.service.course.answer.generation.CourseAnswerGenerationService;
import com.ragapi.service.course.answer.orchestration.CourseAnswerPipelineService;
import com.ragapi.service.course.gateway.CourseAnswerGateway;
import com.ragapi.service.course.model.CourseAnswerRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
@RequiredArgsConstructor
public class CourseAnswerService implements CourseAnswerGateway {

    public static final String DEFAULT_LEARNING_DETAIL = "learning-detailed";

    private final CourseAnswerGenerationService generationService;
    private final CourseAnswerPipelineService pipelineService;

    public String ask(String question) throws IOException {
        return ask(question, null, null);
    }

    /**
     * Kept only for backward compatibility. The AI Tutor now always answers with
     * a detailed learning-oriented style.
     */
    public String ask(String question, String ignoredDetailLevel) throws IOException {
        return ask(question, null, null);
    }

    public String ask(String question, String courseId, String classId) throws IOException {
        return askWithConfidence(question, courseId, classId).getAnswer();
    }

    /**
     * Kept only for backward compatibility. ignoredDetailLevel is intentionally ignored.
     */
    public String ask(String question, String ignoredDetailLevel, String courseId, String classId) throws IOException {
        return askWithConfidence(question, courseId, classId).getAnswer();
    }

    public CourseRagAnswer askWithConfidence(String question, String courseId, String classId) throws IOException {
        return askWithConfidence(question, courseId, classId, null);
    }

    public CourseRagAnswer askWithConfidence(
            String question, String courseId, String classId, String teachingMode) throws IOException {
        return askWithConfidence(question, courseId, classId, teachingMode, null);
    }

    public CourseRagAnswer askWithConfidence(
            String question, String courseId, String classId, String teachingMode, String retrievalHint)
            throws IOException {
        return pipelineService.answer(CourseAnswerRequest.builder()
                .question(question)
                .courseId(courseId)
                .classId(classId)
                .teachingMode(teachingMode)
                .retrievalHint(retrievalHint)
                .build());
    }

    public CourseRagAnswer answerTutorInteraction(
            String question,
            String courseId,
            String interactionType,
            String pedagogicalContext,
            String learnerContext,
            String recentHistoryContext
    ) {
        return generationService.generateTutorInteraction(
                question,
                courseId,
                interactionType,
                pedagogicalContext,
                learnerContext,
                recentHistoryContext
        );
    }

    public CourseRagAnswer askWithPersonalizedTutorContext(
            String question,
            String courseId,
            String classId,
            String pedagogicalContext,
            String learnerMemoryContext
    ) throws IOException {
        return askWithPersonalizedTutorContext(
                question, courseId, classId, pedagogicalContext, learnerMemoryContext, null);
    }

    public CourseRagAnswer askWithPersonalizedTutorContext(
            String question,
            String courseId,
            String classId,
            String pedagogicalContext,
            String learnerMemoryContext,
            String teachingMode
    ) throws IOException {
        return askWithPersonalizedTutorContext(
                question, courseId, classId, pedagogicalContext, learnerMemoryContext, teachingMode, null);
    }

    public CourseRagAnswer askWithPersonalizedTutorContext(
            String question,
            String courseId,
            String classId,
            String pedagogicalContext,
            String learnerMemoryContext,
            String teachingMode,
            String retrievalHint
    ) throws IOException {
        return pipelineService.answer(CourseAnswerRequest.builder()
                .question(question)
                .courseId(courseId)
                .classId(classId)
                .pedagogicalContext(pedagogicalContext)
                .learnerMemoryContext(learnerMemoryContext)
                .teachingMode(teachingMode)
                .retrievalHint(retrievalHint)
                .build());
    }

    public CourseRagAnswer askWithImprovePlanContext(
            String question,
            String courseId,
            String classId,
            String pedagogicalContext,
            String learnerMemoryContext,
            RagQueryIntent ragQueryIntent
    ) throws IOException {
        String teachingMode = ragQueryIntent == null || ragQueryIntent.getTeachingMode() == null
                ? "EXPLAIN_CONCEPT"
                : ragQueryIntent.getTeachingMode();
        String retrievalHint = ragQueryIntent == null ? null : ragQueryIntent.getRetrievalQuery();
        return pipelineService.answer(CourseAnswerRequest.builder()
                .question(question)
                .courseId(courseId)
                .classId(classId)
                .pedagogicalContext(pedagogicalContext)
                .learnerMemoryContext(learnerMemoryContext)
                .teachingMode(teachingMode)
                .retrievalHint(retrievalHint)
                .ragQueryIntent(ragQueryIntent)
                .build());
    }

    public CourseRagAnswer askWithConfidenceFromTextbook(
            String question,
            String courseId,
            String classId
    ) throws IOException {
        return pipelineService.answer(CourseAnswerRequest.builder()
                .question(question)
                .courseId(courseId)
                .classId(classId)
                .textbookOnly(true)
                .build());
    }

    /**
     * Teacher exam / "Thi lại": textbook retrieval plus a draft teaching note so the answer
     * previews what students would get after Senior indexes TRAINING — without writing to RAG/cache.
     */
    public CourseRagAnswer askWithConfidencePreviewingTrainingNote(
            String question,
            String courseId,
            String classId,
            String chapter,
            String teachingNote
    ) throws IOException {
        return pipelineService.answer(CourseAnswerRequest.builder()
                .question(question)
                .courseId(courseId)
                .classId(classId)
                .textbookOnly(true)
                .draftChapter(chapter)
                .draftTeachingNote(teachingNote)
                .build());
    }

    /**
     * Teacher retake: merge baseline draft + teacher checklist + textbook into one fuller answer.
     */
    public CourseRagAnswer askWithConfidenceSynthesizingExam(
            String question,
            String courseId,
            String classId,
            String chapter,
            String teachingNote,
            String baselineAnswer
    ) throws IOException {
        return pipelineService.answer(CourseAnswerRequest.builder()
                .question(question)
                .courseId(courseId)
                .classId(classId)
                .textbookOnly(true)
                .draftChapter(chapter)
                .draftTeachingNote(teachingNote)
                .baselineDraftAnswer(baselineAnswer)
                .build());
    }

}
