package com.ragapi.service.course.answer.generation;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.service.course.gateway.CourseAnswerModelGateway;
import com.ragapi.util.LearningPathParser;
import com.ragapi.util.LessonExplanationCompleter;
import com.ragapi.util.LessonUnderstandingCheckCompleter;
import com.ragapi.util.PromptLeakFilter;
import com.ragapi.util.UnderstandingCheckKeyCompleter;
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
            answer = completeUnderstandingCheckKey(answer);
            answer = PromptLeakFilter.stripNumberedCurriculum(answer);
        }
        return answer;
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
        if (!UnderstandingCheckKeyCompleter.missingAnswerKey(withLocalKey)) {
            return withLocalKey;
        }
        try {
            String patch = chatService.generateUtility(UnderstandingCheckKeyCompleter.patchPrompt(withLocalKey));
            String completed = UnderstandingCheckKeyCompleter.applyPatch(withLocalKey, patch);
            if (UnderstandingCheckKeyCompleter.missingAnswerKey(completed)) {
                log.warn("Understanding-check quiz is still missing Đáp án after patch");
            }
            return completed;
        } catch (Exception error) {
            log.warn("Could not complete understanding-check answer key: {}", error.getMessage());
            return withLocalKey;
        }
    }

    private String completeLessonExplanation(String answer, String question, String courseContext) {
        if (!LessonExplanationCompleter.missingLessonBody(answer)) {
            return answer;
        }
        try {
            String generated = chatService.generateUtility(
                    LessonExplanationCompleter.lessonBodyPrompt(question, courseContext));
            String filled = LessonExplanationCompleter.prependExplanation(answer, generated);
            if (LessonExplanationCompleter.missingLessonBody(filled)) {
                log.warn("Lesson still missing explanation after completion pass");
            } else {
                log.info("Filled missing lesson explanation before quiz");
            }
            return filled;
        } catch (Exception error) {
            log.warn("Could not complete lesson explanation: {}", error.getMessage());
            return answer;
        }
    }

    private String completeLessonUnderstandingCheck(String answer, String question, String courseContext) {
        if (LessonUnderstandingCheckCompleter.hasUsableCheck(answer)) {
            return answer;
        }
        try {
            String generated = chatService.generateUtility(
                    LessonUnderstandingCheckCompleter.generationPrompt(question, courseContext));
            String completed = LessonUnderstandingCheckCompleter.insert(answer, generated);
            if (!LessonUnderstandingCheckCompleter.hasUsableCheck(completed)) {
                log.warn("Lesson is still missing a usable understanding check after completion pass");
            } else {
                log.info("Filled missing lesson understanding check from grounded course context");
            }
            return completed;
        } catch (Exception error) {
            log.warn("Could not complete lesson understanding check: {}", error.getMessage());
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
