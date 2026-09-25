package com.ragapi.service.course.answer.orchestration;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.service.CanonicalTutorAnswerCacheService;
import com.ragapi.service.course.answer.generation.CourseAnswerGenerationService;
import com.ragapi.service.course.answer.generation.CourseAnswerPromptService;
import com.ragapi.service.course.answer.grounding.CourseAnswerEvidenceService;
import com.ragapi.service.course.model.CourseAnswerRequest;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.GroundedContentGuard;
import com.ragapi.util.LessonExplanationCompleter;
import com.ragapi.util.LessonUnderstandingCheckCompleter;
import com.ragapi.util.StudentAnswerCompletenessGuard;
import com.ragapi.util.StudentFacingMessages;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/** Builds the prompt, invokes the model, validates its output, and records the result. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerGenerationStageService {

    private final CourseAnswerGenerationService generationService;
    private final CourseAnswerPromptService promptService;
    private final CourseAnswerEvidenceService evidenceService;
    private final CanonicalTutorAnswerCacheService answerCacheService;
    private final CourseAnswerResultService resultService;

    public CourseRagAnswer generate(CourseAnswerPreparation prepared) {
        CourseAnswerRequest request = prepared.request();
        String prompt = promptService.buildPrompt(
                prepared.question(),
                prepared.context(),
                prepared.sourceLabels(),
                prepared.courseId(),
                request.classId(),
                hasText(request.baselineDraftAnswer()),
                request.pedagogicalContext(),
                request.learnerMemoryContext(),
                request.teachingMode(),
                prepared.understandingRemediation()
        );

        log.info("Sending grounded course-learning prompt to LLM...");
        try {
            log.debug("Context size: {} bytes, question length: {}",
                    prepared.context().length(), prepared.question().length());
            String answer = generateUsableAnswer(prepared, prompt, request);
            if (!hasText(answer) || StudentFacingMessages.isUnavailableMessage(answer)) {
                log.warn("Grounded tutor generation returned no usable answer");
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
            }
            answer = GroundedContentGuard.stripUnsupportedOptionalSections(answer, prepared.context());
            if (StudentAnswerCompletenessGuard.containsAbbreviatedExampleOutput(answer)) {
                log.warn("Removed an abbreviated example output containing an ellipsis placeholder");
                answer = StudentAnswerCompletenessGuard.removeAbbreviatedExampleOutputs(answer);
            }
            if (StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer)) {
                log.warn("Retrying grounded tutor generation after an incomplete student answer");
                answer = generateUsableAnswer(prepared, prompt, request);
                answer = GroundedContentGuard.stripUnsupportedOptionalSections(answer, prepared.context());
                if (StudentAnswerCompletenessGuard.containsAbbreviatedExampleOutput(answer)) {
                    answer = StudentAnswerCompletenessGuard.removeAbbreviatedExampleOutputs(answer);
                }
            }
            if (!hasText(answer) || StudentFacingMessages.isUnavailableMessage(answer)
                    || StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer)) {
                log.warn("Grounded tutor generation ended with an incomplete student answer");
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
            }
            if (StudentFacingMessages.isInsufficientMaterialAnswer(answer)) {
                log.warn("Grounded tutor declined because it considered the supplied context insufficient");
                return resultService.blocked(
                        "Tài liệu hiện có của môn " + prepared.courseId()
                                + " chưa đủ nội dung để trả lời chắc chắn. "
                                + "Câu hỏi sẽ được chuyển cho giáo viên/mentor phụ trách.",
                        0.0,
                        List.of(),
                        "Generated answer reports insufficient course material"
                );
            }

            log.info("Received grounded answer from AI (length: {})", answer.length());
            List<RetrievedCourseChunk> alignedChunks = evidenceService.selectAnswerEvidenceChunks(
                    prepared.chunks(), prepared.question(), answer);
            List<String> alignedSourceLabels = evidenceService.buildSourceLabels(
                    alignedChunks, prepared.materialsById());
            List<RagSourceEvidence> alignedSourceEvidence = evidenceService.buildSourceEvidence(
                    alignedChunks, prepared.courseId(), prepared.materialsById(), answer);
            CourseRagAnswer generated = CourseRagAnswer.builder()
                    .answer(answer)
                    .confidence(prepared.confidence())
                    .sources(alignedSourceLabels)
                    .sourceEvidence(alignedSourceEvidence)
                    .groundingType(prepared.groundingType())
                    .escalationRecommended(false)
                    .escalationReason(null)
                    .build();
            if (!prepared.skipAnswerCache()) {
                answerCacheService.storeRagAnswerAsync(
                        prepared.courseId(), request.classId(), prepared.question(), generated);
            }
            return generated;
        } catch (Exception exception) {
            log.error("Grounded tutor generation failed: {}", exception.getMessage(), exception);
            return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
        }
    }

    private String generateUsableAnswer(
            CourseAnswerPreparation prepared,
            String prompt,
            CourseAnswerRequest request
    ) {
        try {
            String answer = generationService.generateGroundedAnswer(
                    prompt,
                    prepared.question(),
                    request.teachingMode(),
                    prepared.context(),
                    request.learnerMemoryContext()
            );
            if (hasText(answer) && !StudentFacingMessages.isUnavailableMessage(answer)) {
                return answer;
            }
        } catch (RuntimeException firstAttempt) {
            log.warn("First grounded tutor generation failed: {}", firstAttempt.getMessage());
        }
        log.warn("Retrying grounded tutor generation after an empty, unavailable, or failed answer");
        return generationService.generateGroundedAnswer(
                prompt,
                prepared.question(),
                request.teachingMode(),
                prepared.context(),
                request.learnerMemoryContext()
        );
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isIncompleteLesson(CourseAnswerRequest request, String answer) {
        return request != null
                && "LESSON_TEACH".equalsIgnoreCase(request.teachingMode())
                && (LessonExplanationCompleter.missingLessonBody(answer)
                || !LessonUnderstandingCheckCompleter.hasUsableCheck(answer));
    }
}
