package com.ragapi.service.course.answer.orchestration;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WorkerQuizMarkdownNormalizerTest {

    @Test
    void splitsInlineOptionsAndAnswerLabelsOntoOwnLines() {
        String normalized = CourseAnswerGenerationStageService.normalizeWorkerQuizMarkdown("""
                Q1. Khi nào nên dùng encodeURL? A. redirect B. forward C. body D. cookie Đáp án đúng: B Giải thích: forward nội bộ.
                Q2. encodeRedirectURL dùng khi nào? A. forward B. redirect C. header D. query Đáp án đúng: B Giải thích: khi redirect.
                """);

        assertThat(normalized).contains(
                "Q1.\n",
                "\nA. redirect\n",
                "\nB. forward\n",
                "\nĐáp án đúng: B\n",
                "\nGiải thích: forward nội bộ.",
                "Q2.\n"
        );
        assertThat(normalized).doesNotContain("A. redirect B. forward");
    }

    @Test
    void expandsLiteralEscapedNewlines() {
        String normalized = CourseAnswerGenerationStageService.normalizeWorkerQuizMarkdown(
                "Q1. hỏi?\\nA. một\\nB. hai\\nĐáp án đúng: B\\nGiải thích: ok"
        );
        assertThat(normalized).contains("\nA. một\n", "\nĐáp án đúng: B\n");
    }
}
