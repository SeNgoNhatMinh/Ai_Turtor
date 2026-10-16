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
import com.ragapi.service.aiworker.AiWorkerTraceService;
import com.ragapi.service.aiworker.AiWorkerOrchestrator;
import com.ragapi.service.aiworker.AiWorkerResult;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.MDC;
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
    private final AiWorkerTraceService traceService;
    private final AiWorkerOrchestrator workerOrchestrator;

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
            String answer = runThreeWorkerLearningPipeline(prepared, prompt, request);
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
                if (pinnedLesson(request, prepared)) {
                    log.warn("Pinned lesson stays with the tutor instead of a mentor escalation");
                    if (hasTeachableLesson(firstAnswer)) {
                        answer = firstAnswer;
                    } else {
                        return resultService.softUnavailable(
                                StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
                    }
                } else {
                    log.warn(shouldUseQualityFallback
                            ? "Grounded tutor declined despite retrying with deterministic grounding context"
                            : "Grounded tutor declined with insufficient material; quality fallback is disabled");
                    return insufficientMaterial(prepared);
                }
            }
            if (!hasText(answer) || StudentFacingMessages.isUnavailableMessage(answer)) {
                log.warn("Grounded tutor generation ended with an incomplete student answer");
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
            }
            if (qualityFallbackEnabled
                    && (StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer))
                    && !(pinnedLesson(request, prepared) && hasTeachableLesson(answer))) {
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

    /** Worker 1 answers the question, Worker 2 creates a quiz, and Worker 3 creates deeper learning material. */
    private String runThreeWorkerLearningPipeline(CourseAnswerPreparation prepared, String answerPrompt, CourseAnswerRequest request) {
        String traceId = MDC.get("aiTraceId");
        String context = prepared.context() == null ? "" : prepared.context();
        String question = prepared.question() == null ? "" : prepared.question();
        String quizPrompt = """
                You are Worker 2: an independent quiz author for a university course.
                Generate a useful quiz for the student's question based only on COURSE MATERIAL CONTEXT.
                Do not answer the question as a tutor and do not review another worker's answer.
                Write 5 multiple-choice questions, each with exactly 4 options (A-D), one correct answer,
                and a concise explanation for the answer. Vary difficulty from basic to applied.
                Use Vietnamese unless the student asked in another language. Do not invent facts outside context.
                Format each item clearly as Q1, options A-D, 'Đáp án đúng:', and 'Giải thích:'.

                STUDENT QUESTION:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(question, limitWorkerContext(context));
        String deepStudyPrompt = """
                You are Worker 3: a deep-learning content author for a university AI Tutor.
                Independently create a substantive 'Học chuyên sâu' section about the student's question.
                Do not verify or rewrite another worker's answer and do not generate a quiz.
                Include: deeper intuition, how/why it works, important details or trade-offs, a worked example,
                common mistakes, and one practical challenge for further study. Use code or a diagram only when relevant.
                Ground course-specific claims in COURSE MATERIAL CONTEXT; state limitations if context is insufficient.
                Write in Vietnamese unless the student asks otherwise, with useful Markdown headings.

                STUDENT QUESTION:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(question, limitWorkerContext(context));
        Map<String, Supplier<String>> workers = new LinkedHashMap<>();
        workers.put("worker-1", () -> generationService.generateGroundedAnswer(
                answerPrompt, question, request.teachingMode(), context, request.learnerMemoryContext()));
        workers.put("worker-2", () -> generationService.generateWorkerUtilityAnswer(quizPrompt));
        workers.put("worker-3", () -> generationService.generateWorkerUtilityAnswer(deepStudyPrompt));
        Map<String, AiWorkerResult<String>> results = workerOrchestrator.executeParallel(workers, Duration.ofSeconds(60));
        String answer = successfulOutput(results.get("worker-1"));
        String quiz = successfulOutput(results.get("worker-2"));
        String deepStudy = successfulOutput(results.get("worker-3"));
        if (!hasText(answer)) {
            log.warn("Worker 1 failed to generate the main answer");
            answer = StudentFacingMessages.GENERATION_UNAVAILABLE;
        }
        StringBuilder combined = new StringBuilder(answer.trim());
        if (hasText(quiz)) {
            combined.append("\\n\\n## Quiz tự luyện\\n\\n").append(quiz.trim());
        } else {
            log.warn("Worker 2 did not produce a quiz; main answer will still be returned");
        }
        if (hasText(deepStudy)) {
            combined.append("\\n\\n## Học chuyên sâu\\n\\n").append(deepStudy.trim());
        } else {
            log.warn("Worker 3 did not produce deep-learning material; main answer will still be returned");
        }
        return combined.toString();
    }

    private String successfulOutput(AiWorkerResult<String> result) {
        return result != null && result.status() == AiWorkerResult.Status.SUCCESS ? result.value() : null;
    }

    private String limitWorkerContext(String context) {
        if (context == null || context.isBlank()) return "(No course context was retrieved.)";
        int max = 8_000;
        return context.length() <= max ? context : context.substring(0, max);
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

    private boolean pinnedLesson(CourseAnswerRequest request, CourseAnswerPreparation prepared) {
        return request != null
                && "LESSON_TEACH".equalsIgnoreCase(request.teachingMode())
                && prepared != null
                && prepared.context() != null
                && prepared.context().length() >= 400;
    }

    private boolean hasTeachableLesson(String value) {
        if (!hasText(value) || value.length() < 350 || StudentFacingMessages.isUnavailableMessage(value)) {
            return false;
        }
        if (!StudentFacingMessages.isInsufficientMaterialAnswer(value)) {
            return true;
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
