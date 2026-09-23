package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.answer.context.CourseLessonContextService;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.answer.grounding.CourseAnswerGroundingService;
import com.ragapi.service.course.answer.policy.CourseAnswerRequestPolicyService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.service.course.model.CourseContextRetrievalResult;
import com.ragapi.service.course.model.CourseGroundingAssessment;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.course.search.CourseContextRetrievalService;
import com.ragapi.util.StudentChatIntentDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.ragapi.util.ValidationUtils.STUDENT_QUESTION_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

/** Validates a request and prepares all evidence required by later answer stages. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerPreparationService {

    private final CourseContextRetrievalService contextRetrievalService;
    private final CourseAnswerRequestPolicyService requestPolicyService;
    private final CourseLessonContextService lessonContextService;
    private final CourseAnswerGroundingService groundingService;
    private final CourseAnswerEvidenceService evidenceService;

    public CourseAnswerPreparation prepare(CourseAnswerRequest request, long backendStartedNanos) {
        String safeQuestion = requireMaxLength(request.question(), "question", STUDENT_QUESTION_MAX_LENGTH);
        String safeCourseId = requireText(request.courseId(), "courseId");
        boolean guidedLessonMode = requestPolicyService.isGuidedLessonMode(request.teachingMode());
        boolean understandingRemediation = requestPolicyService.isUnderstandingRemediation(safeQuestion);
        boolean personalizedTutor = hasText(request.pedagogicalContext()) || hasText(request.learnerMemoryContext());
        boolean skipAnswerCache = request.textbookOnly()
                || personalizedTutor
                || guidedLessonMode
                || understandingRemediation
                || request.ragQueryIntent() != null
                || StudentChatIntentDetector.isDependentFollowUp(safeQuestion);

        CourseRagAnswer immediateAnswer = requestPolicyService.buildSensitiveInternalAnswer(safeQuestion);
        if (immediateAnswer == null && !guidedLessonMode) {
            immediateAnswer = requestPolicyService.buildConversationalAnswer(safeQuestion, safeCourseId);
            if (immediateAnswer == null) {
                immediateAnswer = requestPolicyService.buildOffTopicRedirect(safeQuestion, safeCourseId);
                if (immediateAnswer != null) {
                    log.info("Blocked off-topic non-academic question before RAG (courseId={}): {}",
                            safeCourseId, safeQuestion);
                }
            }
        }
        if (immediateAnswer != null) {
            return emptyPreparation(
                    request,
                    backendStartedNanos,
                    safeQuestion,
                    safeCourseId,
                    skipAnswerCache,
                    understandingRemediation,
                    immediateAnswer
            );
        }

        log.info(
                "Retrieving course learning context for question: {} (courseId: {}, currentClassId: {})",
                safeQuestion,
                safeCourseId,
                request.classId()
        );
        RagQueryIntent ragQueryIntent = request.ragQueryIntent();
        List<RetrievedCourseChunk> improvePlanChunks = lessonContextService.retrieveImprovePlanChunks(
                ragQueryIntent,
                safeCourseId,
                request.classId()
        );
        CourseContextRetrievalResult retrieval = contextRetrievalService.retrieve(
                safeQuestion,
                safeCourseId,
                request.classId(),
                request.textbookOnly(),
                request.retrievalHint(),
                ragQueryIntent,
                improvePlanChunks
        );
        List<RetrievedCourseChunk> chunks = new ArrayList<>(retrieval.chunks());
        ChapterPreviewView lessonPreview = lessonContextService.resolveLessonPreview(safeQuestion, safeCourseId);
        chunks = lessonContextService.pinLessonPreviewChunk(lessonPreview, chunks);
        logImprovePlanRetrieval(ragQueryIntent, safeCourseId, retrieval.retrievalQuestion(), improvePlanChunks, chunks);

        log.info("Retrieved {} context chunks", chunks.size());
        String context = String.join("\n", chunks.stream().map(RetrievedCourseChunk::content).toList());
        context = lessonContextService.prependDraftTeachingNote(
                context,
                request.draftChapter(),
                request.draftTeachingNote(),
                request.baselineDraftAnswer()
        );
        Map<String, CourseMaterial> materialsById = contextRetrievalService.loadMaterials(chunks);
        String groundingType = evidenceService.resolveGroundingType(chunks, materialsById);
        List<String> sourceLabels = evidenceService.buildSourceLabels(chunks, materialsById);
        CourseGroundingAssessment grounding = groundingService.assess(
                safeQuestion,
                retrieval.retrievalQuestion(),
                context,
                chunks,
                lessonContextService.hasUsableLessonPreview(lessonPreview)
        );

        return new CourseAnswerPreparation(
                request,
                backendStartedNanos,
                safeQuestion,
                safeCourseId,
                retrieval.retrievalQuestion(),
                List.copyOf(chunks),
                context,
                Map.copyOf(materialsById),
                groundingType,
                List.copyOf(sourceLabels),
                grounding.confidence(),
                grounding.grounded(),
                skipAnswerCache,
                understandingRemediation,
                null
        );
    }

    private CourseAnswerPreparation emptyPreparation(
            CourseAnswerRequest request,
            long backendStartedNanos,
            String question,
            String courseId,
            boolean skipAnswerCache,
            boolean understandingRemediation,
            CourseRagAnswer immediateAnswer
    ) {
        return new CourseAnswerPreparation(
                request,
                backendStartedNanos,
                question,
                courseId,
                question,
                List.of(),
                "",
                Map.of(),
                "NONE",
                List.of(),
                0.0,
                false,
                skipAnswerCache,
                understandingRemediation,
                immediateAnswer
        );
    }

    private void logImprovePlanRetrieval(
            RagQueryIntent intent,
            String courseId,
            String retrievalQuestion,
            List<RetrievedCourseChunk> linkedChunks,
            List<RetrievedCourseChunk> selectedChunks
    ) {
        if (intent == null) {
            return;
        }
        log.info(
                "Improve plan RAG retrieval (improvePlanId={}, planItemId={}, courseId={}, sourceMaterialCount={}, sourceChunkCount={}, retrievalQuery={}, linkedChunks={}, selectedChunks={})",
                intent.getImprovePlanId(),
                intent.getPlanItemId(),
                courseId,
                intent.getSourceMaterialIds() == null ? 0 : intent.getSourceMaterialIds().size(),
                intent.getSourceChunkIds() == null ? 0 : intent.getSourceChunkIds().size(),
                retrievalQuestion,
                linkedChunks.size(),
                selectedChunks.size()
        );
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
