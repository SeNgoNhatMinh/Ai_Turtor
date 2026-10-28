package com.ragapi.service.adaptive;

import com.ragapi.dto.UnderstandingCheckAttempt;
import com.ragapi.dto.UnderstandingCheckPayload;
import com.ragapi.entity.AiMessage;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static com.ragapi.service.adaptive.AdaptiveReviewPolicy.CYCLE_SIZE;
import static com.ragapi.service.adaptive.AdaptiveReviewValues.*;

/**
 * Turns a cycle of chat messages into review evidence (student questions and
 * per-item quiz outcomes) and the quiz facts the backend can verify. Pure: no
 * repositories, no LLM.
 */
public final class AdaptiveReviewEvidence {
    /** Remediation turns are sent by the FE with this prefix; their quiz is an easier re-check. */
    public static final String RECHECK_QUESTION_PREFIX = "Ôn lại sau câu ";

    private AdaptiveReviewEvidence() {}

    /** Concept key for grouping repeated mistakes: the normalized quiz question text. */
    public static String normalizeConceptKey(UnderstandingCheckAttempt attempt) {
        String question = attempt.getCheck() == null
                ? "" : String.valueOf(attempt.getCheck().getQuestion());
        return normalizeConceptText(question, "attempt:" + attempt.getAttemptId());
    }

    public static String normalizeConceptText(String question, String fallback) {
        String normalized = String.valueOf(question == null ? "" : question).toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim().replaceAll("\\s+", " ");
        return normalized.isBlank() ? fallback : normalized;
    }

    public record GradedAttempt(UnderstandingCheckAttempt attempt, boolean recheck) {}

    /** Answered quiz items in order, flagged when they re-check a concept after a re-teach. */
    public static List<GradedAttempt> gradedAttempts(List<AiMessage> messages) {
        List<GradedAttempt> result = new ArrayList<>();
        Map<String, String> latestStudentQuestion = new HashMap<>();
        for (AiMessage message : messages) {
            String conversationId = message.getConversationId() == null ? "" : message.getConversationId();
            if ("STUDENT".equalsIgnoreCase(message.getRole())) {
                latestStudentQuestion.put(conversationId, message.getContent());
                continue;
            }
            boolean recheck = isRecheckQuestion(latestStudentQuestion.get(conversationId));
            for (var attempt : answeredAttempts(message)) {
                result.add(new GradedAttempt(attempt, recheck));
            }
        }
        return result;
    }

    public static boolean isRecheckQuestion(String studentQuestion) {
        return studentQuestion != null && studentQuestion.stripLeading().startsWith(RECHECK_QUESTION_PREFIX);
    }

