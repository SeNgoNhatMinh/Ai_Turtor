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

import java.text.Normalizer;
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
            WorkerOutputs workerOutputs = runThreeWorkerLearningPipeline(prepared, prompt, request);
            String answer = workerOutputs.answer();
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
            // A headings-only skeleton from Worker 1 must be retried even in single-pass
            // mode; otherwise the student receives Worker 2's quiz with no lesson at all.
            boolean missingTeachableBody = !hasTeachableBody(answer);
            // Study/practice requests (the welcome suggestions: tìm hiểu, giải
            // thích, hướng dẫn, bài tập, kiểm tra kiến thức…) must always be
            // taught first and only then quizzed — never exercises/quiz alone.
            boolean missingExplanation = requiresExplanationFirst(request, prepared)
                    && !hasExplanationBeforeQuiz(answer);
            boolean recoveryNeeded = StudentAnswerCompletenessGuard.isClearlyIncomplete(answer)
                    || isIncompleteLesson(request, answer)
                    || initialInsufficientMaterialAnswer
                    || droppedWorkedExample
                    || missingTeachableBody
                    || missingExplanation;
            boolean substantialContext = prepared.context() != null && prepared.context().length() >= 1500;
            boolean shouldUseQualityFallback = qualityFallbackEnabled
                    || prepared.understandingRemediation()
                    || contextContainsRequestedMethod(prepared.question(), prepared.context())
                    || droppedWorkedExample
                    || missingTeachableBody
                    || missingExplanation
                    || (initialInsufficientMaterialAnswer && substantialContext);
            if (recoveryNeeded && shouldUseQualityFallback) {
                log.warn("Retrying grounded tutor generation after an incomplete answer or an unsupported model refusal");
                String retried = generationService.generateGroundedQualityFallbackAnswer(
                        recoveryPrompt(prompt, highSupport),
                        prepared.question(),
                        request.teachingMode(),
                        prepared.context(),
                        request.learnerMemoryContext(),
                        false
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
            // Apply answer-only guards before appending independent optional worker outputs.
            // Worker 2 owns quizzes and Worker 3 owns deep-study titles — strip W1 copies first.
            String answerBody = stripSection(answer.trim(), "học chuyên sâu");
            answerBody = stripSection(answerBody, "kiểm tra hiểu");
            answerBody = stripSection(answerBody, "understanding check");
            answerBody = stripSection(answerBody, "quiz tự luyện");
            if (!hasTeachableBody(answerBody)) {
                // Never deliver a quiz-only answer: Worker 1 produced no lesson to check.
                log.warn("Worker 1 produced headings without a teachable body; refusing to deliver a quiz-only answer");
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
            }
            if (requiresExplanationFirst(request, prepared) && !hasExplanationBeforeQuiz(answerBody)) {
                // Study/practice suggestions must be explained before any quiz:
                // an exercises/questions-only reply is not a lesson.
                log.warn("Study request answered without an explanation; refusing to deliver quiz/exercises only");
                return resultService.softUnavailable(StudentFacingMessages.GENERATION_BUSY, prepared.sourceLabels());
            }
            StringBuilder finalContent = new StringBuilder(answerBody.trim());
            if (hasText(workerOutputs.quiz())) {
                // Always use Kiểm tra hiểu so FE (including older deploys) can turn the block into forms.
                // Worker 2 may still emit Q1/Q2…; FE splits those into multiple interactive items.
                finalContent.append("\n\n## Kiểm tra hiểu\n\n")
                        .append(normalizeWorkerQuizMarkdown(workerOutputs.quiz()));
            }
            String deepStudyTitles = normalizeDeepStudyTitles(workerOutputs.deepStudy());
            if (hasText(deepStudyTitles)) {
                finalContent.append("\n\n## Học chuyên sâu\n\n").append(deepStudyTitles);
            }
            answer = finalContent.toString();
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

    /** Worker 1 answers, Worker 2 creates a quiz, Worker 3 lists clickable deep-study titles only. */
    private WorkerOutputs runThreeWorkerLearningPipeline(CourseAnswerPreparation prepared, String answerPrompt, CourseAnswerRequest request) {
        String traceId = MDC.get("aiTraceId");
        String context = prepared.context() == null ? "" : prepared.context();
        String question = prepared.question() == null ? "" : prepared.question();
        boolean remediation = prepared.understandingRemediation();
        SupportLevel supportLevel = resolveSupportLevel(request);
        String quizCountInstruction = quizCountInstruction(supportLevel);
        String quizPrompt = remediation
                ? """
                You are Worker 2: an independent re-check quiz author after a wrong student answer.
                Create ONE easier multiple-choice question about the SAME concept in STUDENT QUESTION.
                Paraphrase the question and every choice. Do not copy the previous item.
                Do not re-teach the lesson and do not diagnose the prior wrong choice.
                Keep 'Giải thích' to one short sentence; do not repeat Worker 1's re-teach.
                Use only COURSE MATERIAL CONTEXT. Vietnamese unless the student used another language.
                Return ONLY this block (no heading):

                Câu hỏi: <paraphrased easier question>
                A. <choice>
                B. <choice>
                C. <choice>
                Đáp án: <A or B or C>
                Giải thích: <one short sentence>

                STUDENT QUESTION:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(question, limitWorkerContext(context))
                : """
                You are Worker 2: an independent quiz author for a university course.
                Generate a useful quiz for the student's question based only on COURSE MATERIAL CONTEXT.
                Do not answer the question as a tutor and do not review another worker's answer.
                Active support level: %s.
                %s
                Each question must have exactly 4 options (A-D), one correct answer,
                and a concise explanation for the answer. Vary difficulty from basic to applied when writing more than one item.
                Use Vietnamese unless the student asked in another language. Do not invent facts outside context.
                Format each item exactly like this (plain text, no bold asterisks around labels):
                Q1.
                <question>
                A. <choice>
                B. <choice>
                C. <choice>
                D. <choice>
                Đáp án đúng: <A|B|C|D>
                Giải thích: <one short sentence>
                Put Q1. / Q2. on its own line. Do not write "Đáp án đúng:*" or "Q1.*".
                For a single-question quiz, still use the Q1 format.

                STUDENT QUESTION:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(
                        supportLevel.name(),
                        quizCountInstruction,
                        question,
                        limitWorkerContext(context));
        String deepStudyPrompt = """
                You are Worker 3: a deep-study topic suggester for a university AI Tutor.
                Independently propose short clickable titles for further study about the student's question.
                Do NOT write an essay, explanation, example, table, code, or challenge.
                Do NOT generate a quiz and do NOT rewrite another worker's answer.
                Output ONLY 3 to 5 Markdown bullets. Each bullet is one short topic title (max ~12 words)
                that a student can click to learn next. Ground titles in COURSE MATERIAL CONTEXT;
                omit a title if the context cannot support it. No intro, no closing, no headings.
                Use Vietnamese unless the student asked otherwise.

                Example shape:
                - So sánh nested conditionals với chained conditionals
                - Khi nào nên tránh lồng điều kiện quá sâu
                - Refactor nested if thành hàm riêng

                STUDENT QUESTION:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(question, limitWorkerContext(context));
        String worker1Prompt = answerPrompt
                + (remediation
                ? """

                WORKER-1 SCOPE (remediation / giảng lại):
                - Include "## Chẩn đoán lỗi sai" using the chosen option named in STUDENT QUESTION.
                - Then re-teach once under "## Giảng lại dễ hiểu" with conceptual + one visual section.
                - Do NOT include "## Kiểm tra hiểu", "## Quiz tự luyện", or any A/B/C quiz.
                - Do NOT include "## Học chuyên sâu". Worker 3 owns clickable deep-study titles.
                - Do not repeat the same explanation twice.
                """
                : """

                WORKER-1 SCOPE (three-worker pipeline):
                - Write only the grounded answer (explanation / example / sources as required).
                - TEACH FIRST, ALWAYS: even when the student asks for practice, exercises,
                  a knowledge check or a quiz ("bài tập", "kiểm tra kiến thức", "ôn tập"…),
                  first explain the concept in clear teaching paragraphs (with a small
                  example when supported). Worker 2 appends the quiz AFTER your explanation.
                  An answer made only of questions or exercises is invalid.
                - Do NOT include "## Kiểm tra hiểu", "Understanding Check", or any multiple-choice quiz.
                - Do NOT include "## Quiz tự luyện". Worker 2 owns all quiz content.
                - Do NOT include "## Học chuyên sâu". Worker 3 owns clickable deep-study titles.
                """);
        Map<String, Supplier<String>> workers = new LinkedHashMap<>();
        workers.put("worker-1", () -> generationService.generateWorker1GroundedAnswer(
                worker1Prompt, question, request.teachingMode(), context, request.learnerMemoryContext(), false));
        workers.put("worker-2", () -> generationService.generateWorkerUtilityAnswer(quizPrompt));
        workers.put("worker-3", () -> generationService.generateWorkerUtilityAnswer(deepStudyPrompt));
        Map<String, AiWorkerResult<String>> results = workerOrchestrator.executeParallel(workers, Duration.ofSeconds(60));
        String answer = successfulOutput(results.get("worker-1"));
        String quiz = successfulOutput(results.get("worker-2"));
        String deepStudy = successfulOutput(results.get("worker-3"));
        recordWorkerOutput(traceId, "worker-1", "Worker 1 · Answer Generator", "GENERATE_ANSWER", answer, results.get("worker-1"));
        recordWorkerOutput(traceId, "worker-2", "Worker 2 · Quiz Generator", "GENERATE_QUIZ", quiz, results.get("worker-2"));
        recordWorkerOutput(traceId, "worker-3", "Worker 3 · Deep Study Titles", "GENERATE_DEEP_STUDY", deepStudy, results.get("worker-3"));
        if (!hasText(answer)) {
            log.warn("Worker 1 failed to generate the main answer");
            answer = StudentFacingMessages.GENERATION_UNAVAILABLE;
        }
        if (!hasText(quiz)) {
            log.warn("Worker 2 did not produce a quiz; main answer will still be returned");
        }
        if (!hasText(normalizeDeepStudyTitles(deepStudy))) {
            log.warn("Worker 3 did not produce deep-study titles; main answer will still be returned");
        }
        return new WorkerOutputs(answer, quiz, deepStudy);
    }

    private record WorkerOutputs(String answer, String quiz, String deepStudy) {}

    private void recordWorkerOutput(String traceId, String workerId, String workerName, String stage,
                                    String output, AiWorkerResult<String> result) {
        if (!hasText(output) || result == null || result.status() != AiWorkerResult.Status.SUCCESS) return;
        traceService.recordOutput(traceId, workerId, workerName, stage, output, result.durationMs());
    }
    private String successfulOutput(AiWorkerResult<String> result) {
        return result != null && result.status() == AiWorkerResult.Status.SUCCESS ? result.value() : null;
    }

    private String limitWorkerContext(String context) {
        if (context == null || context.isBlank()) return "(No course context was retrieved.)";
        int max = 8_000;
        return context.length() <= max ? context : context.substring(0, max);
    }

    /**
     * Forces each option / answer / next Q onto its own line. Models often emit one long
     * paragraph ("Q1. …? A. … B. … Đáp án đúng: B"), which FE then shows as plain text.
     */
    static String normalizeWorkerQuizMarkdown(String quiz) {
        if (quiz == null || quiz.isBlank()) {
            return "";
        }
        String text = quiz.trim()
                .replace("\\r\\n", "\n")
                .replace("\\n", "\n")
                .replace("\r\n", "\n")
                .replace('\r', '\n');
        text = text.replaceAll("(?im)^\\s*câu hỏi trắc nghiệm\\s*[*:.：-]*\\s*", "");
        text = text.replaceAll("(?im)\\s*\\*{0,2}(Q\\d+)\\.\\*?\\s*", "\n\n$1.\n");
        text = text.replaceAll("(?<!\\n)\\s+([A-D])\\.\\s+", "\n$1. ");
        text = text.replaceAll("(?im)\\s*\\*{0,2}Đáp án đúng\\*{0,2}\\s*[:：*]\\s*", "\nĐáp án đúng: ");
        text = text.replaceAll("(?im)\\s*\\*{0,2}Đáp án\\*{0,2}\\s*[:：*]\\s*", "\nĐáp án: ");
        text = text.replaceAll("(?im)\\s*\\*{0,2}Giải thích\\*{0,2}\\s*[:：*]\\s*", "\nGiải thích: ");
        return text.replaceAll("\\n{3,}", "\n\n").trim();
    }

    /** Removes a markdown section so Worker 3 can own the deep-study title list. */
    private String stripSection(String markdown, String headingKey) {
        if (!hasText(markdown) || !hasText(headingKey)) {
            return markdown == null ? "" : markdown;
        }
        Pattern section = Pattern.compile(
                "(?im)^#{1,6}\\s*" + Pattern.quote(headingKey.trim()) + "\\s*$\\n?[\\s\\S]*?(?=^#{1,6}\\s+\\S|\\z)");
        return section.matcher(markdown).replaceAll("").replaceAll("\\n{3,}", "\n\n").trim();
    }

    /** Keeps only short bullet titles; drops essay-like Worker 3 output. */
    private String normalizeDeepStudyTitles(String deepStudy) {
        if (!hasText(deepStudy)) {
            return "";
        }
        StringBuilder titles = new StringBuilder();
        int count = 0;
        for (String rawLine : deepStudy.split("\\R")) {
            String line = rawLine == null ? "" : rawLine.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            Matcher bullet = Pattern.compile("^[-*+]\\s+(.+)$").matcher(line);
            Matcher numbered = Pattern.compile("^\\d+[.)]\\s+(.+)$").matcher(line);
            String title = null;
            if (bullet.matches()) {
                title = bullet.group(1).trim();
            } else if (numbered.matches()) {
                title = numbered.group(1).trim();
            }
            if (!hasText(title)) {
                continue;
            }
            title = title.replaceAll("[*_`]+", "").replaceAll("\\s+", " ").trim();
            if (title.length() < 8 || title.length() > 120) {
                continue;
            }
            if (titles.length() > 0) {
                titles.append('\n');
            }
            titles.append("- ").append(title);
            count += 1;
            if (count >= 5) {
                break;
            }
        }
        return titles.toString();
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

    private enum SupportLevel {
        STANDARD,
        HIGH_SUPPORT,
        CHALLENGE
    }

    private SupportLevel resolveSupportLevel(CourseAnswerRequest request) {
        String context = request == null ? null : request.pedagogicalContext();
        if (context == null || context.isBlank()) {
            return SupportLevel.STANDARD;
        }
        String upper = context.toUpperCase(Locale.ROOT);
        if (upper.contains("CHALLENGE")) {
            return SupportLevel.CHALLENGE;
        }
        if (upper.contains("HIGH_SUPPORT")) {
            return SupportLevel.HIGH_SUPPORT;
        }
        return SupportLevel.STANDARD;
    }

    private String quizCountInstruction(SupportLevel supportLevel) {
        return switch (supportLevel) {
            case HIGH_SUPPORT -> "Write 2 to 3 multiple-choice questions (no fewer than 2, no more than 3).";
            case CHALLENGE -> "Write 3 to 5 multiple-choice questions (no fewer than 3, no more than 5).";
            case STANDARD -> "Write exactly 1 multiple-choice question.";
        };
    }

    private boolean isHighSupport(CourseAnswerRequest request) {
        return resolveSupportLevel(request) == SupportLevel.HIGH_SUPPORT;
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

    /**
     * True only when Worker 1 left real prose. A skeleton of headings plus a
     * source-reference block (the observed quiz-only failure) is not teachable.
     * Quiz and deep-study sections are stripped before measuring so a Worker 1
     * reply consisting solely of its own quiz also counts as missing.
     */
    private boolean hasTeachableBody(String answer) {
        if (!hasText(answer)) {
            return false;
        }
        String body = stripSection(answer, "học chuyên sâu");
        body = stripSection(body, "kiểm tra hiểu");
        body = stripSection(body, "understanding check");
        body = stripSection(body, "quiz tự luyện");
        body = stripSection(body, "nguồn tài liệu đã dùng");
        body = stripSection(body, "nguồn tài liệu");
        String prose = body
                .replaceAll("(?im)^#{1,6}\\s+.*$", " ")
                .replaceAll("(?i)materialId\\s*=\\s*\\S+", " ")
                .replaceAll("[\\s*_`>#\\-]+", " ")
                .trim();
        return prose.length() >= 40;
    }

    /**
     * The welcome study suggestions ("Tôi muốn tìm hiểu…", "Giải thích…",
     * "Hướng dẫn tôi thực hành…", "Cho tôi bài tập…", "Kiểm tra kiến thức…")
     * and every similar study/practice ask must be taught before any quiz.
     * Learning-path listings and wrong-answer remediation follow their own
     * flows and are excluded.
     */
    private boolean requiresExplanationFirst(CourseAnswerRequest request, CourseAnswerPreparation prepared) {
        if (request == null || prepared == null || prepared.understandingRemediation()) {
            return false;
        }
        String mode = request.teachingMode();
        if ("LEARNING_PATH".equalsIgnoreCase(mode)) {
            return false;
        }
        String text = foldAccents(prepared.question());
        if (text.isBlank()) {
            return false;
        }
        String[] markers = {
                "tim hieu", "muon hoc", "hoc bai", "giai thich", "huong dan",
                "thuc hanh", "bai tap", "luyen tap", "kiem tra kien thuc",
                "kiem tra hieu", "on tap", "hoc ve", "day toi", "day minh",
                "learn", "explain", "practice", "exercise", "test me",
                "quiz me", "check my understanding", "teach me"
        };
        for (String marker : markers) {
            if (text.contains(marker)) {
                return true;
            }
        }
        return false;
    }

    /**
     * True when the Worker 1 body contains a real explanation (declarative
     * teaching prose), not just questions/exercises. Quiz, deep-study and
     * source sections are stripped before measuring, exactly like
     * {@link #hasTeachableBody}.
     */
    private boolean hasExplanationBeforeQuiz(String answer) {
        if (!hasText(answer)) {
            return false;
        }
        String body = stripSection(answer, "học chuyên sâu");
        body = stripSection(body, "kiểm tra hiểu");
        body = stripSection(body, "understanding check");
        body = stripSection(body, "quiz tự luyện");
        body = stripSection(body, "nguồn tài liệu đã dùng");
        body = stripSection(body, "nguồn tài liệu");
        int explanationChars = 0;
        int longestLine = 0;
        for (String rawLine : body.split("\n")) {
            String line = rawLine.trim()
                    .replaceAll("^#{1,6}\\s+", "")
                    .replaceAll("^[\\-*•]\\s+", "")
                    .replaceAll("^\\d+[.)]\\s+", "")
                    .trim();
            if (line.length() < 40 || line.endsWith("?")) {
                continue;
            }
            // Quiz/exercise scaffolding lines are not explanation prose.
            if (line.matches("(?i)^(câu hỏi|question|q\\d+|bài tập|bài \\d+|đáp án|answer|giải thích đáp án)\\b.*")) {
                continue;
            }
            if (line.matches("^[A-Da-d][.)]\\s+.*")) {
                continue;
            }
            explanationChars += line.length();
            longestLine = Math.max(longestLine, line.length());
        }
        // One real teaching sentence is enough (short concept/review answers
        // stay valid); a questions/options-only body accumulates zero here.
        return longestLine >= 40 && explanationChars >= 40;
    }

    private static String foldAccents(String value) {
        if (value == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd');
        return decomposed.replaceAll("\\s+", " ").trim();
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
        // Understanding-check quizzes belong to Worker 2; Worker 1 is incomplete only without the lesson body.
        return request != null
                && "LESSON_TEACH".equalsIgnoreCase(request.teachingMode())
                && LessonExplanationCompleter.missingLessonBody(answer);
    }
}
