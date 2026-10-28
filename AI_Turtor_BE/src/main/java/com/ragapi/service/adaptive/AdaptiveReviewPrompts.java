package com.ragapi.service.adaptive;

import com.ragapi.service.adaptive.AdaptiveReviewEvidence.EvidenceFacts;

import java.util.List;
import java.util.Map;

import static com.ragapi.service.adaptive.AdaptiveReviewPolicy.CYCLE_SIZE;

/** The LLM prompt for the adaptive learning review. */
public final class AdaptiveReviewPrompts {

    private AdaptiveReviewPrompts() {}

    /** Evidence lines the LLM reads; quiz items carry their re-check label and outcome. */
    static String transcript(List<Map<String, Object>> evidence) {
        return evidence.stream().limit(36).map(item -> {
            if ("STUDENT_ANSWER".equals(item.get("kind"))) {
                Object correct = item.get("correct");
                String topic = String.valueOf(item.getOrDefault("topic", ""));
                String questionContext = String.valueOf(item.getOrDefault("studentQuestion", ""));
                String label = Boolean.TRUE.equals(item.get("recheck"))
                        ? "Câu kiểm tra LẠI sau khi giảng lại" : "Kiểm tra hiểu bài";
                if (correct == null) {
                    return "[" + label + " | Chủ đề/ngữ cảnh: " + topic
                            + " | Sinh viên hỏi: \"" + questionContext + "\""
                            + " | Câu kiểm tra: \"" + item.get("quizQuestion") + "\""
                            + " | Kết quả: BỎ QUA (sinh viên không trả lời)]";
                }
                return "[Đáp án sinh viên - " + label + " | Chủ đề/ngữ cảnh: " + topic
                        + " | Sinh viên hỏi: \"" + questionContext + "\""
                        + " | Câu kiểm tra: \"" + item.get("quizQuestion") + "\""
                        + " | Sinh viên chọn: " + item.getOrDefault("selectedKey", "")
                        + " (" + item.getOrDefault("selectedText", "") + ")"
                        + " | Đáp án đúng: " + item.getOrDefault("correctKey", "")
                        + " (" + item.getOrDefault("correctText", "") + ")"
                        + " | Kết quả: " + (Boolean.TRUE.equals(correct) ? "ĐÚNG" : "SAI") + "]";
            }
            return item.get("role") + ": " + item.get("content");
        }).reduce((a, b) -> a + "\n" + b).orElse("");
    }

    public static String assessmentPrompt(String courseId, String currentSupportLevel,
                                          EvidenceFacts facts, List<Map<String, Object>> evidence) {
        return """
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
                Backend-verified quiz facts for this cycle (re-check items excluded): %s
                Evidence excerpts:
                %s

                Read the WHOLE excerpt, not only the quiz lines. The student's own
                words are evidence too: repeated "em không hiểu", asking the same
                thing again, or giving up signal a need for more support; correct
                self-explanations, deeper "why/what if" questions and independent
                code signal readiness for less support.

                Lines marked "Câu kiểm tra LẠI sau khi giảng lại" are an easier
                re-check after a re-teach of a concept already answered wrongly. A
                wrong re-check is the SAME gap, not a new one; a correct re-check
                shows recovery.

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
                """.formatted(courseId, currentSupportLevel, CYCLE_SIZE, facts.describe(), transcript(evidence));
    }

    /** Teacher-facing narrative over the student's whole course history; never changes the level. */
    public static String courseSummaryPrompt(String courseId, CourseLearningHistory history, String currentLevel) {
        List<String> modelLines = history.modelLines();
        return """
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
                  các lần đánh giá theo chu kỳ quyết định.

                Môn học: %s
                Tổng số câu hỏi sinh viên đã hỏi trong môn: %d
                Kiểm tra hiểu bài: đã ra %d câu, sinh viên trả lời %d (đúng %d, sai %d), bỏ qua %d câu.
                Mức hỗ trợ hiện tại: %s

                Lịch sử học (theo thứ tự thời gian):
                %s
                """.formatted(courseId, history.totalQuestions(), history.quizGiven(), history.quizAnswered(),
                history.quizCorrect(), history.quizWrong(), history.quizSkipped(), currentLevel,
                modelLines.isEmpty() ? "(chưa có dữ liệu)" : String.join("\n", modelLines));
    }

    /** Plain statistics shown when the course-summary model is unavailable. */
    public static String fallbackCourseSummary(String courseId, CourseLearningHistory history, String currentLevel) {
        return "Sinh viên đã hỏi " + history.totalQuestions() + " câu trong môn " + courseId
                + ". Trong " + history.quizGiven() + " câu kiểm tra hiểu bài, sinh viên đã trả lời "
                + history.quizAnswered() + " câu (đúng " + history.quizCorrect() + ", sai " + history.quizWrong()
                + ") và bỏ qua " + history.quizSkipped() + " câu. Mức hỗ trợ hiện tại: "
                + currentLevel + ". (Bản tóm tắt tự động bằng AI tạm thời không khả dụng"
                + " nên đây là tóm tắt theo số liệu thô.)";
    }
}
