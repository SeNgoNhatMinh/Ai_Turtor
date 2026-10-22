package com.ragapi.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AdaptiveLearningReviewDecisionRequest;
import com.ragapi.dto.AdaptiveStudentLabelOverview;
import com.ragapi.dto.PedagogicalDirectiveRequest;
import com.ragapi.dto.StudentCourseLearningSummary;
import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.PedagogicalDirective;
import com.ragapi.repository.AdaptiveLearningReviewRepository;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;

import java.time.LocalDateTime;
import java.util.*;

import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdaptiveLearningReviewService {
    private static final int CYCLE_SIZE = 10;
    public static final String TRIGGER_CYCLE = "CYCLE_10";
    public static final String TRIGGER_EARLY_REPEATED_MISTAKES = "EARLY_REPEATED_MISTAKES";
    /** Wrong answers on the same concept that justify an early (pre-cycle) review. */
    private static final int EARLY_SAME_CONCEPT_WRONG_THRESHOLD = 2;
    /** Total wrong answers in the open cycle that justify an early review. */
    private static final int EARLY_TOTAL_WRONG_THRESHOLD = 3;
    private static final Set<String> LEVELS = Set.of("HIGH_SUPPORT", "STANDARD", "CHALLENGE");
    private static final Set<String> DECISIONS = Set.of("APPROVE", "MODIFY", "REJECT");

    private final AdaptiveLearningReviewRepository reviewRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ClassSectionRepository classSectionRepository;
    private final ClassRosterService classRosterService;
    private final RealtimeEventService realtimeEvents;
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final OpenRouterChatService chatService;
    private final ObjectMapper objectMapper;
    private final PedagogicalDirectiveService directiveService;

    /**
     * Called after a student question (and its answer) is durably saved. Every
     * {@link #CYCLE_SIZE} questions a student asks within one course triggers an
     * AI review for that student in that course only; counts never mix across
     * courses. Reviews are idempotent per student/course/question count, and a
     * failed LLM assessment never affects the chat flow.
     */
    @Async("adaptiveReviewExecutor")
    public void onStudentQuestionAnswered(String studentId, String courseId, String classId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) return;
        String safeStudentId = studentId.trim();
        String safeCourseId = courseId.trim();
        try {
            List<AiConversation> conversations =
                    conversationRepository.findByUserIdAndCourseId(safeStudentId, safeCourseId);
            List<String> conversationIds = conversations.stream()
                    .map(AiConversation::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            if (conversationIds.isEmpty()) return;

            long totalQuestions = messageRepository.countByConversationIdInAndRole(conversationIds, "STUDENT");
            if (totalQuestions == 0) return;
            // Evaluate the latest completed 10-question milestone. If the exact
            // milestone event was missed (deploy gap, async failure), the next
            // question catches up instead of losing that cycle forever — the
            // support level must be able to move both ways at every milestone.
            int questionCount = (int) (totalQuestions - (totalQuestions % CYCLE_SIZE));
            if (questionCount == 0) return;
            if (reviewRepository.findByStudentIdAndCourseIdAndQuestionCount(
                    safeStudentId, safeCourseId, questionCount).isPresent()) return;
            // Legacy session-based reviews may already cover the same numeric cycle.
            if (reviewRepository.findByStudentIdAndCourseIdAndCompletedSessionCount(
                    safeStudentId, safeCourseId, questionCount).isPresent()) return;

            String effectiveClassId = (classId != null && !classId.isBlank())
                    ? classId.trim()
                    : latestClassId(conversations);
            String currentLevel = directiveService.resolveSupportLevel(
                    safeStudentId, safeCourseId, effectiveClassId);
            List<AiMessage> cycleMessages = latestQuestionCycleMessages(conversationIds);
            createReview(safeStudentId, safeCourseId, effectiveClassId, questionCount,
                    cycleMessages, currentLevel, TRIGGER_CYCLE);
        } catch (Exception error) {
            // Review processing must not make asking a question fail.
            log.error("Adaptive learning review failed for student {} in course {}: {}",
                    safeStudentId, safeCourseId, error.getMessage(), error);
        }
    }

    /**
     * Layer 1 (event-based detection, no LLM): called after an
     * understanding-check answer is stored. Lightweight rules look for
     * repeated mistakes inside the open cycle — at least
     * {@link #EARLY_SAME_CONCEPT_WRONG_THRESHOLD} wrong answers on the same
     * concept, or {@link #EARLY_TOTAL_WRONG_THRESHOLD} wrong answers overall.
     * A single wrong answer is only recorded as evidence. When a rule fires,
     * an early adaptive review runs immediately instead of waiting for the
     * 10-question milestone; at most one early review runs per open cycle.
     */
    @Async("adaptiveReviewExecutor")
    public void onUnderstandingCheckRecorded(String studentId, String courseId, String classId) {
        if (studentId == null || studentId.isBlank() || courseId == null || courseId.isBlank()) return;
        String safeStudentId = studentId.trim();
        String safeCourseId = courseId.trim();
        try {
            List<AiConversation> conversations =
                    conversationRepository.findByUserIdAndCourseId(safeStudentId, safeCourseId);
            List<String> conversationIds = conversations.stream()
                    .map(AiConversation::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            if (conversationIds.isEmpty()) return;

            long totalQuestions = messageRepository.countByConversationIdInAndRole(conversationIds, "STUDENT");
            // Exact milestones are handled by the regular cycle review.
            if (totalQuestions == 0 || totalQuestions % CYCLE_SIZE == 0) return;
            long openCycleStart = totalQuestions - (totalQuestions % CYCLE_SIZE);

            List<AiMessage> window = currentCycleWindowMessages(conversationIds, totalQuestions);
            // A previous early review in this cycle must not silence the rest
            // of the cycle: re-evaluate when at least 2 new wrong answers were
            // recorded after it. Without new mistakes, stay quiet.
            var latestCycleReview = reviewRepository
                    .findByStudentIdAndCourseIdOrderByCreatedAtDesc(safeStudentId, safeCourseId)
                    .stream()
                    .filter(review -> review.getQuestionCount() != null
                            && review.getQuestionCount() > openCycleStart
                            && review.getQuestionCount() <= totalQuestions)
                    .findFirst();
            if (latestCycleReview.isPresent()) {
                LocalDateTime reviewedAt = latestCycleReview.get().getCreatedAt();
                long newWrong = 0;
                for (AiMessage message : window) {
                    for (var attempt : answeredAttempts(message)) {
                        if (Boolean.FALSE.equals(attempt.getCorrect())
                                && (reviewedAt == null || attempt.getAnsweredAt() == null
                                        || attempt.getAnsweredAt().isAfter(reviewedAt))) {
                            newWrong++;
                        }
                    }
                }
                if (newWrong < 2) return;
            }

            Map<String, Long> wrongByConcept = new LinkedHashMap<>();
            long totalWrong = 0;
            for (AiMessage message : window) {
                for (var attempt : answeredAttempts(message)) {
                    if (!Boolean.FALSE.equals(attempt.getCorrect())) continue;
                    totalWrong++;
                    wrongByConcept.merge(normalizeConceptKey(attempt), 1L, Long::sum);
                }
            }
            boolean repeatedSameConcept = wrongByConcept.values().stream()
                    .anyMatch(count -> count >= EARLY_SAME_CONCEPT_WRONG_THRESHOLD);
            if (!repeatedSameConcept && totalWrong < EARLY_TOTAL_WRONG_THRESHOLD) return;

            String effectiveClassId = (classId != null && !classId.isBlank())
                    ? classId.trim()
                    : latestClassId(conversations);
            String currentLevel = directiveService.resolveSupportLevel(
                    safeStudentId, safeCourseId, effectiveClassId);
            log.info("Early adaptive review triggered for student {} in course {}: "
                            + "wrongAnswers={}, byConcept={}, totalQuestions={}",
                    safeStudentId, safeCourseId, totalWrong, wrongByConcept, totalQuestions);
            createReview(safeStudentId, safeCourseId, effectiveClassId, (int) totalQuestions,
                    window, currentLevel, TRIGGER_EARLY_REPEATED_MISTAKES);
        } catch (Exception error) {
            log.error("Early adaptive review detection failed for student {} in course {}: {}",
                    safeStudentId, safeCourseId, error.getMessage(), error);
        }
    }

    /** Concept key for grouping repeated mistakes: the normalized quiz question text. */
    private String normalizeConceptKey(com.ragapi.dto.UnderstandingCheckAttempt attempt) {
        String question = attempt.getCheck() == null
                ? "" : String.valueOf(attempt.getCheck().getQuestion());
        return normalizeConceptText(question, "attempt:" + attempt.getAttemptId());
    }

    private String normalizeConceptText(String question, String fallback) {
        String normalized = String.valueOf(question == null ? "" : question).toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim().replaceAll("\\s+", " ");
        return normalized.isBlank() ? fallback : normalized;
    }

    /**
     * Every quiz attempt the student actually answered on this message.
     * New messages store one attempt per quiz item; legacy messages only
     * have the singular first-item fields, which map to attempt 0.
     */
    static List<com.ragapi.dto.UnderstandingCheckAttempt> answeredAttempts(AiMessage message) {
        return allAttempts(message).stream()
                .filter(attempt -> attempt.getSelectedKey() != null && !attempt.getSelectedKey().isBlank())
                .toList();
    }

    /**
     * Every quiz item attached to this message, answered or not. An item the
     * student never answered is a recorded "skipped" attempt (no selection),
     * which is evidence of non-completion — never of a wrong answer. Legacy
     * messages only carry the singular first-item payload, which maps to
     * attempt 0 whether it was answered or skipped.
     */
    static List<com.ragapi.dto.UnderstandingCheckAttempt> allAttempts(AiMessage message) {
        List<com.ragapi.dto.UnderstandingCheckAttempt> attempts = message.getUnderstandingCheckAttempts();
        if (attempts != null && !attempts.isEmpty()) {
            return attempts;
        }
        if (message.getUnderstandingCheck() != null) {
            var legacy = new com.ragapi.dto.UnderstandingCheckAttempt();
            legacy.setQuizIndex(0);
            legacy.setAttemptId(message.getUnderstandingAttemptId());
            legacy.setCheck(message.getUnderstandingCheck());
            legacy.setSelectedKey(message.getUnderstandingSelectedKey());
            legacy.setCorrect(message.getUnderstandingCorrect());
            legacy.setAnsweredAt(message.getUnderstandingAnsweredAt());
            return List.of(legacy);
        }
        return List.of();
    }

    /** Messages of the current (possibly incomplete) cycle, after the last completed milestone. */
    private List<AiMessage> currentCycleWindowMessages(List<String> conversationIds, long totalQuestions) {
        List<AiMessage> messages = sortedCourseMessages(conversationIds);
        long skipQuestions = totalQuestions - (totalQuestions % CYCLE_SIZE);
        if (skipQuestions <= 0) return messages;
        int studentSeen = 0;
        int start = 0;
        for (int index = 0; index < messages.size(); index++) {
            if (!"STUDENT".equalsIgnoreCase(messages.get(index).getRole())) continue;
            studentSeen++;
            if (studentSeen == skipQuestions + 1) {
                start = index;
                break;
            }
        }
        return messages.subList(start, messages.size());
    }

    private List<AiMessage> sortedCourseMessages(List<String> conversationIds) {
        return messageRepository
                .findByConversationIdInOrderByCreatedAtAsc(conversationIds)
                .stream()
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .filter(message -> Set.of("STUDENT", "ASSISTANT").contains(
                        message.getRole() == null ? "" : message.getRole().toUpperCase(Locale.ROOT)))
                .sorted(Comparator.comparing(AiMessage::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private String latestClassId(List<AiConversation> conversations) {
        return conversations.stream()
                .filter(conversation -> conversation.getClassId() != null && !conversation.getClassId().isBlank())
                .max(Comparator.comparing(
                        AiConversation::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(conversation -> conversation.getClassId().trim())
                .orElse(null);
    }

    /** Messages from the start of the latest block of {@link #CYCLE_SIZE} student questions. */
    private List<AiMessage> latestQuestionCycleMessages(List<String> conversationIds) {
        List<AiMessage> messages = messageRepository
                .findByConversationIdInOrderByCreatedAtAsc(conversationIds)
                .stream()
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .filter(message -> Set.of("STUDENT", "ASSISTANT").contains(
                        message.getRole() == null ? "" : message.getRole().toUpperCase(Locale.ROOT)))
                .sorted(Comparator.comparing(AiMessage::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        int studentSeen = 0;
        int cycleStart = 0;
        for (int index = messages.size() - 1; index >= 0; index--) {
            if (!"STUDENT".equalsIgnoreCase(messages.get(index).getRole())) continue;
            studentSeen++;
            if (studentSeen == CYCLE_SIZE) {
                cycleStart = index;
                break;
            }
        }
        return messages.subList(cycleStart, messages.size());
    }

    private void createReview(String studentId, String courseId, String classId, int questionCount,
                              List<AiMessage> cycleMessages, String currentSupportLevel, String triggerType) {
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> evidence = buildEvidence(cycleMessages);
        String transcriptForModel = evidence.stream().limit(36).map(item -> {
            if ("STUDENT_ANSWER".equals(item.get("kind"))) {
                Object correct = item.get("correct");
                if (correct == null) {
                    return "[Kiểm tra hiểu bài: \"" + item.get("quizQuestion") + "\""
                            + " | Kết quả: BỎ QUA (sinh viên không trả lời)]";
                }
                return "[Đáp án sinh viên - Kiểm tra hiểu bài: \"" + item.get("quizQuestion") + "\""
                        + " | Sinh viên chọn: " + item.getOrDefault("selectedKey", "")
                        + " | Đáp án đúng: " + item.getOrDefault("correctKey", "")
                        + " | Kết quả: " + (Boolean.TRUE.equals(correct) ? "ĐÚNG" : "SAI") + "]";
            }
            return item.get("role") + ": " + item.get("content");
        }).reduce((a, b) -> a + "\n" + b).orElse("");
        String prompt = """
                You are an evidence-based learning progress reviewer and adaptive
                support-level decision engine for an AI Tutor.

                Your task is to evaluate the student's demonstrated learning from the
                provided conversation evidence and determine the most appropriate
                support level for the next learning cycle.

                You must use evidence-based reasoning, avoid unsupported conclusions,
                and produce a valid JSON response that the backend can parse reliably.

                ==================================================
                1. OUTPUT CONTRACT
                ==================================================

                Return ONLY one valid JSON object with exactly these 9 keys:

                knowledgePercent
                practicePercent
                independencePercent
                confidencePercent
                summary
                strengths
                knowledgeGaps
                teachingRecommendations
                suggestedSupportLevel

                The required output schema consists of exactly these 9 keys.
                Do not add overallPercent or other keys.

                Data types:
                - knowledgePercent: integer from 0 to 100.
                - practicePercent: integer from 0 to 100.
                - independencePercent: integer from 0 to 100.
                - confidencePercent: integer from 0 to 100.
                - summary: short Vietnamese string.
                - strengths: array of short Vietnamese strings.
                - knowledgeGaps: array of short Vietnamese strings.
                - teachingRecommendations: array of actionable Vietnamese strings.
                - suggestedSupportLevel: exactly one of HIGH_SUPPORT, STANDARD, CHALLENGE.

                All explanatory text and array items must be in Vietnamese.
                Do not return Markdown, code fences, comments, or text outside JSON.
                Ensure valid JSON syntax, proper escaping and correct data types.

                ==================================================
                2. INPUT CONTEXT
                ==================================================

                Course: %s
                Current support level: %s
                Student questions in this cycle (this course only): %d
                Evidence excerpts:
                %s

                The input may contain student questions, student answers, quiz results,
                code attempts, corrections, assistant explanations and previous learning
                activities.

                Use only the evidence actually provided.
                Do not assume that omitted data exists.

                ==================================================
                3. EVIDENCE RULES
                ==================================================

                3.1. Student questions

                Asking questions, requesting explanations, requesting examples or asking
                for help does not by itself demonstrate poor mastery.

                A student may ask questions because they are curious, exploring advanced
                concepts or checking their understanding.

                Never use question count alone to lower a learning percentage or increase
                the level of support.

                3.2. Assistant explanations

                Assistant-generated explanations, code, examples and solutions are not
                evidence that the student understood or independently mastered the topic.

                Do not award mastery simply because the assistant gave a correct answer.

                Look for subsequent student explanations, independent solutions,
                corrections, quiz answers or practical applications.

                3.3. Understanding-check quizzes

                Lines marked [Kiểm tra hiểu bài ...] represent understanding-check quizzes.

                Treat the result marked "Kết quả: SAI" as direct evidence that the student
                answered that particular question incorrectly.

                When a quiz answer is incorrect:
                - Identify the specific topic or concept tested.
                - Record the relevant topic in knowledgeGaps.
                - Consider the difficulty and relevance of the question.
                - Check for other evidence that supports or contradicts the apparent gap.
                - Do not automatically conclude that the student has a persistent gap
                  from one isolated mistake.

                A correct quiz answer is evidence of performance on that question.
                It does not prove complete mastery of the entire topic.

                Lines marked "Kết quả: BỎ QUA" mean the student never answered
                that quiz item. A skipped quiz is missing evidence, NOT a wrong
                answer: never count it as incorrect, never put its topic in
                knowledgeGaps for that reason alone. Frequent skipping may be
                mentioned neutrally in the summary.

                3.4. Independent student work

                Give greater weight to evidence such as:
                - Correct explanations written by the student.
                - Independent problem-solving.
                - Student-authored code and debugging attempts.
                - Successful practical applications.
                - Corrected mistakes followed by successful independent attempts.
                - Consistent understanding across different learning activities.

                Distinguish independent work from work completed after the assistant
                provided the answer or walked the student through the solution.

                3.5. Evidence relevance

                Use evidence related to the specified course only.

                Do not treat unrelated conversations as evidence of mastery or difficulty
                in this course.

                Do not fabricate grades, quiz results, events, student attempts,
                learning history, mastery trends or supporting evidence.

                3.6. Conflicting or insufficient evidence

                When evidence is sparse, contradictory or unrepresentative, acknowledge
                the limitation in summary.

                Do not interpret missing evidence as evidence of failure.

                Do not interpret the absence of recorded mistakes as evidence of mastery.

                When evidence is insufficient to justify a change, prefer the current
                support level if it is valid and appropriate. If the current level is
                unavailable or invalid, use STANDARD.

                ==================================================
                4. LEARNING ASSESSMENT
                ==================================================

                A. knowledgePercent

                Estimate demonstrated conceptual understanding of the course topics.

                Consider:
                - Accuracy of the student's own explanations.
                - Ability to distinguish related concepts.
                - Correct answers to understanding-check quizzes.
                - Repeated conceptual misunderstandings.
                - Consistency of understanding across relevant activities.

                Do not award mastery merely because the assistant explained a concept.

                B. practicePercent

                Estimate the student's demonstrated ability to apply knowledge.

                Consider:
                - Student-authored code.
                - Independent problem-solving.
                - Practical task completion.
                - Ability to debug and correct errors.
                - Successful application of concepts to relevant problems.

                A request for code or an assistant-provided solution is not a successful
                student practice attempt.

                C. independencePercent

                Estimate the student's demonstrated ability to reason, solve problems
                and correct mistakes without direct answer-giving from the assistant.

                Consider:
                - Independent reasoning.
                - Ability to choose an appropriate solution.
                - Ability to explain why a solution works.
                - Successful application to a new but relevant problem.
                - Ability to recover from mistakes without receiving the complete answer.

                Do not assume dependence simply because the student asks questions.

                D. confidencePercent

                Estimate confidence in the reliability of THIS REVIEW, not the student's
                self-confidence or learning mastery.

                Consider:
                - Amount of relevant evidence.
                - Directness of student-generated evidence.
                - Evidence quality and representativeness.
                - Consistency across activities.
                - Availability of quiz results and independent attempts.
                - Presence of contradictory evidence.

                Confidence should generally increase when multiple independent and
                relevant observations support the same conclusion.

                Confidence should decrease when evidence is sparse, indirect,
                contradictory or dominated by assistant-generated content.

                Do not assign high confidence solely because many conversation messages
                are present.

                E. Percentage calibration

                All four percentages must be integers between 0 and 100.

                Use conservative estimates that reflect the available evidence.

                Do not imply that these percentages are calibrated probabilities or
                official grades.

                When evidence is insufficient, avoid false precision. Explain the
                limitation in summary and reduce confidencePercent appropriately.

                Do not calculate learning percentages from question count alone.

                Do not include confidencePercent in any calculation of learning mastery
                or support-level selection.

                ==================================================
                5. AUTOMATIC SUPPORT-LEVEL ADAPTATION
                ==================================================

                The system must automatically determine the most appropriate target
                support level for the next learning cycle.

                Available levels:

                HIGH_SUPPORT:
                Structured explanations, step-by-step guidance, additional examples,
                smaller learning steps and frequent understanding checks.

                STANDARD:
                Balanced explanations, guided practice, normal levels of assistance
                and opportunities for independent reasoning.

                CHALLENGE:
                More complex problems, fewer direct hints, greater independence and
                opportunities to apply concepts in unfamiliar but relevant contexts.

                5.1. HIGH_SUPPORT decision

                Recommend HIGH_SUPPORT when relevant direct evidence indicates that the
                student needs more structured guidance.

                Examples:
                - Repeated incorrect understanding-check answers on important concepts.
                - Repeated conceptual misunderstandings across relevant activities.
                - Difficulty applying basic concepts despite appropriate opportunities.
                - Repeated inability to solve relevant problems without substantial help.

                Do not recommend HIGH_SUPPORT solely because:
                - The student asks many questions.
                - The student requests an example.
                - The student makes one isolated mistake.
                - The assistant's explanation is long.
                - There is insufficient evidence of mastery.

                5.2. STANDARD decision

                Recommend STANDARD when:
                - The student demonstrates reasonable understanding with ordinary help.
                - Evidence is mixed or inconsistent.
                - The student has some gaps but not enough evidence to justify intensive
                support.
                - The evidence is insufficient to confidently justify HIGH_SUPPORT
                or CHALLENGE.
                - The student is already learning effectively at STANDARD.

                STANDARD is the default when evidence is insufficient.

                However, do not automatically replace a valid current level with STANDARD
                when there is no sufficient evidence to justify changing that level.

                5.3. CHALLENGE decision

                Recommend CHALLENGE only when multiple relevant pieces of evidence
                demonstrate:
                - Reliable conceptual understanding.
                - Successful application of knowledge.
                - Independent reasoning and problem-solving.
                - Consistent performance across relevant activities.

                The absence of mistakes alone is not sufficient.

                A high knowledgePercent alone is not sufficient if practicePercent or
                independencePercent indicates substantial difficulty.

                Do not recommend CHALLENGE based only on assistant-generated solutions,
                the number of questions asked or one successful answer.

                5.4. Use all learning dimensions

                Consider knowledgePercent, practicePercent and independencePercent
                together with the underlying evidence.

                Do not use a single percentage as the sole decision criterion.

                Do not use confidencePercent as a measure of student ability.

                When evidence supports a learning gap, teachingRecommendations should
                describe an appropriate intervention for that gap.

                When evidence supports greater independence, teachingRecommendations
                should propose more demanding practice rather than merely reducing
                explanations.

                5.5. Current-level comparison and stability

                Compare the selected target level with the supplied current support level.

                If the evidence supports retaining the current level, return that level.

                Do not change support levels in response to a single isolated mistake,
                one unusually successful answer or a temporary performance fluctuation.

                Prefer consistent evidence across multiple relevant learning activities.

                Do not force a support-level change after every review cycle.

                When evidence does not justify a change, preserve the current valid level.

                If the current level is invalid or unavailable, return STANDARD unless
                the evidence clearly justifies another level.

                5.6. Avoid unsupported transitions

                HIGH_SUPPORT to STANDARD:
                Require evidence of improved understanding or practice sufficient to
                show that intensive guidance may no longer be necessary.

                STANDARD to CHALLENGE:
                Require evidence of reliable knowledge, successful application and
                independent reasoning.

                CHALLENGE to STANDARD:
                Recommend when evidence indicates that the student benefits from more
                balanced guidance or cannot consistently handle the current challenge.

                STANDARD to HIGH_SUPPORT:
                Recommend when direct evidence indicates persistent or significant
                learning difficulties requiring more structured guidance.

                HIGH_SUPPORT to CHALLENGE:
                Require clear and consistent evidence that the student can learn and
                solve relevant problems independently. Do not skip the evidence review
                merely because a single score is high.

                CHALLENGE to HIGH_SUPPORT:
                Recommend when multiple relevant observations demonstrate significant
                difficulty that makes more structured support appropriate.

                These transitions are evidence-based recommendations, not rigid rules
                that override the actual evidence.

                ==================================================
                6. TEACHER AUTHORITY AND AUTOMATION SAFETY
                ==================================================

                The AI produces a support-level recommendation. The backend is responsible
                for determining whether the recommendation may be applied automatically.

                An active teacher-defined support level or pedagogical directive takes
                precedence over the AI recommendation.

                Never overwrite a teacher-controlled setting.

                Never claim that the support level has changed unless the backend confirms
                that the change has been persisted successfully.

                The backend must distinguish between:
                - AI-recommended target level.
                - Current effective support level.
                - Teacher-controlled support level or directive.
                - Actual support level applied to future tutoring sessions.

                If teacher approval is required by the system's policy, return the
                recommendation for teacher review instead of applying it automatically.

                If automatic adaptation is permitted and no higher-priority teacher
                setting blocks it, the backend may apply the recommended target level.

                The backend should record the previous level, target level, review time,
                evidence reference, reason for the decision and whether the change was
                applied, rejected or overridden by a teacher.

                ==================================================
                7. SUMMARY AND RECOMMENDATIONS
                ==================================================

                summary:
                Provide a concise Vietnamese explanation of the student's demonstrated
                learning, the most important evidence and any significant limitations.

                strengths:
                List only strengths supported by direct evidence.

                knowledgeGaps:
                List specific concepts or skills that the student has not demonstrated
                reliably or answered incorrectly in the provided evidence.

                Do not invent gaps from unanswered questions or missing evidence.

                If no specific gap can be established, return an empty array.

                teachingRecommendations:
                Provide actionable Vietnamese recommendations linked to the observed
                strengths or gaps.

                Recommendations may include:
                - Revisiting a specific concept.
                - Giving a smaller worked example.
                - Providing a targeted understanding-check question.
                - Assigning an independent practice task.
                - Increasing problem difficulty when mastery is demonstrated.

                Do not recommend a quiz result, activity or intervention as if it has
                already happened.

                suggestedSupportLevel:
                Return exactly one of HIGH_SUPPORT, STANDARD or CHALLENGE.

                It represents the target support level recommended for the next learning
                cycle after considering the evidence and the current support level.

                It does not claim that the backend has applied the change.

                ==================================================
                8. FINAL VALIDATION
                ==================================================

                Before returning the response, verify internally that:
                - The output is valid JSON.
                - All required keys are present exactly once.
                - No additional keys are present.
                - All four percentages are integers from 0 to 100.
                - All arrays contain short Vietnamese strings.
                - suggestedSupportLevel is one of the three permitted values.
                - All claims are supported by the provided evidence.
                - Assistant-generated explanations are not treated as student mastery.
                - Incorrect understanding-check quiz results are considered appropriately.
                - Insufficient evidence does not produce an unjustified support change.
                - Teacher authority is respected.
                - No text appears outside the JSON object.

                Return ONLY the JSON object.
                """.formatted(courseId, currentSupportLevel, CYCLE_SIZE, transcriptForModel);
        Map<String, Object> assessment;
        String failure = null;
        try {
            String raw = chatService.generateUtility(prompt);
            assessment = objectMapper.readValue(extractJson(raw), new TypeReference<>() {});
            validateAssessment(assessment);
        } catch (Exception error) {
            failure = "Không thể hoàn tất đánh giá tự động: " + safeMessage(error);
            assessment = fallbackAssessment(currentSupportLevel);
        }

        if (failure == null) assessment.put("confidencePercent", evidenceCompletenessPercent(evidence));
        // The prompt contract has no overallPercent: the backend derives it
        // from the three learning dimensions so the UI keeps one summary score.
        assessment.put("overallPercent", Math.round(
                (number(assessment.get("knowledgePercent"), 0)
                        + number(assessment.get("practicePercent"), 0)
                        + number(assessment.get("independencePercent"), 0)) / 3.0f));
        AdaptiveLearningReview previousReview = reviewRepository
                .findByStudentIdAndCourseIdOrderByCreatedAtDesc(studentId, courseId)
                .stream().findFirst().orElse(null);
        String suggested = decideTargetLevel(assessment, currentSupportLevel, previousReview, evidence);
        AdaptiveLearningReview review = AdaptiveLearningReview.builder()
                .id(UUID.randomUUID().toString())
                .studentId(studentId)
                .courseId(courseId)
                .classId(classId)
                .triggerType(triggerType == null ? TRIGGER_CYCLE : triggerType)
                .questionCount(questionCount)
                .completedSessionCount(questionCount)
                .sessionIds(evidence.stream()
                        .map(item -> String.valueOf(item.get("conversationId")))
                        .distinct()
                        .toList())
                .status("PENDING")
                .currentSupportLevel(normalizeLevel(currentSupportLevel, "STANDARD"))
                .suggestedSupportLevel(suggested)
                .overallPercent(number(assessment.get("overallPercent"), 0))
                .knowledgePercent(number(assessment.get("knowledgePercent"), 0))
                .practicePercent(number(assessment.get("practicePercent"), 0))
                .independencePercent(number(assessment.get("independencePercent"), 0))
                .confidencePercent(number(assessment.get("confidencePercent"), 0))
                .summary(string(assessment.get("summary"), "Chưa có tóm tắt đánh giá."))
                .strengths(strings(assessment.get("strengths")))
                .knowledgeGaps(strings(assessment.get("knowledgeGaps")))
                .teachingRecommendations(strings(assessment.get("teachingRecommendations")))
                .evidence(evidence)
                .evaluationError(failure)
                .createdAt(now)
                .updatedAt(now)
                .build();
        AdaptiveLearningReview saved = reviewRepository.save(review);
        log.info("Adaptive learning review created: student={}, course={}, questionCount={}, "
                        + "suggestedLevel={}, confidence={}%",
                studentId, courseId, questionCount, saved.getSuggestedSupportLevel(),
                saved.getConfidencePercent());
        applySupportLevelAutomatically(saved);
        publishReviewCreated(saved);
    }

    /**
     * The AI applies its suggested support level immediately (no waiting for
     * teacher approval) by confirming a system directive for the student.
     * The safety gate already ran in {@link #chooseSupportLevel}: weak
     * evidence keeps the current level, so an unchanged level applies
     * nothing. Previous AI-applied directives are archived first so exactly
     * one AI directive is active; a teacher decision later supersedes or
     * reverts it.
     */
    private void applySupportLevelAutomatically(AdaptiveLearningReview review) {
        if (review.getEvaluationError() != null && !review.getEvaluationError().isBlank()) return;
        if (review.getClassId() == null || review.getClassId().isBlank()) return;
        String suggested = normalizeLevel(review.getSuggestedSupportLevel(), "STANDARD");
        String current = normalizeLevel(review.getCurrentSupportLevel(), "STANDARD");
        if (suggested.equals(current)) return;
        try {
            directiveService.archiveAutoAppliedDirectives(
                    review.getStudentId(), review.getCourseId(), review.getClassId());
            PedagogicalDirectiveRequest directiveRequest = new PedagogicalDirectiveRequest();
            directiveRequest.setStudentId(review.getStudentId());
            directiveRequest.setCourseId(review.getCourseId());
            directiveRequest.setClassId(review.getClassId());
            directiveRequest.setTopic(String.join(", ", safeList(review.getKnowledgeGaps())));
            directiveRequest.setInstruction(buildAutoAppliedInstruction(review, suggested));
            directiveRequest.setSupportLevel(suggested);
            directiveRequest.setPriority(85);
            PedagogicalDirective draft = directiveService.createDraft(
                    directiveRequest, PedagogicalDirectiveService.AI_ACTOR_ID, "AI Tutor (tự động)");
            PedagogicalDirective confirmed = directiveService.confirm(
                    draft.getId(), PedagogicalDirectiveService.AI_ACTOR_ID);
            review.setAppliedDirectiveId(confirmed.getId());
            review.setUpdatedAt(LocalDateTime.now());
            reviewRepository.save(review);
            log.info("AI auto-applied support level {} for student {} in course {} (directive {})",
                    suggested, review.getStudentId(), review.getCourseId(), confirmed.getId());
            publishSupportLevelChanged(review, suggested);
        } catch (Exception error) {
            log.warn("Could not auto-apply support level for review {}: {}",
                    review.getId(), error.getMessage());
        }
    }

    private String buildAutoAppliedInstruction(AdaptiveLearningReview review, String suggested) {
        StringBuilder text = new StringBuilder("AI Tutor tự đổi mức hỗ trợ sang ")
                .append(suggested)
                .append(" sau ").append(review.getQuestionCount() != null
                        ? review.getQuestionCount()
                        : review.getCompletedSessionCount())
                .append(" câu hỏi trong môn (điểm tổng hợp ")
                .append(percentOrZero(review.getOverallPercent()))
                .append("%, độ đầy đủ bằng chứng ")
                .append(percentOrZero(review.getConfidencePercent()))
                .append("%). Đề xuất giảng dạy: ")
                .append(String.join("; ", safeList(review.getTeachingRecommendations())));
        if (!safeList(review.getKnowledgeGaps()).isEmpty()) {
            text.append(". Lỗ hổng cần củng cố: ").append(String.join(", ", review.getKnowledgeGaps()));
        }
        text.append(". Giảng viên có thể sửa mức hoặc từ chối đánh giá này tại màn hình Đánh giá tiến bộ; ")
                .append("quyết định của giảng viên sẽ thay thế chỉ dẫn tự động này.");
        return text.toString();
    }

    /** Pushes the new effective support level to the student's open pages. */
    private void publishSupportLevelChanged(AdaptiveLearningReview review, String effectiveLevel) {
        if (review.getStudentId() == null || review.getStudentId().isBlank()) return;
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("studentId", review.getStudentId());
            data.put("courseId", review.getCourseId() == null ? "" : review.getCourseId());
            data.put("classId", review.getClassId() == null ? "" : review.getClassId());
            data.put("supportLevel", effectiveLevel);
            data.put("previousLevel", review.getCurrentSupportLevel() == null
                    ? "" : review.getCurrentSupportLevel());
            data.put("reviewId", review.getId());
            realtimeEvents.publishToUser(review.getStudentId(), "SUPPORT_LEVEL_CHANGED",
                    "PEDAGOGICAL_DIRECTIVE",
                    review.getAppliedDirectiveId() == null ? review.getId() : review.getAppliedDirectiveId(),
                    effectiveLevel, data);
        } catch (Exception error) {
            log.warn("Could not publish SUPPORT_LEVEL_CHANGED for review {}: {}",
                    review.getId(), error.getMessage());
        }
    }

    /** Archives the AI auto-applied directive once a teacher decides on the review. */
    private void archiveAutoAppliedDirective(AdaptiveLearningReview review) {
        if (review.getAppliedDirectiveId() == null || review.getAppliedDirectiveId().isBlank()) return;
        try {
            directiveService.archiveIfPresent(review.getAppliedDirectiveId());
        } catch (Exception error) {
            log.warn("Could not archive auto-applied directive {}: {}",
                    review.getAppliedDirectiveId(), error.getMessage());
        }
    }

    private void publishReviewCreated(AdaptiveLearningReview review) {
        if (review.getClassId() == null || review.getClassId().isBlank()) return;
        classSectionRepository.findByCourseIdAndClassId(review.getCourseId(), review.getClassId())
                .map(section -> section.getTeacherId())
                .filter(teacherId -> teacherId != null && !teacherId.isBlank())
                .ifPresent(teacherId -> realtimeEvents.publishToUser(
                        teacherId,
                        "ADAPTIVE_LEARNING_REVIEW_CREATED",
                        "ADAPTIVE_LEARNING_REVIEW",
                        review.getId(),
                        review.getStatus(),
                        Map.of(
                                "reviewId", review.getId(),
                                "courseId", review.getCourseId(),
                                "classId", review.getClassId(),
                                "studentId", review.getStudentId(),
                                "overallPercent", review.getOverallPercent(),
                                "status", review.getStatus()
                        )));
    }

    public Optional<String> adaptiveSupportLevel(String studentId, String courseId, String classId) {
        return reviewRepository.findByStudentIdAndCourseIdAndClassIdOrderByCreatedAtDesc(studentId, courseId, classId)
                .stream()
                .filter(review -> review.getEvaluationError() == null || review.getEvaluationError().isBlank())
                .filter(review -> review.getConfidencePercent() != null && review.getConfidencePercent() >= 75)
                .filter(review -> Set.of("PENDING", "APPROVED").contains(
                        review.getStatus() == null ? "" : review.getStatus().toUpperCase(Locale.ROOT)))
                .map(review -> normalizeLevel(review.getSuggestedSupportLevel(), "STANDARD"))
                .findFirst();
    }

    /**
     * Evidence records only what the student did, nothing else: the questions
     * the student asked in chat (STUDENT_QUESTION) and one STUDENT_ANSWER per
     * quiz item the student answered (chosen option, correct option, right or
     * wrong). Full AI answers are not evidence of student learning and only
     * made this list noisy, so they are no longer stored here. Proactive
     * system messages (welcome/opening) are skipped as well.
     */
    private List<Map<String, Object>> buildEvidence(List<AiMessage> cycleMessages) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (AiMessage message : cycleMessages) {
            String role = message.getRole() == null ? "UNKNOWN" : message.getRole().toUpperCase(Locale.ROOT);
            if (Boolean.TRUE.equals(message.getProactive())) continue;

            if ("STUDENT".equals(role)) {
                Map<String, Object> item = baseEvidenceItem(message, role);
                item.put("kind", "STUDENT_QUESTION");
                item.put("content", truncate(message.getContent(), 1200));
                result.add(item);
                continue;
            }
            if (!"ASSISTANT".equals(role)) continue;

            for (var attempt : allAttempts(message)) {
                var quiz = attempt.getCheck();
                if (quiz == null) continue;
                boolean skipped = attempt.getSelectedKey() == null || attempt.getSelectedKey().isBlank();
                Map<String, Object> answer = baseEvidenceItem(message, "STUDENT");
                answer.put("kind", "STUDENT_ANSWER");
                answer.put("quizIndex", attempt.getQuizIndex());
                answer.put("attemptId", attempt.getAttemptId() == null ? "" : attempt.getAttemptId());
                answer.put("skipped", skipped);
                answer.put("content", skipped
                        ? "Câu kiểm tra " + (attempt.getQuizIndex() + 1)
                                + ": " + (quiz.getQuestion() == null ? "" : quiz.getQuestion())
                                + " — sinh viên bỏ qua (không trả lời)"
                        : "Câu kiểm tra " + (attempt.getQuizIndex() + 1)
                                + ": " + (quiz.getQuestion() == null ? "" : quiz.getQuestion())
                                + " — sinh viên chọn " + attempt.getSelectedKey()
                                + ", đáp án đúng " + (quiz.getCorrectKey() == null ? "" : quiz.getCorrectKey())
                                + " → " + (Boolean.TRUE.equals(attempt.getCorrect()) ? "ĐÚNG" : "SAI"));
                answer.put("quizQuestion", quiz.getQuestion() == null ? "" : quiz.getQuestion());
                answer.put("quizOptions", quiz.getOptions() == null ? List.of() : quiz.getOptions().stream()
                        .map(option -> Map.of(
                                "key", option.getKey() == null ? "" : option.getKey(),
                                "text", option.getText() == null ? "" : option.getText()))
                        .toList());
                answer.put("correctKey", quiz.getCorrectKey() == null ? "" : quiz.getCorrectKey());
                answer.put("selectedKey", skipped ? "" : attempt.getSelectedKey());
                // Keep null for skipped attempts: null means "not answered",
                // false would wrongly count the item as a wrong answer.
                answer.put("correct", skipped ? null : attempt.getCorrect());
                answer.put("quizExplanation", quiz.getExplanation() == null ? "" : quiz.getExplanation());
                answer.put("understandingCorrect", attempt.getCorrect());
                answer.put("answeredAt", attempt.getAnsweredAt() == null
                        ? null : attempt.getAnsweredAt().toString());
                result.add(answer);
            }
        }
        return result;
    }

    private Map<String, Object> baseEvidenceItem(AiMessage message, String role) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("messageId", message.getId());
        item.put("sessionId", message.getTutorSessionId() == null ? "" : message.getTutorSessionId());
        item.put("conversationId", message.getConversationId());
        item.put("role", role);
        item.put("topic", "");
        item.put("createdAt", message.getCreatedAt() == null ? null : message.getCreatedAt().toString());
        return item;
    }

    public List<AdaptiveLearningReview> listForTeacher(String courseId, String classId) {
        String safeCourse = requireText(courseId, "courseId");
        String safeClass = requireText(classId, "classId");
        List<AdaptiveLearningReview> reviews = reviewRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(safeCourse, safeClass);
        reviews.forEach(this::attachStudentIdentity);
        return reviews;
    }

    /**
     * Every enrolled student of the class with their latest AI label. Students
     * without any review are included with {@code labeled=false} and zeroed
     * percentages, plus their progress toward the next 10-question cycle.
     */
    public List<AdaptiveStudentLabelOverview> listStudentLabels(String courseId, String classId) {
        String safeCourse = requireText(courseId, "courseId");
        String safeClass = requireText(classId, "classId");

        Map<String, AdaptiveLearningReview> latestReviewByStudent = new LinkedHashMap<>();
        for (AdaptiveLearningReview review
                : reviewRepository.findByCourseIdAndClassIdOrderByCreatedAtDesc(safeCourse, safeClass)) {
            latestReviewByStudent.putIfAbsent(review.getStudentId(), review);
        }

        Map<String, CourseEnrollment> enrollmentByStudent = new LinkedHashMap<>();
        for (CourseEnrollment enrollment
                : enrollmentRepository.findByCourseIdAndClassId(safeCourse, safeClass)) {
            if (enrollment.getStudentId() != null && !enrollment.getStudentId().isBlank()) {
                enrollmentByStudent.putIfAbsent(enrollment.getStudentId(), enrollment);
            }
        }
        // Students with a review but no enrollment row should still be visible.
        for (String studentId : latestReviewByStudent.keySet()) {
            enrollmentByStudent.putIfAbsent(studentId, null);
        }

        List<AdaptiveStudentLabelOverview> result = new ArrayList<>();
        for (Map.Entry<String, CourseEnrollment> entry : enrollmentByStudent.entrySet()) {
            String studentId = entry.getKey();
            CourseEnrollment enrollment = entry.getValue();
            AdaptiveLearningReview latest = latestReviewByStudent.get(studentId);

            List<String> conversationIds = conversationRepository
                    .findByUserIdAndCourseId(studentId, safeCourse)
                    .stream()
                    .map(AiConversation::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            long totalQuestions = conversationIds.isEmpty()
                    ? 0
                    : messageRepository.countByConversationIdInAndRole(conversationIds, "STUDENT");

            String studentName = enrollment == null ? null : enrollment.getStudentName();
            String studentCode = enrollment == null ? null : enrollment.getStudentCode();
            String studentEmail = enrollment == null ? null : enrollment.getStudentEmail();
            if (studentName == null || studentName.isBlank()) {
                var identity = classRosterService.resolveStudent(studentId, safeCourse, safeClass);
                if (identity != null) {
                    studentName = identity.getStudentName();
                    studentCode = identity.getStudentCode();
                    studentEmail = identity.getStudentEmail();
                }
            }

            result.add(AdaptiveStudentLabelOverview.builder()
                    .studentId(studentId)
                    .studentName(studentName)
                    .studentCode(studentCode)
                    .studentEmail(studentEmail)
                    .courseId(safeCourse)
                    .classId(safeClass)
                    .totalQuestions(totalQuestions)
                    .questionsInCurrentCycle((int) (totalQuestions % CYCLE_SIZE))
                    .cycleSize(CYCLE_SIZE)
                    .labeled(latest != null)
                    .latestReviewId(latest == null ? null : latest.getId())
                    .reviewStatus(latest == null ? null : latest.getStatus())
                    .currentSupportLevel(latest == null
                            ? directiveService.resolveSupportLevel(studentId, safeCourse, safeClass)
                            : latest.getCurrentSupportLevel())
                    .suggestedSupportLevel(latest == null ? null : latest.getSuggestedSupportLevel())
                    .overallPercent(latest == null ? 0 : percentOrZero(latest.getOverallPercent()))
                    .knowledgePercent(latest == null ? 0 : percentOrZero(latest.getKnowledgePercent()))
                    .practicePercent(latest == null ? 0 : percentOrZero(latest.getPracticePercent()))
                    .independencePercent(latest == null ? 0 : percentOrZero(latest.getIndependencePercent()))
                    .confidencePercent(latest == null ? 0 : percentOrZero(latest.getConfidencePercent()))
                    .reviewQuestionCount(latest == null ? null
                            : (latest.getQuestionCount() != null
                                    ? latest.getQuestionCount()
                                    : latest.getCompletedSessionCount()))
                    .summary(latest == null ? null : latest.getSummary())
                    .reviewCreatedAt(latest == null ? null : latest.getCreatedAt())
                    .build());
        }
        // Students needing attention first: pending labels, then unlabeled
        // closest to the next cycle, then everyone else by name.
        result.sort(Comparator
                .comparingInt((AdaptiveStudentLabelOverview item) ->
                        "PENDING".equalsIgnoreCase(item.getReviewStatus() == null ? "" : item.getReviewStatus()) ? 0
                                : !item.isLabeled() ? 1 : 2)
                .thenComparing(item -> item.getStudentName() == null ? "" : item.getStudentName(),
                        String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    /**
     * Whole-history overview for one student in one course, generated on
     * demand for the teacher: deterministic chat/quiz statistics over every
     * conversation in the course (correct, wrong and skipped quizzes kept
     * separate), the support-level change history, and an AI narrative that
     * reads the full history. The narrative never changes the support level
     * by itself — level moves only happen in the 10-question cycle reviews
     * (or the early repeated-mistakes review), which can move one step in
     * either direction at every milestone.
     */
    public StudentCourseLearningSummary summarizeStudentCourse(String studentId, String courseId, String classId) {
        String safeStudentId = requireText(studentId, "studentId");
        String safeCourseId = requireText(courseId, "courseId");
        String safeClassId = (classId == null || classId.isBlank()) ? null : classId.trim();

        List<AiConversation> conversations =
                conversationRepository.findByUserIdAndCourseId(safeStudentId, safeCourseId);
        List<String> conversationIds = conversations.stream()
                .map(AiConversation::getId)
                .filter(id -> id != null && !id.isBlank())
                .toList();
        List<AiMessage> messages = conversationIds.isEmpty()
                ? List.of() : sortedCourseMessages(conversationIds);

        long totalQuestions = 0;
        long quizGiven = 0, quizAnswered = 0, quizCorrect = 0, quizWrong = 0, quizSkipped = 0;
        Map<String, long[]> conceptStats = new LinkedHashMap<>();
        List<String> recentQuestions = new ArrayList<>();
        List<String> historyLines = new ArrayList<>();
        for (AiMessage message : messages) {
            String role = message.getRole() == null ? "" : message.getRole().toUpperCase(Locale.ROOT);
            if ("STUDENT".equals(role)) {
                totalQuestions++;
                recentQuestions.add(truncate(message.getContent(), 200));
                historyLines.add("SV hỏi: " + truncate(message.getContent(), 300));
                continue;
            }
            if (!"ASSISTANT".equals(role) || Boolean.TRUE.equals(message.getProactive())) continue;
            for (var attempt : allAttempts(message)) {
                var quiz = attempt.getCheck();
                if (quiz == null || quiz.getQuestion() == null) continue;
                quizGiven++;
                boolean skipped = attempt.getSelectedKey() == null || attempt.getSelectedKey().isBlank();
                long[] stats = conceptStats.computeIfAbsent(quiz.getQuestion().trim(), key -> new long[2]);
                if (skipped) {
                    quizSkipped++;
                    stats[1]++;
                    historyLines.add("Kiểm tra \"" + truncate(quiz.getQuestion(), 150) + "\": BỎ QUA");
                } else if (Boolean.TRUE.equals(attempt.getCorrect())) {
                    quizAnswered++;
                    quizCorrect++;
                    historyLines.add("Kiểm tra \"" + truncate(quiz.getQuestion(), 150)
                            + "\": ĐÚNG (chọn " + attempt.getSelectedKey() + ")");
                } else {
                    quizAnswered++;
                    quizWrong++;
                    stats[0]++;
                    historyLines.add("Kiểm tra \"" + truncate(quiz.getQuestion(), 150)
                            + "\": SAI (chọn " + attempt.getSelectedKey()
                            + ", đúng " + (quiz.getCorrectKey() == null ? "" : quiz.getCorrectKey()) + ")");
                }
            }
        }
        if (recentQuestions.size() > 12) {
            recentQuestions = recentQuestions.subList(recentQuestions.size() - 12, recentQuestions.size());
        }
        List<Map<String, Object>> difficultConcepts = conceptStats.entrySet().stream()
                .filter(entry -> entry.getValue()[0] > 0 || entry.getValue()[1] > 0)
                .sorted((a, b) -> Long.compare(b.getValue()[0] + b.getValue()[1], a.getValue()[0] + a.getValue()[1]))
                .limit(8)
                .map(entry -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("concept", entry.getKey());
                    item.put("wrongCount", entry.getValue()[0]);
                    item.put("skippedCount", entry.getValue()[1]);
                    return item;
                })
                .toList();

        List<AdaptiveLearningReview> reviews = reviewRepository
                .findByStudentIdAndCourseIdOrderByCreatedAtDesc(safeStudentId, safeCourseId)
                .stream()
                .filter(review -> safeClassId == null || safeClassId.equals(review.getClassId()))
                .sorted(Comparator.comparing(AdaptiveLearningReview::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<Map<String, Object>> levelHistory = reviews.stream().map(review -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("reviewId", review.getId());
            item.put("questionCount", review.getQuestionCount() != null
                    ? review.getQuestionCount() : review.getCompletedSessionCount());
            item.put("triggerType", review.getTriggerType());
            item.put("fromLevel", review.getCurrentSupportLevel());
            item.put("toLevel", review.getSuggestedSupportLevel());
            item.put("status", review.getStatus());
            item.put("overallPercent", review.getOverallPercent());
            item.put("createdAt", review.getCreatedAt() == null ? null : review.getCreatedAt().toString());
            return item;
        }).toList();

        String currentLevel = directiveService.resolveSupportLevel(safeStudentId, safeCourseId, safeClassId);
        int correctPercent = quizAnswered == 0 ? 0 : (int) Math.round(100.0 * quizCorrect / quizAnswered);

        // The model reads the whole course history (most recent 90 evidence
        // lines when very long) plus the deterministic statistics above.
        List<String> modelLines = historyLines.size() > 90
                ? historyLines.subList(historyLines.size() - 90, historyLines.size()) : historyLines;
        String prompt = """
                Bạn là trợ lý phân tích học tập cho giảng viên. Hãy đọc TOÀN BỘ lịch sử
                học của một sinh viên trong một môn học và tóm tắt để giảng viên theo dõi.

                Trả về DUY NHẤT một JSON hợp lệ với đúng 5 khóa:
                summary (chuỗi tiếng Việt, 3-5 câu), strengths (mảng chuỗi tiếng Việt),
                knowledgeGaps (mảng chuỗi tiếng Việt), teachingRecommendations
                (mảng chuỗi tiếng Việt), trajectory (chuỗi tiếng Việt mô tả tiến bộ
                theo thời gian: đầu kỳ thế nào, gần đây thế nào).

                Quy tắc:
                - Chỉ dùng dữ kiện được cung cấp, không bịa số liệu hay sự kiện.
                - Câu kiểm tra "BỎ QUA" nghĩa là sinh viên không trả lời: KHÔNG tính
                  là trả lời sai, không suy ra lỗ hổng kiến thức từ việc bỏ qua; chỉ
                  nêu trung tính nếu sinh viên bỏ qua thường xuyên.
                - Câu trả lời/giải thích của AI Tutor không phải bằng chứng sinh viên
                  đã hiểu; chỉ câu hỏi, câu trả lời kiểm tra và việc sinh viên tự làm
                  mới là bằng chứng.
                - Không đề xuất đổi mức hỗ trợ trong bản tóm tắt này; mức hỗ trợ do
                  chu kỳ đánh giá 10 câu hỏi quyết định.

                Môn học: %s
                Tổng số câu hỏi sinh viên đã hỏi trong môn: %d
                Kiểm tra hiểu bài: đã ra %d câu, sinh viên trả lời %d (đúng %d, sai %d), bỏ qua %d câu.
                Mức hỗ trợ hiện tại: %s

                Lịch sử học (theo thứ tự thời gian):
                %s
                """.formatted(safeCourseId, totalQuestions, quizGiven, quizAnswered,
                quizCorrect, quizWrong, quizSkipped, currentLevel,
                modelLines.isEmpty() ? "(chưa có dữ liệu)" : String.join("\n", modelLines));

        String aiSummary;
        List<String> strengths = List.of();
        List<String> knowledgeGaps = List.of();
        List<String> recommendations = List.of();
        boolean modelGenerated = true;
        try {
            String raw = chatService.generateUtility(prompt);
            Map<String, Object> parsed = objectMapper.readValue(extractJson(raw), new TypeReference<>() {});
            String summary = string(parsed.get("summary"), "").trim();
            String trajectory = string(parsed.get("trajectory"), "").trim();
            aiSummary = trajectory.isBlank() ? summary
                    : (summary.isBlank() ? trajectory : summary + " " + trajectory);
            if (aiSummary.isBlank()) throw new IllegalArgumentException("Empty summary");
            strengths = strings(parsed.get("strengths"));
            knowledgeGaps = strings(parsed.get("knowledgeGaps"));
            recommendations = strings(parsed.get("teachingRecommendations"));
        } catch (Exception error) {
            modelGenerated = false;
            aiSummary = "Sinh viên đã hỏi " + totalQuestions + " câu trong môn " + safeCourseId
                    + ". Trong " + quizGiven + " câu kiểm tra hiểu bài, sinh viên đã trả lời "
                    + quizAnswered + " câu (đúng " + quizCorrect + ", sai " + quizWrong
                    + ") và bỏ qua " + quizSkipped + " câu. Mức hỗ trợ hiện tại: "
                    + currentLevel + ". (Bản tóm tắt tự động bằng AI tạm thời không khả dụng"
                    + " nên đây là tóm tắt theo số liệu thô.)";
            log.warn("Course learning summary fallback for student {} in {}: {}",
                    safeStudentId, safeCourseId, safeMessage(error));
        }

        return StudentCourseLearningSummary.builder()
                .studentId(safeStudentId)
                .courseId(safeCourseId)
                .classId(safeClassId)
                .totalQuestions(totalQuestions)
                .totalConversations(conversations.size())
                .questionsInCurrentCycle((int) (totalQuestions % CYCLE_SIZE))
                .cycleSize(CYCLE_SIZE)
                .quizGiven(quizGiven)
                .quizAnswered(quizAnswered)
                .quizCorrect(quizCorrect)
                .quizWrong(quizWrong)
                .quizSkipped(quizSkipped)
                .quizCorrectPercent(correctPercent)
                .difficultConcepts(difficultConcepts)
                .recentQuestions(recentQuestions)
                .currentSupportLevel(currentLevel)
                .levelHistory(levelHistory)
                .aiSummary(aiSummary)
                .strengths(strengths)
                .knowledgeGaps(knowledgeGaps)
                .teachingRecommendations(recommendations)
                .modelGenerated(modelGenerated)
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private int percentOrZero(Integer value) {
        return value == null ? 0 : Math.max(0, Math.min(100, value));
    }

    public AdaptiveLearningReview get(String reviewId) {
        AdaptiveLearningReview review = reviewRepository.findById(requireText(reviewId, "reviewId"))
                .orElseThrow(() -> new IllegalArgumentException("Adaptive learning review not found"));
        attachStudentIdentity(review);
        return review;
    }

    public AdaptiveLearningReview decide(
            String reviewId, String teacherId, AdaptiveLearningReviewDecisionRequest request) {
        if (request == null) throw new IllegalArgumentException("Request body is required");
        AdaptiveLearningReview review = get(reviewId);
        if (!"PENDING".equalsIgnoreCase(review.getStatus())) {
            throw new IllegalStateException("This review has already been processed");
        }
        String decision = requireText(request.getDecision(), "decision").toUpperCase(Locale.ROOT);
        if (!DECISIONS.contains(decision)) throw new IllegalArgumentException("Unsupported decision");
        String feedback = request.getTeacherFeedback() == null ? "" : request.getTeacherFeedback().trim();
        if (feedback.length() > 5000) throw new IllegalArgumentException("Teacher feedback exceeds 5000 characters");

        review.setTeacherId(requireText(teacherId, "teacherId"));
        review.setTeacherFeedback(feedback);
        review.setTeacherDecision(decision);
        review.setReviewedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());

        if ("REJECT".equals(decision)) {
            // Rejecting also reverts the level the AI auto-applied.
            archiveAutoAppliedDirective(review);
            review.setStatus("REJECTED");
            AdaptiveLearningReview rejected = reviewRepository.save(review);
            publishSupportLevelChanged(rejected, directiveService.resolveSupportLevel(
                    rejected.getStudentId(), rejected.getCourseId(), rejected.getClassId()));
            return rejected;
        }
        // A teacher decision replaces the AI auto-applied directive.
        archiveAutoAppliedDirective(review);

        String selectedLevel = "MODIFY".equals(decision)
                ? normalizeLevel(request.getSupportLevel(), review.getSuggestedSupportLevel())
                : review.getSuggestedSupportLevel();
        String instruction = buildTeacherInstruction(review, feedback);
        PedagogicalDirectiveRequest directiveRequest = new PedagogicalDirectiveRequest();
        directiveRequest.setStudentId(review.getStudentId());
        directiveRequest.setCourseId(review.getCourseId());
        directiveRequest.setClassId(review.getClassId());
        directiveRequest.setTopic(String.join(", ", safeList(review.getKnowledgeGaps())));
        directiveRequest.setInstruction(instruction);
        directiveRequest.setSupportLevel(selectedLevel);
        directiveRequest.setPriority(85);
        PedagogicalDirective draft = directiveService.createDraft(directiveRequest, teacherId, teacherId);
        PedagogicalDirective confirmed = directiveService.confirm(draft.getId(), teacherId);
        review.setAppliedDirectiveId(confirmed.getId());
        review.setSuggestedSupportLevel(selectedLevel);
        review.setStatus("APPROVED");
        AdaptiveLearningReview approved = reviewRepository.save(review);
        publishSupportLevelChanged(approved, selectedLevel);
        return approved;
    }

    private void attachStudentIdentity(AdaptiveLearningReview review) {
        if (review == null || review.getStudentId() == null) return;
        var identity = classRosterService.resolveStudent(
                review.getStudentId(), review.getCourseId(), review.getClassId());
        if (identity == null) return;
        review.setStudentName(identity.getStudentName());
        review.setStudentCode(identity.getStudentCode());
        review.setStudentEmail(identity.getStudentEmail());
    }

    private String buildTeacherInstruction(AdaptiveLearningReview review, String feedback) {
        StringBuilder text = new StringBuilder("Adaptive review after ")
                .append(review.getQuestionCount() != null
                        ? review.getQuestionCount()
                        : review.getCompletedSessionCount())
                .append(" student questions in this course. Teaching recommendations: ")
                .append(String.join("; ", safeList(review.getTeachingRecommendations())));
        if (!safeList(review.getKnowledgeGaps()).isEmpty()) {
            text.append(". Focus on knowledge gaps: ").append(String.join("; ", review.getKnowledgeGaps()));
        }
        if (!feedback.isBlank()) text.append(". Teacher-approved guidance: ").append(feedback);
        text.append(". Treat this as pedagogical guidance, not as a replacement for course-source facts. ")
                .append("Check understanding with a fresh task before reducing support.");
        return text.toString();
    }

    private void validateAssessment(Map<String, Object> map) {
        // Exactly the 9-key prompt contract (no overallPercent; backend derives it).
        for (String key : List.of("knowledgePercent", "practicePercent",
                "independencePercent", "confidencePercent")) {
            int value = number(map.get(key), -1);
            if (value < 0 || value > 100) throw new IllegalArgumentException("Invalid percentage: " + key);
        }
        if (string(map.get("summary"), "").isBlank()) throw new IllegalArgumentException("Missing summary");
        normalizeLevel(map.get("suggestedSupportLevel"), "STANDARD");
    }

    /**
     * Backend-owned confidence: half from how many of the cycle's questions are
     * present, half from how substantive the student's own messages are. Short
     * acknowledgements ("ok", "vâng") therefore keep confidence below the
     * auto-apply threshold even when the cycle is full.
     */
    private int evidenceCompletenessPercent(List<Map<String, Object>> evidence) {
        int studentMessages = 0;
        long studentChars = 0;
        for (Map<String, Object> item : evidence) {
            if (!"STUDENT".equals(item.get("role"))) continue;
            studentMessages++;
            studentChars += String.valueOf(item.get("content")).length();
        }
        if (studentMessages == 0) return 0;
        int volumeScore = (int) Math.round(50.0 * Math.min(studentMessages, CYCLE_SIZE) / CYCLE_SIZE);
        double averageLength = (double) studentChars / studentMessages;
        int depthScore = (int) Math.round(50.0 * Math.min(averageLength, 200.0) / 200.0);
        return Math.max(0, Math.min(100, volumeScore + depthScore));
    }

    /**
     * Layer 3 (support-level controller): turns the AI recommendation into the
     * target level that may be applied, with stability rules on top of the
     * score-based suggestion:
     * - Anti-flapping: if the previous review already changed the level, this
     *   review needs strong backend evidence confidence (&ge; 85) to change again.
     * - One-step transitions: never jump HIGH_SUPPORT &harr; CHALLENGE directly.
     */
    private String decideTargetLevel(Map<String, Object> assessment, String currentLevelRaw,
                                     AdaptiveLearningReview previousReview,
                                     List<Map<String, Object>> evidence) {
        String current = normalizeLevel(currentLevelRaw, "STANDARD");

        // Direct repeated-mistake evidence is decisive on its own: at least 3
        // wrong quiz answers, or 2 wrong on the same concept, in this cycle.
        // The generic weak-evidence and anti-flapping gates below measure how
        // much the student wrote in chat, so early in a cycle they kept the
        // level unchanged even while the student kept answering incorrectly.
        // One-step clamping still applies (CHALLENGE steps down to STANDARD).
        long totalWrong = 0;
        Map<String, Long> wrongByConcept = new LinkedHashMap<>();
        for (Map<String, Object> item : evidence == null ? List.<Map<String, Object>>of() : evidence) {
            if (!"STUDENT_ANSWER".equals(item.get("kind")) || !Boolean.FALSE.equals(item.get("correct"))) {
                continue;
            }
            totalWrong++;
            wrongByConcept.merge(
                    normalizeConceptText(String.valueOf(item.getOrDefault("quizQuestion", "")), "unknown"),
                    1L, Long::sum);
        }
        boolean repeatedMistakes = totalWrong >= EARLY_TOTAL_WRONG_THRESHOLD
                || wrongByConcept.values().stream().anyMatch(count -> count >= EARLY_SAME_CONCEPT_WRONG_THRESHOLD);
        if (repeatedMistakes && !"HIGH_SUPPORT".equals(current)) {
            return clampToOneStep(current, "HIGH_SUPPORT");
        }

        String target = chooseSupportLevel(assessment, current);
        if (target.equals(current)) return current;

        boolean previousChangedLevel = previousReview != null
                && previousReview.getAppliedDirectiveId() != null
                && !previousReview.getAppliedDirectiveId().isBlank();
        if (previousChangedLevel && number(assessment.get("confidencePercent"), 0) < 85) {
            return current;
        }
        return clampToOneStep(current, target);
    }

    private int supportNeedRank(String level) {
        return switch (normalizeLevel(level, "STANDARD")) {
            case "HIGH_SUPPORT" -> 2;
            case "CHALLENGE" -> 0;
            default -> 1;
        };
    }

    private String clampToOneStep(String current, String target) {
        int currentRank = supportNeedRank(current);
        int targetRank = supportNeedRank(target);
        if (Math.abs(targetRank - currentRank) <= 1) return target;
        int steppedRank = currentRank + Integer.signum(targetRank - currentRank);
        return switch (steppedRank) {
            case 2 -> "HIGH_SUPPORT";
            case 0 -> "CHALLENGE";
            default -> "STANDARD";
        };
    }

    private String chooseSupportLevel(Map<String, Object> assessment, String currentLevel) {
        String current = normalizeLevel(currentLevel, "STANDARD");
        int confidence = number(assessment.get("confidencePercent"), 0);
        int overall = number(assessment.get("overallPercent"), 0);
        int knowledge = number(assessment.get("knowledgePercent"), 0);
        int practice = number(assessment.get("practicePercent"), 0);
        int independence = number(assessment.get("independencePercent"), 0);

        // Do not change the level automatically when the evidence is too weak.
        if (confidence < 75) return current;
        if (overall <= 50 || knowledge <= 45) return "HIGH_SUPPORT";
        if (overall >= 85 && practice >= 80 && independence >= 80) return "CHALLENGE";
        if (overall >= 70 && independence >= 65 && "HIGH_SUPPORT".equals(current)) return "STANDARD";
        if ("CHALLENGE".equals(current) && (overall < 75 || independence < 65)) return "STANDARD";
        return normalizeLevel(assessment.get("suggestedSupportLevel"), current);
    }

    private Map<String, Object> fallbackAssessment(String currentLevel) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("knowledgePercent", 0);
        map.put("practicePercent", 0);
        map.put("independencePercent", 0);
        map.put("confidencePercent", 0);
        map.put("summary", "Chưa đủ dữ liệu đáng tin cậy để kết luận; giảng viên cần xem bằng chứng trước khi điều chỉnh.");
        map.put("strengths", List.of());
        map.put("knowledgeGaps", List.of());
        map.put("teachingRecommendations", List.of("Xem lại log hội thoại và yêu cầu sinh viên làm một bài kiểm tra mới."));
        map.put("suggestedSupportLevel", normalizeLevel(currentLevel, "STANDARD"));
        return map;
    }

    private String extractJson(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("Empty LLM response");
        String cleaned = raw.trim().replaceFirst("^\uFEFF", "");
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalArgumentException("LLM did not return JSON");
        return cleaned.substring(start, end + 1);
    }

    private String normalizeLevel(Object value, String fallback) {
        String level = value == null ? "" : value.toString().trim().toUpperCase(Locale.ROOT);
        if (LEVELS.contains(level)) return level;
        String safeFallback = fallback == null ? "STANDARD" : fallback.trim().toUpperCase(Locale.ROOT);
        return LEVELS.contains(safeFallback) ? safeFallback : "STANDARD";
    }

    private int number(Object value, int fallback) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); }
        catch (Exception ignored) { return fallback; }
    }

    private String string(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private List<String> strings(Object value) {
        if (!(value instanceof Collection<?> collection)) return List.of();
        return collection.stream().filter(Objects::nonNull).map(String::valueOf)
                .map(String::trim).filter(item -> !item.isBlank()).limit(12).toList();
    }

    private List<String> safeList(List<String> value) {
        return value == null ? List.of() : value;
    }

    private String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }

    private String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : truncate(error.getMessage(), 250);
    }
}
