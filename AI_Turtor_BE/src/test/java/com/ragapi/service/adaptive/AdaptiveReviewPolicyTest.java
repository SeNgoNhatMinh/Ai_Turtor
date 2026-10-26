package com.ragapi.service.adaptive;

import com.ragapi.entity.AdaptiveLearningReview;
import com.ragapi.service.adaptive.AdaptiveReviewEvidence.EvidenceFacts;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AdaptiveReviewPolicyTest {

    private static Map<String, Object> proposal(String level, int confidence) {
        return Map.of("suggestedSupportLevel", level, "confidencePercent", confidence);
    }

    private static EvidenceFacts facts(int correct, int wrong) {
        return new EvidenceFacts(5, correct + wrong, correct, wrong, 0, 0, 0, wrong);
    }

    @Test
    void moreSupportNeedsAtLeastOneGradedAnswer() {
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("HIGH_SUPPORT", 90), "STANDARD", null, facts(0, 0))).isEqualTo("STANDARD");
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("HIGH_SUPPORT", 45), "STANDARD", null, facts(0, 1))).isEqualTo("HIGH_SUPPORT");
    }

    @Test
    void lessSupportNeedsThreeGradedAnswersAtSeventyPercent() {
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("CHALLENGE", 75), "STANDARD", null, facts(2, 0))).isEqualTo("STANDARD");
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("CHALLENGE", 75), "STANDARD", null, facts(2, 1))).isEqualTo("STANDARD");
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("CHALLENGE", 75), "STANDARD", null, facts(3, 0))).isEqualTo("CHALLENGE");
    }

    @Test
    void proposalsContradictingQuizFactsAreOverruled() {
        // Every graded answer wrong, yet the LLM keeps STANDARD.
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("STANDARD", 70), "STANDARD", null, facts(0, 3))).isEqualTo("HIGH_SUPPORT");
        // 85%+ correct, yet the LLM asks for more support.
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("HIGH_SUPPORT", 90), "STANDARD", null, facts(4, 0))).isEqualTo("STANDARD");
    }

    @Test
    void reversingTheLastChangeNeedsHighConfidence() {
        AdaptiveLearningReview previous = AdaptiveLearningReview.builder()
                .currentSupportLevel("STANDARD")
                .suggestedSupportLevel("HIGH_SUPPORT")
                .appliedDirectiveId("dir-old")
                .build();
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("STANDARD", 75), "HIGH_SUPPORT", previous, facts(3, 0))).isEqualTo("HIGH_SUPPORT");
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("STANDARD", 90), "HIGH_SUPPORT", previous, facts(4, 0))).isEqualTo("STANDARD");
    }

    @Test
    void neverJumpsTwoLevelsAtOnce() {
        assertThat(AdaptiveReviewPolicy.decideTargetLevel(
                proposal("CHALLENGE", 95), "HIGH_SUPPORT", null, facts(5, 0))).isEqualTo("STANDARD");
    }

    @Test
    void confidenceComesFromGradedAnswersNotChatVolume() {
        assertThat(new EvidenceFacts(5, 0, 0, 0, 0, 0, 0, 0).confidencePercent()).isEqualTo(30);
        assertThat(facts(3, 0).confidencePercent()).isEqualTo(75);
        assertThat(facts(5, 0).confidencePercent()).isEqualTo(95);
    }
}
