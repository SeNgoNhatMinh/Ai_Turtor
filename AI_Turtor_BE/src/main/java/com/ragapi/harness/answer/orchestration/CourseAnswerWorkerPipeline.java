package com.ragapi.harness.answer.orchestration;

import com.ragapi.harness.aiworker.AiWorkerOrchestrator;
import com.ragapi.harness.aiworker.AiWorkerResult;
import com.ragapi.harness.aiworker.AiWorkerTraceService;
import com.ragapi.harness.answer.generation.CourseAnswerGenerationService;
import com.ragapi.harness.answer.generation.SupportLevelPrompt;
import com.ragapi.harness.answer.policy.CourseAnswerRequestPolicyService;
import com.ragapi.harness.model.CourseAnswerRequest;
import com.ragapi.harness.util.StudentFacingMessages;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;

/**
 * Worker 1 writes the lesson. Worker 2 writes the quiz. Worker 3 writes deep-study titles.
 * The stage service decides whether those pieces are delivered.
 */
@Slf4j
@RequiredArgsConstructor
class CourseAnswerWorkerPipeline {

    private static final int REQUIRED_FOLLOW_UP_ATTEMPTS = 3;

    private final CourseAnswerGenerationService generationService;
    private final AiWorkerTraceService traceService;
    private final AiWorkerOrchestrator workerOrchestrator;

    record Outputs(String answer, String quiz, String deepStudy) {}

    Outputs run(CourseAnswerPreparation prepared, String answerPrompt, CourseAnswerRequest request) {
        String traceId = MDC.get("aiTraceId");
        String context = prepared.context() == null ? "" : prepared.context();
        String question = prepared.question() == null ? "" : prepared.question();
        boolean remediation = prepared.understandingRemediation();
        boolean workReview = CourseAnswerRequestPolicyService.isFinishedWorkReview(question);
        SupportLevelPrompt supportLevel = resolveSupportLevel(request);
        String quizCountInstruction = supportLevel.quizCountInstruction();
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
                ALWAYS write every question, option, and explanation in Vietnamese, even when the course material is in English. Translate technical terms naturally.
                Do not invent facts outside context.
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
                ALWAYS write every title in Vietnamese, even when the course material is in English.
                Translate technical terms naturally; do not leave entire titles in English.

                Example shape:
                - So sánh nested conditionals với chained conditionals
                - Khi nào nên tránh lồng điều kiện quá sâu
                - Refactor nested if thành hàm riêng
                - Vòng đời của Servlet: init, service, destroy
                - So sánh doGet và doPost khi xử lý form HTML

                STUDENT QUESTION:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(question, limitWorkerContext(context));

        String worker1Prompt = answerPrompt
                + (workReview
                ? """

                WORKER-1 SCOPE (sửa bài):
                - First restate the concept this exercise checked, then grade the filled blanks and the wrong quiz choices.
                - Point each mistake back to that concept. Do not open a new chapter and do not paste the full program.
                - Do NOT include "## Kiểm tra hiểu", "## Quiz tự luyện", "## Học chuyên sâu", or any new A/B/C quiz.
                - If an excerpt misses a method, say that in one sentence and still mark the blank.
                """
                : remediation
                ? """

                WORKER-1 SCOPE (remediation / giảng lại):
                - Include "## 1. Chẩn đoán lỗi sai" using the chosen option named in STUDENT QUESTION.
                - Then re-teach once under "## 2. Giảng lại dễ hiểu". The paragraphs and one visual aid
                  stay in that same section. Do not add an empty heading or a second heading for the explanation.
                - Every other bold section title continues that same count.
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
                - Number every bold section title in this answer: "## 1. ...", "## 2. ...", with no gaps.
                  This applies to every heading you write, not only explanation-style sections.
                - If STUDENT-SPECIFIC EXPLANATION STYLE is present, render each selected style as its
                  own numbered section: "## 1. Giải thích khái niệm", "## 2. Ví dụ thực tế", and so on.
                  Apply the style to THIS question.
                  Do not reopen an older topic named in the style. Do not write an A/B/C quiz here.
                """);
        Map<String, Supplier<String>> lessonWorker = new LinkedHashMap<>();
        lessonWorker.put("worker-1", () -> generationService.generateWorker1GroundedAnswer(
                worker1Prompt, question, request.teachingMode(), context, request.learnerMemoryContext(), false));
        Map<String, AiWorkerResult<String>> lessonResults =
                workerOrchestrator.executeParallel(lessonWorker, Duration.ofSeconds(60));
        String answer = successfulOutput(lessonResults.get("worker-1"));
        recordWorkerOutput(traceId, "worker-1", "Worker 1 · Answer Generator", "GENERATE_ANSWER",
                answer, lessonResults.get("worker-1"));
        if (workReview) {
            if (!hasText(answer)) {
                log.warn("Worker 1 failed to generate the work review");
                answer = StudentFacingMessages.GENERATION_UNAVAILABLE;
            }
            return new Outputs(answer, "", "");
        }
        if (!hasText(answer)) {
            log.warn("Worker 1 failed to generate the main answer");
            answer = StudentFacingMessages.GENERATION_UNAVAILABLE;
        }
        Map<String, Supplier<String>> followUpWorkers = new LinkedHashMap<>();
        followUpWorkers.put("worker-2", () -> produceUntilUsable(
                "worker-2",
                () -> generationService.generateWorkerUtilityAnswer(quizPrompt),
                CourseAnswerWorkerPipeline::isUsableQuiz));
        followUpWorkers.put("worker-3", () -> produceUntilUsable(
                "worker-3",
                () -> generationService.generateWorkerUtilityAnswer(deepStudyPrompt),
                text -> hasText(normalizeDeepStudyTitles(text))));
        Map<String, AiWorkerResult<String>> results =
                workerOrchestrator.executeParallel(followUpWorkers, Duration.ofSeconds(60));
        String quiz = successfulOutput(results.get("worker-2"));
        String deepStudy = successfulOutput(results.get("worker-3"));
        recordWorkerOutput(traceId, "worker-2", "Worker 2 · Quiz Generator", "GENERATE_QUIZ", quiz, results.get("worker-2"));
        recordWorkerOutput(traceId, "worker-3", "Worker 3 · Deep Study Titles", "GENERATE_DEEP_STUDY", deepStudy, results.get("worker-3"));
        if (!hasText(quiz)) {
            log.warn("Worker 2 did not produce a quiz; main answer will still be returned");
        }
        if (!hasText(normalizeDeepStudyTitles(deepStudy))) {
            log.warn("Worker 3 did not produce deep-study titles; main answer will still be returned");
        }
        return new Outputs(answer, quiz, deepStudy);
    }

