package com.ragapi.harness.util;

import com.ragapi.harness.answer.generation.SupportLevelPrompt;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GuidedPracticeAndVoiceTest {

    private static final String LESSON = """
            ## 1. Giải thích
            Servlet nhận request GET qua doGet.

            ## Nguồn tài liệu đã dùng
            - mat-1
            """;

    @Test
    void everySupportLevelGetsAFillableExerciseBeforeSources() {
        for (SupportLevelPrompt level : SupportLevelPrompt.values()) {
            String out = GuidedPracticeGuard.ensure(LESSON, "Bắt đầu bài 2: Servlet", level);
            assertThat(GuidedPracticeGuard.hasUsablePractice(out)).as(level.name()).isTrue();
            assertThat(out.indexOf("## Bài tập có hướng dẫn")).isLessThan(out.indexOf("## Nguồn tài liệu"));
            assertThat(out).contains("\"Servlet\"");
        }
        String high = GuidedPracticeGuard.ensure(LESSON, "Servlet", SupportLevelPrompt.HIGH_SUPPORT);
        String challenge = GuidedPracticeGuard.ensure(LESSON, "Servlet", SupportLevelPrompt.CHALLENGE);
        assertThat(high).contains("gợi ý");
        assertThat(count(challenge, "____")).isGreaterThan(count(high, "____"));
    }

    @Test
    void fallbackExerciseUsesTheTopicNotTheWholeStudentRequest() {
        assertThat(GuidedPracticeGuard.topicOf("Tôi muốn tìm hiểu về Bài 1: Giới thiệu nền tảng Java EE."))
                .isEqualTo("\"Giới thiệu nền tảng Java EE\"");
        assertThat(GuidedPracticeGuard.topicOf("Giải thích Cấu trúc rẽ nhánh & Vòng lặp bằng ví dụ đơn giản."))
                .isEqualTo("\"Cấu trúc rẽ nhánh & Vòng lặp\"");
        assertThat(GuidedPracticeGuard.topicOf("Bắt đầu bài 2: Servlet")).isEqualTo("\"Servlet\"");
        String out = GuidedPracticeGuard.ensure(LESSON,
                "Tôi muốn tìm hiểu về Bài 1: Giới thiệu nền tảng Java EE", SupportLevelPrompt.HIGH_SUPPORT);
        assertThat(out).doesNotContain("Tôi muốn tìm hiểu").contains("Ý chính của \"Giới thiệu nền tảng Java EE\"");
    }

    @Test
    void keepsTheModelExerciseOnceAndDropsDuplicates() {
        String answer = """
                ## 1. Giải thích
                Nội dung.

                ## 2. Bài tập có hướng dẫn
                ```
                void ____() {}
                ```

                ## 3. Bài tập có hướng dẫn
                Không có chỗ trống.
                """;
        String out = GuidedPracticeGuard.ensure(answer, "doGet", SupportLevelPrompt.STANDARD);
        assertThat(count(out, "Bài tập có hướng dẫn")).isEqualTo(1);
        assertThat(out).contains("void ____() {}");
    }

    @Test
    void removesVocativesLikeEmOi() {
        String out = StudentVoiceFilter.clean("""
                Em ơi, vòng lặp for lặp qua dãy.
                Chào bạn! Biến là tên gọi.
                Hãy thử lại nhé em.
                Đáp án đúng là B, em ơi.
                Xem lại phần ví dụ, bạn nhé.
                ```
                String em = "em ơi";
                ```
                """);
        assertThat(out).contains("Vòng lặp for lặp qua dãy.");
        assertThat(out).contains("Biến là tên gọi.");
        assertThat(out).contains("Hãy thử lại nhé.");
        assertThat(out).contains("Đáp án đúng là B.");
        assertThat(out).contains("Xem lại phần ví dụ nhé.");
        assertThat(out).contains("String em = \"em ơi\";");
        assertThat(out.replace("String em = \"em ơi\";", "")).doesNotContainIgnoringCase("em ơi")
                .doesNotContainIgnoringCase("chào bạn");
    }

    @Test
    void removesSourceLeadInsAndPronounOpeners() {
        String out = StudentVoiceFilter.clean("""
                Từ trong chương 4, vòng lặp for lặp qua dãy.
                - Theo tài liệu: hàm len trả về độ dài.
                Em cần nhớ điều này. Bạn có thể dùng `em` trong code.
                Chương 3 cho biết: biến là tên gọi.
                ```
                Em cần giữ nguyên trong code
                ```
                """);
        assertThat(out).contains("Vòng lặp for lặp qua dãy.");
        assertThat(out).contains("- Hàm len trả về độ dài.");
        assertThat(out).contains("Cần nhớ điều này. Có thể dùng `em` trong code.");
        assertThat(out).contains("Biến là tên gọi.");
        assertThat(out).contains("Em cần giữ nguyên trong code");
        assertThat(out).doesNotContain("chương 4").doesNotContain("Theo tài liệu");
    }

    private static int count(String text, String needle) {
        int n = 0;
        for (int i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length())) n++;
        return n;
    }
}
