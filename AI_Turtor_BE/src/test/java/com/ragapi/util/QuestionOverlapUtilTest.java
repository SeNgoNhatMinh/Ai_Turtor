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
    void canonicalQuestionKey_ignoresAccentsPunctuationAndSpacing() {
        assertThat(QuestionOverlapUtil.canonicalQuestionKey("pytorch là gì ?"))
                .isEqualTo(QuestionOverlapUtil.canonicalQuestionKey("pytorch la gi"));
    }

    @Test
    void isSameAcademicQuestion_treatsNearDuplicatesAsOneItem() {
        assertThat(QuestionOverlapUtil.isSameAcademicQuestion(
                "pytorch là gì?",
                "pytorch la gi ?"
        )).isTrue();
        assertThat(QuestionOverlapUtil.isSameAcademicQuestion(
                "pytorch được áp dụng ở trong python như thế nào?",
                "pytorch được áp dụng trong python như thế nào?"
        )).isTrue();
    }

    @Test
    void isSameAcademicQuestion_keepsDistinctTopicsSeparate() {
        assertThat(QuestionOverlapUtil.isSameAcademicQuestion(
                "pytorch là gì?",
                "pytorch được áp dụng trong python như thế nào?"
        )).isFalse();
    }
}
