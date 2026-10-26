package com.ragapi.service.adaptive;

import com.ragapi.entity.AdaptiveLearningReview;

import static com.ragapi.service.adaptive.AdaptiveReviewValues.safeList;

/** Instruction texts stored on the pedagogical directives created from a review. */
public final class AdaptiveDirectiveTexts {

    private AdaptiveDirectiveTexts() {}

    public static int percentOrZero(Integer value) {
        return value == null ? 0 : Math.max(0, Math.min(100, value));
    }

    /** Directive the AI applies on its own; the teacher can later replace or revoke it. */
    public static String autoAppliedInstruction(AdaptiveLearningReview review, String suggested) {
        StringBuilder text = new StringBuilder("AI Tutor tự đổi mức hỗ trợ sang ")
                .append(suggested)
                .append(" sau ").append(reviewQuestionCount(review))
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

    /** Directive created when a teacher approves or modifies a review. */
    public static String teacherInstruction(AdaptiveLearningReview review, String feedback) {
        StringBuilder text = new StringBuilder("Adaptive review after ")
                .append(reviewQuestionCount(review))
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

    private static Integer reviewQuestionCount(AdaptiveLearningReview review) {
        return review.getQuestionCount() != null ? review.getQuestionCount() : review.getCompletedSessionCount();
    }
}
