package com.ragapi.service.behavior.plan;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TeachingPlanFingerprintTest {

    @Test
    void sameSupportLevelWithDifferentBehaviorsYieldsDifferentFingerprints() {
        SelectedTeachingBehavior step = new SelectedTeachingBehavior(
                "a", 1, null, "Giải thích khái niệm", "STEP_BY_STEP", "từng bước", 1, 0.9, "STUDENT");
        SelectedTeachingBehavior visual = new SelectedTeachingBehavior(
                "b", 1, null, "Minh họa trực quan", "VISUAL_EXAMPLES", "sơ đồ", 1, 0.9, "STUDENT");

        String left = TeachingPlan.fingerprint("HIGH_SUPPORT", List.of(step), "SLOW", "DETAILED", List.of("CONCEPT"));
        String right = TeachingPlan.fingerprint("HIGH_SUPPORT", List.of(visual), "NORMAL", "DETAILED", List.of("VISUAL_DIAGRAM"));

        assertThat(left).isNotEqualTo(right);
        assertThat(left).hasSize(16);
    }
}