    /**
     * Every quiz attempt the student actually answered on this message.
     * New messages store one attempt per quiz item; legacy messages only
     * have the singular first-item fields, which map to attempt 0.
     */
    public static List<UnderstandingCheckAttempt> answeredAttempts(AiMessage message) {
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
    public static List<UnderstandingCheckAttempt> allAttempts(AiMessage message) {
        List<UnderstandingCheckAttempt> attempts = message.getUnderstandingCheckAttempts();
        if (attempts != null && !attempts.isEmpty()) {
            return attempts;
        }
        if (message.getUnderstandingCheck() != null) {
            UnderstandingCheckAttempt legacy = new UnderstandingCheckAttempt();
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

    /**
     * Keep student questions and per-item quiz outcomes as evidence. Quiz
     * answers include the preceding chat question, relevant source/topic,
     * selected answer, and a concise AI grading assessment so teachers can
     * inspect the context without treating assistant prose as student work.
     */
    public static List<Map<String, Object>> buildEvidence(List<AiMessage> cycleMessages) {
        List<Map<String, Object>> result = new ArrayList<>();
        Map<String, String> latestStudentQuestionByConversation = new HashMap<>();
        Map<String, Map<String, Object>> latestStudentEvidenceByConversation = new HashMap<>();
        for (AiMessage message : cycleMessages) {
            String role = message.getRole() == null ? "UNKNOWN" : message.getRole().toUpperCase(Locale.ROOT);
            if (Boolean.TRUE.equals(message.getProactive())) continue;
            String conversationId = message.getConversationId() == null ? "" : message.getConversationId();

            if ("STUDENT".equals(role)) {
                Map<String, Object> item = baseEvidenceItem(message, role);
                item.put("kind", "STUDENT_QUESTION");
                item.put("content", truncate(message.getContent(), 1200));
                item.put("topic", truncate(message.getContent(), 120));
                item.put("aiAssessment", "AI lưu câu hỏi này làm ngữ cảnh học tập; việc đặt câu hỏi tự nó không phải bằng chứng sinh viên yếu kiến thức.");
                result.add(item);
                latestStudentQuestionByConversation.put(conversationId, message.getContent());
                latestStudentEvidenceByConversation.put(conversationId, item);
                continue;
            }
            if (!"ASSISTANT".equals(role)) continue;

            String studentQuestion = latestStudentQuestionByConversation.getOrDefault(conversationId, "");
            for (var attempt : allAttempts(message)) {
                var quiz = attempt.getCheck();
                if (quiz == null) continue;
                boolean skipped = attempt.getSelectedKey() == null || attempt.getSelectedKey().isBlank();
                String topic = resolveEvidenceTopic(message, studentQuestion, quiz.getQuestion());
                Map<String, Object> relatedQuestion = latestStudentEvidenceByConversation.get(conversationId);
                if (relatedQuestion != null && !topic.isBlank()) relatedQuestion.put("topic", topic);
                Map<String, Object> answer = baseEvidenceItem(message, "STUDENT");
                answer.put("kind", "STUDENT_ANSWER");
                answer.put("quizIndex", attempt.getQuizIndex());
                answer.put("attemptId", attempt.getAttemptId() == null ? "" : attempt.getAttemptId());
                answer.put("skipped", skipped);
                answer.put("recheck", isRecheckQuestion(studentQuestion));
                answer.put("topic", topic);
                answer.put("studentQuestion", truncate(studentQuestion, 1200));
                answer.put("content", skipped
                        ? "Câu kiểm tra " + (attempt.getQuizIndex() + 1)
                                + ": " + (quiz.getQuestion() == null ? "" : quiz.getQuestion())
                                + " — sinh viên bỏ qua (không trả lời)"
                        : "Câu kiểm tra " + (attempt.getQuizIndex() + 1)
                                + ": " + (quiz.getQuestion() == null ? "" : quiz.getQuestion())
                                + " — sinh viên chọn " + attempt.getSelectedKey()
                                + ", đáp án đúng " + (quiz.getCorrectKey() == null ? "" : quiz.getCorrectKey())
                                + " → " + (Boolean.TRUE.equals(attempt.getCorrect()) ? "ĐÚNG"
                                        : Boolean.FALSE.equals(attempt.getCorrect()) ? "SAI" : "CHƯA CHẤM"));
                answer.put("quizQuestion", quiz.getQuestion() == null ? "" : quiz.getQuestion());
                answer.put("quizOptions", quiz.getOptions() == null ? List.of() : quiz.getOptions().stream()
                        .map(option -> Map.of(
                                "key", option.getKey() == null ? "" : option.getKey(),
                                "text", option.getText() == null ? "" : option.getText()))
                        .toList());
                answer.put("correctKey", quiz.getCorrectKey() == null ? "" : quiz.getCorrectKey());
                answer.put("selectedKey", skipped ? "" : attempt.getSelectedKey());
                answer.put("selectedText", skipped ? "" : optionText(quiz, attempt.getSelectedKey()));
                answer.put("correctText", optionText(quiz, quiz.getCorrectKey()));
                // Keep null for skipped attempts: null means "not answered",
                // false would wrongly count the item as a wrong answer.
                answer.put("correct", skipped ? null : attempt.getCorrect());
                answer.put("quizExplanation", quiz.getExplanation() == null ? "" : quiz.getExplanation());
                answer.put("aiAssessment", buildQuizEvidenceAssessment(attempt, quiz, skipped));
                answer.put("understandingCorrect", attempt.getCorrect());
                answer.put("answeredAt", attempt.getAnsweredAt() == null
                        ? null : attempt.getAnsweredAt().toString());
                answer.put("eventAt", attempt.getAnsweredAt() == null
                        ? (message.getCreatedAt() == null ? null : message.getCreatedAt().toString())
                        : attempt.getAnsweredAt().toString());
                result.add(answer);
            }
        }
        return result;
    }

    private static Map<String, Object> baseEvidenceItem(AiMessage message, String role) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("messageId", message.getId());
        item.put("sessionId", message.getTutorSessionId() == null ? "" : message.getTutorSessionId());
        item.put("conversationId", message.getConversationId());
        item.put("role", role);
        item.put("topic", "");
        item.put("createdAt", message.getCreatedAt() == null ? null : message.getCreatedAt().toString());
        return item;
    }

    private static String resolveEvidenceTopic(AiMessage message, String studentQuestion, String quizQuestion) {
        LinkedHashSet<String> labels = new LinkedHashSet<>();
        if (message.getSourceEvidence() != null) {
            message.getSourceEvidence().stream()
                    .filter(Objects::nonNull)
                    .map(source -> {
                        String chapter = trimToNull(source.getChapter());
                        String title = trimToNull(source.getMaterialTitle());
                        if (chapter != null && title != null && !chapter.equalsIgnoreCase(title)) {
                            return chapter + " · " + title;
                        }
                        return chapter != null ? chapter : title;
                    })
                    .filter(Objects::nonNull)
                    .limit(2)
                    .forEach(labels::add);
        }
        if (!labels.isEmpty()) return String.join(" · ", labels);
        String context = trimToNull(studentQuestion);
        if (context != null) return truncate(context, 120);
        return truncate(quizQuestion, 120);
    }

    private static String optionText(UnderstandingCheckPayload quiz, String key) {
        if (quiz == null || key == null || quiz.getOptions() == null) return "";
        return quiz.getOptions().stream()
                .filter(option -> key.equalsIgnoreCase(option.getKey()))
                .map(option -> option.getText() == null ? "" : option.getText())
                .findFirst()
                .orElse("");
    }

    private static String buildQuizEvidenceAssessment(
            UnderstandingCheckAttempt attempt,
            UnderstandingCheckPayload quiz,
            boolean skipped
    ) {
        if (skipped) {
            return "AI chưa chấm mục này vì sinh viên chưa chọn đáp án; không tính là trả lời sai.";
        }
        String selectedKey = attempt.getSelectedKey() == null ? "" : attempt.getSelectedKey().trim().toUpperCase(Locale.ROOT);
        String correctKey = quiz.getCorrectKey() == null ? "" : quiz.getCorrectKey().trim().toUpperCase(Locale.ROOT);
        if (Boolean.TRUE.equals(attempt.getCorrect())) {
            return "AI chấm đúng: sinh viên chọn " + selectedKey + ". Đây là bằng chứng trả lời đúng câu kiểm tra này, chưa đủ để kết luận đã làm chủ toàn bộ chủ đề.";
        }
        if (!Boolean.FALSE.equals(attempt.getCorrect())) {
            return "AI chưa xác định kết quả chấm cho lựa chọn này; giảng viên có thể đối chiếu đáp án và tài liệu liên quan.";
        }
        return "AI chấm sai: sinh viên chọn " + selectedKey + ", đáp án đúng là " + correctKey
                + ". Đây là dấu hiệu cần củng cố nội dung được kiểm tra; một lần sai riêng lẻ chưa đủ kết luận sinh viên có lỗ hổng lặp lại.";
    }

    /**
     * What the backend can verify about the cycle without an LLM. Re-check
     * items (easier questions after a re-teach) are counted separately so one
     * misunderstanding is never counted twice.
     */
    public record EvidenceFacts(int studentMessages, int graded, int correct, int wrong, int skipped,
                         int recheckCorrect, int recheckWrong, long maxWrongSameConcept) {

        public int accuracyPercent() {
            return graded == 0 ? -1 : Math.round(100f * correct / graded);
        }

        /**
         * Reliability of this review: driven by graded quiz answers (direct
         * evidence), with a small share from how many questions the student
         * asked. Message length is deliberately ignored.
         */
        public int confidencePercent() {
            if (graded == 0 && studentMessages == 0) return 0;
            return Math.min(95, 20 + 15 * graded + 2 * Math.min(studentMessages, CYCLE_SIZE));
        }

        public String describe() {
            return "graded=" + graded + ", correct=" + correct + ", wrong=" + wrong
                    + ", skipped=" + skipped + ", accuracy="
                    + (graded == 0 ? "n/a" : accuracyPercent() + "%")
                    + ", maxWrongOnOneConcept=" + maxWrongSameConcept
                    + ", recheckCorrect=" + recheckCorrect + ", recheckWrong=" + recheckWrong
                    + ", studentQuestions=" + studentMessages;
        }
    }

    public static EvidenceFacts evidenceFacts(List<Map<String, Object>> evidence) {
        int studentMessages = 0;
        int correct = 0;
        int wrong = 0;
        int skipped = 0;
        int recheckCorrect = 0;
        int recheckWrong = 0;
        Map<String, Long> wrongByConcept = new LinkedHashMap<>();
        for (Map<String, Object> item : evidence == null ? List.<Map<String, Object>>of() : evidence) {
            Object kind = item.get("kind");
            if ("STUDENT_QUESTION".equals(kind)) {
                studentMessages++;
                continue;
            }
            if (!"STUDENT_ANSWER".equals(kind)) continue;
            Object result = item.get("correct");
            boolean recheck = Boolean.TRUE.equals(item.get("recheck"));
            if (result == null) {
                if (!recheck) skipped++;
            } else if (Boolean.TRUE.equals(result)) {
                if (recheck) recheckCorrect++; else correct++;
            } else if (Boolean.FALSE.equals(result)) {
                if (recheck) {
                    recheckWrong++;
                } else {
                    wrong++;
                    wrongByConcept.merge(
                            normalizeConceptText(String.valueOf(item.getOrDefault("quizQuestion", "")), "unknown"),
                            1L, Long::sum);
                }
            }
        }
        long maxWrongSameConcept = wrongByConcept.values().stream().mapToLong(Long::longValue).max().orElse(0);
        return new EvidenceFacts(studentMessages, correct + wrong, correct, wrong, skipped,
                recheckCorrect, recheckWrong, maxWrongSameConcept);
    }
}
