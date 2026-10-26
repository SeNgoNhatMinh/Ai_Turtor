package com.ragapi.service.adaptive;

import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.service.adaptive.AdaptiveReviewEvidence.EvidenceFacts;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.ragapi.service.adaptive.AdaptiveReviewValues.*;

/** Review cadence, early-trigger thresholds and the support-level guardrails. */
public final class AdaptiveReviewPolicy {
    /** Student questions per regular review cycle in one course. */
    public static final int CYCLE_SIZE = 5;
    /** Wrong answers on the same concept that justify an early (pre-cycle) review. */
    public static final int EARLY_SAME_CONCEPT_WRONG_THRESHOLD = 2;
    /** Total wrong answers in the open cycle that justify an early review. */
    public static final int EARLY_TOTAL_WRONG_THRESHOLD = 3;
    /** Correct answers without any mistake that justify an early review towards less support. */
    public static final int EARLY_CORRECT_STREAK_THRESHOLD = 4;

    private AdaptiveReviewPolicy() {}

    public static void validateAssessment(Map<String, Object> map) {
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
     * Layer 3 (support-level controller). The LLM reads the conversation and
     * proposes the level; the backend only enforces guardrails:
     * - more support needs at least one graded quiz answer; LESS support
     *   needs demonstrated quiz success (at least 3 graded, 70%+ correct);
     * - a proposal that contradicts the verified quiz facts is overruled
     *   (asking for more support at 85%+ accuracy, or keeping/reducing
     *   support at 34% or lower);
     * - anti-flapping: reversing the previous review's change needs 85+
     *   confidence;
     * - one-step transitions: never jump HIGH_SUPPORT &harr; CHALLENGE directly.
     */
    public static String decideTargetLevel(Map<String, Object> assessment, String currentLevelRaw,
                                     AdaptiveLearningReview previousReview, EvidenceFacts facts) {
        String current = normalizeLevel(currentLevelRaw, "STANDARD");
        String target = normalizeLevel(assessment.get("suggestedSupportLevel"), current);
        int confidence = number(assessment.get("confidencePercent"), 0);
        int accuracy = facts.accuracyPercent();

        boolean clearlyStruggling = facts.graded() >= 3 && accuracy <= 34;
        if (clearlyStruggling && supportNeedRank(target) <= supportNeedRank(current)
                && !"HIGH_SUPPORT".equals(current)) {
            target = "HIGH_SUPPORT";
        }
        if (target.equals(current)) return current;

        int direction = Integer.signum(supportNeedRank(target) - supportNeedRank(current));
        if (direction > 0) {
            // Chat alone ("ok ạ") is not enough to add support: at least one graded answer.
            if (facts.graded() == 0) return current;
            if (facts.graded() >= 3 && accuracy >= 85) return current;
        } else {
            if (facts.graded() < 3 || accuracy < 70 || confidence < 70) return current;
        }

        if (previousReview != null && previousReview.getAppliedDirectiveId() != null
                && !previousReview.getAppliedDirectiveId().isBlank()) {
            int previousDirection = Integer.signum(
                    supportNeedRank(previousReview.getSuggestedSupportLevel())
                            - supportNeedRank(previousReview.getCurrentSupportLevel()));
            if (previousDirection != 0 && direction == -previousDirection && confidence < 85) {
                return current;
            }
        }
        return clampToOneStep(current, target);
    }

    private static int supportNeedRank(String level) {
        return switch (normalizeLevel(level, "STANDARD")) {
            case "HIGH_SUPPORT" -> 2;
            case "CHALLENGE" -> 0;
            default -> 1;
        };
    }

    private static String clampToOneStep(String current, String target) {
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

    public static Map<String, Object> fallbackAssessment(String currentLevel) {
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
}
