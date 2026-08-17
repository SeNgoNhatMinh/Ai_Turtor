package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class QuestionOverlapUtilTest {

    @Test
    void keywordOverlap_isHighForParaphrases() {
        double overlap = QuestionOverlapUtil.keywordOverlapRatio(
                "Giải thích servlet là gì?",
                "Servlet là gì, giải thích giúp em"
        );
        assertThat(overlap).isGreaterThan(0.45);
    }

    @Test
    void keywordOverlap_isLowForDifferentTopics() {
        double overlap = QuestionOverlapUtil.keywordOverlapRatio(
                "Servlet là gì?",
                "JSP lifecycle hoạt động thế nào?"
        );
        assertThat(overlap).isLessThan(0.45);
    }
}