    static SupportLevelPrompt resolveSupportLevel(CourseAnswerRequest request) {
        if (request == null) {
            return SupportLevelPrompt.STANDARD;
        }
        return SupportLevelPrompt.resolve(
                request.teachingPlan(),
                request.teachingPlan() == null ? null : request.teachingPlan().supportLevel(),
                request.pedagogicalContext()
        );
    }

    private void recordWorkerOutput(String traceId, String workerId, String workerName, String stage,
                                    String output, AiWorkerResult<String> result) {
        if (!hasText(output) || result == null || result.status() != AiWorkerResult.Status.SUCCESS) return;
        traceService.recordOutput(traceId, workerId, workerName, stage, output, result.durationMs());
    }

    private String successfulOutput(AiWorkerResult<String> result) {
        return result != null && result.status() == AiWorkerResult.Status.SUCCESS ? result.value() : null;
    }

    private String produceUntilUsable(String workerId, Supplier<String> generate, Predicate<String> usable) {
        for (int attempt = 1; attempt <= REQUIRED_FOLLOW_UP_ATTEMPTS; attempt++) {
            String produced;
            try {
                produced = generate.get();
            } catch (RuntimeException error) {
                log.warn("{} attempt {} failed: {}", workerId, attempt, error.getMessage());
                continue;
            }
            if (usable.test(produced)) {
                if (attempt > 1) {
                    log.info("{} produced the required output on attempt {}", workerId, attempt);
                }
                return produced;
            }
            log.warn("{} attempt {} did not produce the required output", workerId, attempt);
        }
        log.warn("{} did not produce the required output after {} attempts", workerId, REQUIRED_FOLLOW_UP_ATTEMPTS);
        return "";
    }

    static boolean isUsableQuiz(String quiz) {
        String text = normalizeWorkerQuizMarkdown(quiz);
        if (!hasText(text)) {
            return false;
        }
        int options = 0;
        for (String letter : List.of("A", "B", "C")) {
            if (Pattern.compile("(?m)^" + letter + "\\.\\s+\\S").matcher(text).find()) {
                options++;
            }
        }
        boolean answerKey = Pattern.compile("(?im)^Đáp án(?: đúng)?\\s*:\\s*[A-D]\\b").matcher(text).find();
        return options >= 3 && answerKey;
    }

    private String limitWorkerContext(String context) {
        if (context == null || context.isBlank()) return "(No course context was retrieved.)";
        int max = 8_000;
        return context.length() <= max ? context : context.substring(0, max);
    }

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

    static String normalizeDeepStudyTitles(String deepStudy) {
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

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
