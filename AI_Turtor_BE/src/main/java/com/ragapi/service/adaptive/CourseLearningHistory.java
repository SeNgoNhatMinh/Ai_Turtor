package com.ragapi.service.adaptive;

import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.entity.AiMessage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.ragapi.service.adaptive.AdaptiveReviewEvidence.allAttempts;
import static com.ragapi.service.adaptive.AdaptiveReviewValues.truncate;

/**
 * Deterministic statistics over a student's whole chat history in one course
 * (correct, wrong and skipped quizzes kept separate) plus the timeline lines
 * the course-summary prompt reads.
 */
public record CourseLearningHistory(
        long totalQuestions,
        long quizGiven,
        long quizAnswered,
        long quizCorrect,
        long quizWrong,
        long quizSkipped,
        List<Map<String, Object>> difficultConcepts,
        List<String> recentQuestions,
        List<String> historyLines
) {

    /** @param messages chronological student/assistant messages of the course */
    public static CourseLearningHistory of(List<AiMessage> messages) {
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
        return new CourseLearningHistory(totalQuestions, quizGiven, quizAnswered, quizCorrect, quizWrong,
                quizSkipped, difficultConcepts, List.copyOf(recentQuestions), List.copyOf(historyLines));
    }

    public int correctPercent() {
        return quizAnswered == 0 ? 0 : (int) Math.round(100.0 * quizCorrect / quizAnswered);
    }

    /** The model reads the whole history, capped to the most recent 90 lines. */
    public List<String> modelLines() {
        return historyLines.size() > 90
                ? historyLines.subList(historyLines.size() - 90, historyLines.size()) : historyLines;
    }

    /** Support-level changes in chronological order, as shown to the teacher. */
    public static List<Map<String, Object>> levelHistory(List<AdaptiveLearningReview> reviews) {
        return reviews.stream()
                .sorted(Comparator.comparing(AdaptiveLearningReview::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(review -> {
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
                })
                .toList();
    }
}
