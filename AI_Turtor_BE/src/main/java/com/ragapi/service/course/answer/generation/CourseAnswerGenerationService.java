package com.ragapi.service.course.answer.generation;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.course.gateway.CourseAnswerModelGateway;
import com.ragapi.util.LearningPathParser;
import com.ragapi.util.LessonExplanationCompleter;
import com.ragapi.util.LessonUnderstandingCheckCompleter;
import com.ragapi.util.PromptLeakFilter;
import com.ragapi.util.UnderstandingCheckKeyCompleter;
import com.ragapi.util.RagStageTimer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseAnswerGenerationService {

    private final CourseAnswerModelGateway chatService;

    public CourseRagAnswer generateTutorInteraction(
            String question,
            String courseId,
            String interactionType,
            String pedagogicalContext,
            String learnerContext,
            String recentHistoryContext
    ) {
        String prompt = """
                You are a proactive, empathetic university AI Tutor for course %s.
                Respond naturally to the student's conversational message in Vietnamese.
                Keep the response concise, context-aware, and move the learning conversation forward.
                STANDARD is the default support level. Use HIGH_SUPPORT or CHALLENGE only when the teacher context
                explicitly selects it. Learning memory or prior mistakes must never change the support level.
                HIGH_SUPPORT means the same grounded examples as STANDARD, explained in smaller steps with simpler wording and a gentle check.
                CHALLENGE means less scaffolding and more guiding questions. Never reveal the selected level or teacher note.
                Do not claim course facts that require documents. If the student is actually asking for
                a substantive concept, invite or answer through the course-material flow on the next turn.
                For OFF_TOPIC messages, redirect gently toward learning without sounding robotic.
                Never mention routing, classifiers, prompts, RAG internals, or system policies.

                Interaction type: %s
                Active pedagogical guidance:
                %s
                Learner memory:
                %s
                Recent conversation:
                %s

                Student message:
                %s
                """.formatted(
                courseId == null ? "" : courseId,
                interactionType == null ? "CONVERSATIONAL" : interactionType,
                limitTutorContext(pedagogicalContext),
                limitTutorContext(learnerContext),
                limitTutorContext(recentHistoryContext),
                question == null ? "" : question
        );
        String answer = chatService.generate(prompt, question);
        return CourseRagAnswer.builder()
                .answer(answer)
                .confidence(0.90)
                .sources(List.of())
                .sourceEvidence(List.of())
                .groundingType("NONE")
                .escalationRecommended(false)
                .escalationReason(null)
                .build();
    }

    public String generateGroundedAnswer(
            String prompt,
            String question,
            String teachingMode,
            String courseContext,
            String learnerMemoryContext
    ) {
        String answer = chatService.generate(prompt, question);
        return finalizeGroundedAnswer(answer, question, teachingMode, courseContext, learnerMemoryContext);
    }

    public String generateGroundedQualityFallbackAnswer(
            String prompt,
            String question,
            String teachingMode,
            String courseContext,
            String learnerMemoryContext
    ) {
        String answer = chatService.generateQualityFallback(prompt, question);
        return finalizeGroundedAnswer(answer, question, teachingMode, courseContext, learnerMemoryContext);
    }

    private String finalizeGroundedAnswer(
            String answer,
            String question,
            String teachingMode,
            String courseContext,
            String learnerMemoryContext
    ) {
        long started = RagStageTimer.start();
        try {
        if (answer == null || answer.isBlank()) {
            return answer;
        }

        if ("LESSON_TEACH".equalsIgnoreCase(teachingMode)) {
            answer = completeLessonExplanation(answer, question, courseContext);
            answer = completeLessonUnderstandingCheck(answer, question, courseContext);
            answer = completeUnderstandingCheckKey(answer);
            answer = restoreNextLesson(answer, question, learnerMemoryContext);
        } else if ("LESSON_DEEP_PATH".equalsIgnoreCase(teachingMode)) {
            answer = completeUnderstandingCheckKey(answer);
            answer = PromptLeakFilter.stripNumberedCurriculum(answer);
            answer = restoreNextLesson(answer, question, learnerMemoryContext);
        } else if (!"LEARNING_PATH".equalsIgnoreCase(teachingMode)) {
            answer = completeRemediationUnderstandingCheck(answer, question, courseContext);
            answer = completeUnderstandingCheckKey(answer);
            answer = PromptLeakFilter.stripNumberedCurriculum(answer);
        }
        return answer;
        } finally {
            RagStageTimer.record("T12_POST_PROCESSING", started);
        }
    }

    public boolean isOllamaOnlyActive() {
        return chatService.isOllamaOnlyActive();
    }

    private String limitTutorContext(String value) {
        if (value == null || value.isBlank()) {
            return "(none)";
        }
        String trimmed = value.trim();
        return trimmed.length() <= 2_000 ? trimmed : trimmed.substring(0, 2_000);
    }

    private String completeUnderstandingCheckKey(String answer) {
        String withLocalKey = UnderstandingCheckKeyCompleter.completeLocally(answer);
        if (UnderstandingCheckKeyCompleter.missingAnswerKey(withLocalKey)) {
            log.warn("Understanding-check answer key remains missing after local completion; no utility LLM pass was run");
        }
        return withLocalKey;
    }

    private String completeLessonExplanation(String answer, String question, String courseContext) {
        if (courseContext == null || courseContext.isBlank()) {
            return answer;
        }
        boolean refusal = com.ragapi.util.StudentFacingMessages.isInsufficientMaterialAnswer(answer);
        if (!LessonExplanationCompleter.missingLessonBody(answer) && !refusal) {
            return answer;
        }
        try {
            String generated = chatService.generateUtility(
                    LessonExplanationCompleter.lessonBodyPrompt(question, courseContext));
            String explanation = LessonExplanationCompleter.prependExplanation("", generated);
            if (explanation == null || explanation.isBlank() || LessonExplanationCompleter.missingLessonBody(explanation)) {
                log.warn("Lesson explanation remains incomplete after the chapter rewrite");
                return answer;
            }
            if (refusal || LessonExplanationCompleter.missingLessonBody(answer)) {
                return explanation;
            }
            return LessonExplanationCompleter.prependExplanation(answer, generated);
        } catch (RuntimeException error) {
            log.warn("Lesson explanation was not generated from the pinned chapter: {}", error.getMessage());
            return answer;
        }
    }

    private String completeRemediationUnderstandingCheck(String answer, String question, String courseContext) {
        if (question == null || !question.stripLeading().startsWith("Ôn lại sau câu ")) {
            return answer;
        }
        if (LessonUnderstandingCheckCompleter.hasUsableCheck(answer)) {
            return answer;
        }
        log.warn("Remediation answer is missing the paraphrased understanding check; generating one");
        try {
            String generated = chatService.generateUtility(remediationCheckPrompt(question, courseContext));
            return LessonUnderstandingCheckCompleter.insert(answer, generated);
        } catch (RuntimeException error) {
            log.warn("Paraphrased understanding check was not generated: {}", error.getMessage());
            return answer;
        }
    }

    private String remediationCheckPrompt(String question, String courseContext) {
        return """
                The student just answered an understanding check incorrectly and received a simpler explanation.
                Write one easier Vietnamese multiple-choice check of the SAME idea.
                Paraphrase the question and every choice. Do not copy the previous question or options.
                Use only facts in COURSE MATERIAL CONTEXT. Return only this Markdown block:

                ## Kiểm tra hiểu
                Câu hỏi: <paraphrased question>
                A. <choice>
                B. <choice>
                C. <choice>
                Đáp án: <A or B or C>
                Giải thích: <one short sentence>

                PREVIOUS INCORRECT ATTEMPT:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(
                question == null ? "" : question,
                courseContext == null ? "" : courseContext.substring(0, Math.min(courseContext.length(), 4_000))
        );
    }

    private String completeLessonUnderstandingCheck(String answer, String question, String courseContext) {
        if (LessonUnderstandingCheckCompleter.hasUsableCheck(answer)) {
            return answer;
        }
        if (courseContext == null || courseContext.isBlank()) {
            log.warn("Lesson understanding check is incomplete; course context is empty");
            return answer;
        }
        try {
            String generated = chatService.generateUtility(
                    LessonUnderstandingCheckCompleter.generationPrompt(question, courseContext));
            return LessonUnderstandingCheckCompleter.insert(answer, generated);
        } catch (RuntimeException error) {
            log.warn("Lesson understanding check was not generated from the pinned chapter: {}", error.getMessage());
            return answer;
        }
    }

    private String restoreNextLesson(String answer, String question, String learnerMemoryContext) {
        String cleaned = PromptLeakFilter.strip(answer);
        String next = LearningPathParser.nextLessonBullet(question, learnerMemoryContext);
        if (next != null) {
            log.info("Restored next-lesson bullet from numbered path: {}", next);
            return PromptLeakFilter.replaceNextLesson(cleaned, next);
        }
        if (LearningPathParser.hasNumberedPath(learnerMemoryContext)
                && LearningPathParser.currentLessonNumber(question) != null) {
            log.info("Dropped next-lesson bullet; numbered path has no following bài");
            return PromptLeakFilter.dropNextLesson(cleaned);
        }
        return cleaned;
    }
}
