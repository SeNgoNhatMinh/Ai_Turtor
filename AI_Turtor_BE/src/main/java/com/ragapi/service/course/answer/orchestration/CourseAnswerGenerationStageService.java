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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    @Value("${rag.generation.quality-fallback-enabled:false}")
    private boolean qualityFallbackEnabled;

    public CourseRagAnswer generate(CourseAnswerPreparation prepared) {
        CourseAnswerRequest request = prepared.request();
        String prompt = promptService.buildPrompt(
                questionWithTextbookWording(prepared),
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
                if (prepared.understandingRemediation()) {
                    return resultService.blocked(
                            StudentFacingMessages.GENERATION_BUSY,
                            0.0,
                            prepared.sourceLabels(),
                            "All eligible LLM providers failed during understanding remediation"
                    );
                }
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
            }
            answer = GroundedContentGuard.stripUnsupportedOptionalSections(answer, prepared.context());
            if (StudentAnswerCompletenessGuard.containsAbbreviatedExampleOutput(answer)) {
                log.warn("Removed an abbreviated example output containing an ellipsis placeholder");
                answer = StudentAnswerCompletenessGuard.removeAbbreviatedExampleOutputs(answer);
            }
            String firstAnswer = answer;
            boolean initialInsufficientMaterialAnswer =
                    StudentFacingMessages.isInsufficientMaterialAnswer(answer)
                            && !hasTeachableLesson(answer);
            boolean highSupport = isHighSupport(request);
            boolean droppedWorkedExample = highSupportDroppedWorkedExample(
                    highSupport, prepared.context(), answer);
            boolean recoveryNeeded = StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer)
                    || initialInsufficientMaterialAnswer
                    || droppedWorkedExample;
            boolean substantialContext = prepared.context() != null && prepared.context().length() >= 1500;
            boolean shouldUseQualityFallback = qualityFallbackEnabled
                    || prepared.understandingRemediation()
                    || contextContainsRequestedMethod(prepared.question(), prepared.context())
                    || droppedWorkedExample
                    || (initialInsufficientMaterialAnswer && substantialContext);
            if (recoveryNeeded && shouldUseQualityFallback) {
                log.warn("Retrying grounded tutor generation after an incomplete answer or an unsupported model refusal");
                String retried = generationService.generateGroundedQualityFallbackAnswer(
                        recoveryPrompt(prompt, highSupport),
                        prepared.question(),
                        request.teachingMode(),
                        prepared.context(),
                        request.learnerMemoryContext()
                );
                retried = GroundedContentGuard.stripUnsupportedOptionalSections(retried, prepared.context());
                if (StudentAnswerCompletenessGuard.containsAbbreviatedExampleOutput(retried)) {
                    retried = StudentAnswerCompletenessGuard.removeAbbreviatedExampleOutputs(retried);
                }
                if (isDeliverableLesson(retried)) {
                    answer = retried;
                } else if (hasTeachableLesson(firstAnswer)) {
                    log.warn("Keeping the first grounded lesson because the retry did not return a usable answer");
                    answer = firstAnswer;
                } else {
                    answer = retried;
                }
            } else if (recoveryNeeded && !initialInsufficientMaterialAnswer) {
                // A usable first answer is preferable to starting another complete provider
                // chain that can outlive the synchronous n8n request deadline.
                log.warn("Accepting usable single-pass answer; quality fallback is disabled");
            }
            if ((StudentFacingMessages.isInsufficientMaterialAnswer(answer) && !hasTeachableLesson(answer))
                    || (initialInsufficientMaterialAnswer
                    && (!hasText(answer)
                    || StudentFacingMessages.isUnavailableMessage(answer)
                    || StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer)))) {
                log.warn(shouldUseQualityFallback
                        ? "Grounded tutor declined despite retrying with deterministic grounding context"
                        : "Grounded tutor declined with insufficient material; quality fallback is disabled");
                return insufficientMaterial(prepared);
            }
            if (!hasText(answer) || StudentFacingMessages.isUnavailableMessage(answer)
                    || (qualityFallbackEnabled && (StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer)))) {
                log.warn("Grounded tutor generation ended with an incomplete student answer");
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
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
            return generationService.generateGroundedAnswer(
                    prompt,
                    prepared.question(),
                    request.teachingMode(),
                    prepared.context(),
                    request.learnerMemoryContext()
            );
        } catch (RuntimeException firstAttempt) {
            log.warn("First grounded tutor generation failed: {}", firstAttempt.getMessage());
            return StudentFacingMessages.GENERATION_UNAVAILABLE;
        }
    }

    private boolean contextContainsRequestedMethod(String question, String context) {
        String evidence = context == null ? "" : context.toLowerCase(Locale.ROOT);
        Matcher matcher = Pattern.compile(
                "(?iu)(?<![\\p{L}\\p{N}_])([a-z_][a-z0-9_]{3,})(?![\\p{L}\\p{N}_])"
        ).matcher(question == null ? "" : question.toLowerCase(Locale.ROOT));
        while (matcher.find()) {
            String identifier = matcher.group(1);
            if (evidence.contains("." + identifier + "(") || evidence.contains(identifier + "(")) {
                return true;
            }
        }
        return false;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String recoveryPrompt(String prompt, boolean highSupport) {
        String recovery = prompt + """

                RECOVERY INSTRUCTION:
                Deterministic retrieval and grounding checks already verified that the supplied course excerpts are
                relevant enough to answer. Re-read those excerpts and answer only from them. Do not claim the course
                material is missing merely because the wording of the question differs from a chapter heading.
                """;
        if (!highSupport) {
            return recovery;
        }
        return recovery + """

                HIGH_SUPPORT RECOVERY:
                This student needs one short textbook example for each concept the excerpts explain. Explain every
                shown line in simple Vietnamese. Do not copy every >>> prompt in the chapter, do not invent an
                example, and do not claim the course material is missing when the excerpts already answer.
                """;
    }

    private boolean isHighSupport(CourseAnswerRequest request) {
        String context = request == null ? null : request.pedagogicalContext();
        return context != null && context.toUpperCase(Locale.ROOT).contains("HIGH_SUPPORT");
    }

    /**
     * Retry only when the textbook shows an interactive example and the answer shows none.
     * A chapter full of >>> prompts must not force a second provider chain after one example.
     */
    private boolean highSupportDroppedWorkedExample(boolean highSupport, String context, String answer) {
        if (!highSupport || countOccurrences(context, ">>>") < 1) {
            return false;
        }
        String text = answer == null ? "" : answer;
        return countOccurrences(text, "```") / 2 < 1 && !text.contains(">>>");
    }

    private boolean isDeliverableLesson(String value) {
        return hasText(value)
                && !StudentFacingMessages.isUnavailableMessage(value)
                && !(StudentFacingMessages.isInsufficientMaterialAnswer(value) && !hasTeachableLesson(value));
    }

    private boolean hasTeachableLesson(String value) {
        if (!hasText(value) || value.length() < 350 || StudentFacingMessages.isUnavailableMessage(value)) {
            return false;
        }
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.contains("```")
                || lower.contains(">>>")
                || lower.contains("list")
                || lower.contains("tuple")
                || lower.contains("dict");
    }

    private int countOccurrences(String value, String needle) {
        if (value == null || value.isBlank() || needle == null || needle.isEmpty()) {
            return 0;
        }
        int count = 0;
        int from = 0;
        while (from < value.length()) {
            int found = value.indexOf(needle, from);
            if (found < 0) {
                return count;
            }
            count++;
            from = found + needle.length();
        }
        return count;
    }

    private CourseRagAnswer insufficientMaterial(CourseAnswerPreparation prepared) {
        return resultService.blocked(
                "Tài liệu hiện có của môn " + prepared.courseId()
                        + " chưa đủ nội dung để trả lời chắc chắn. "
                        + "Câu hỏi sẽ được chuyển cho giáo viên/mentor phụ trách.",
                0.0,
                List.of(),
                "Generated answer reports insufficient course material"
        );
    }

    /**
     * The textbook search line is the same question in material wording.
     * The model should answer when the excerpt matches that line, even if the
     * student's sentence uses different words.
     */
    private String questionWithTextbookWording(CourseAnswerPreparation prepared) {
        String question = prepared.question() == null ? "" : prepared.question();
        String retrieval = prepared.retrievalQuestion();
        if (retrieval == null || retrieval.isBlank() || retrieval.equals(question)) {
            return question;
        }
        return question + """

                TEXTBOOK SEARCH LINE:
                %s
                This line is the same question rewritten into textbook wording.
                If COURSE MATERIAL CONTEXT explains this line, answer the student.
                Do not refuse only because the student's words differ from the excerpt.
                """.formatted(retrieval);
    }

    private boolean isIncompleteLesson(CourseAnswerRequest request, String answer) {
        return request != null
                && "LESSON_TEACH".equalsIgnoreCase(request.teachingMode())
                && (LessonExplanationCompleter.missingLessonBody(answer)
                || !LessonUnderstandingCheckCompleter.hasUsableCheck(answer));
    }
}
