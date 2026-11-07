package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LearnerAffectDetectorTest {

    @Test
    void detectsConfusedFromQuestion() {
        assertThat(LearnerAffectDetector.detect("em không hiểu vòng lặp", "", ""))
                .isEqualTo("CONFUSED");
    }

    @Test
    void detectsFrustrated() {
        assertThat(LearnerAffectDetector.detect("bực quá, giải thích lại đi", "", ""))
                .isEqualTo("FRUSTRATED");
    }

    @Test
    void defaultsToNeutral() {
        assertThat(LearnerAffectDetector.detect("Servlet filter là gì?", "previous lesson", ""))
                .isEqualTo("NEUTRAL");
    }
}
