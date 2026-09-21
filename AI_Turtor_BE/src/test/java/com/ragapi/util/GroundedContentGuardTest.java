package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GroundedContentGuardTest {

    @Test
    void detectsFunctionMentionThatDoesNotExistInRetrievedMaterial() {
        assertThat(GroundedContentGuard.unsupportedCallReferences(
                "Sử dụng isinstance() để kiểm tra kiểu dữ liệu",
                "The type() function returns the type of an object."
        )).containsExactly("isinstance()");
    }

    @Test
    void acceptsFunctionMentionWhenMaterialContainsIt() {
        assertThat(GroundedContentGuard.unsupportedCallReferences(
                "isinstance() dùng để làm gì?",
                "Use isinstance(object, classinfo) to test an object's type."
        )).isEmpty();
    }

    @Test
    void removesInventedStudyTipsWhenMaterialHasNoRecommendation() {
        String answer = """
                ## Theo tài liệu môn học
                Python có các kiểu int, float và str.

                ## Lưu ý để học tốt hơn
                1. Hãy tự viết hello.py và chạy trong terminal.

                ## Nguồn tài liệu đã dùng
                material-1
                """;

        String filtered = GroundedContentGuard.stripUnsupportedOptionalSections(
                answer,
                "Python values can have the types int, float and str."
        );

        assertThat(filtered).contains("Python có các kiểu int, float và str.");
        assertThat(filtered).doesNotContain("Lưu ý để học tốt hơn", "hello.py");
        assertThat(filtered).contains("Nguồn tài liệu đã dùng");
    }

    @Test
    void keepsStudyTipsWhenMaterialExplicitlyContainsTheRecommendation() {
        String answer = """
                ## Lưu ý để học tốt hơn
                - Thực hành kiểm tra kiểu bằng type().
                """;

        String filtered = GroundedContentGuard.stripUnsupportedOptionalSections(
                answer,
                "Practice checking values with type() after this section."
        );

        assertThat(filtered).contains("Lưu ý để học tốt hơn", "type()");
    }

    @Test
    void removesWholeTipWhenItAddsAnUnsupportedDetail() {
        String answer = """
                ## Lưu ý để học tốt hơn
                - Khi gặp khó khăn, hãy nghỉ ngơi, uống cà phê hoặc ăn nhẹ.
                - Ôn lại tài liệu trước đó và làm lại bài tập.
                """;
        String context = """
                Nếu điều gì đó có vẻ đặc biệt khó khăn, hãy nghỉ ngơi, chợp mắt, ăn nhẹ.
                Xem lại tài liệu trước đó và làm lại các bài tập trước.
                """;

        String filtered = GroundedContentGuard.stripUnsupportedOptionalSections(answer, context);

        assertThat(filtered).doesNotContain("cà phê", "Khi gặp khó khăn");
        assertThat(filtered).contains("Ôn lại tài liệu", "làm lại bài tập");
    }

    @Test
    void removesQuizWhoseFunctionIsAbsentFromMaterial() {
        String answer = """
                ## Kiểm tra hiểu
                Câu hỏi: isinstance() có được tài liệu đề cập không?
                A. Có
                B. Không
                Đáp án: B
                Giải thích: Tài liệu không đề cập.
                """;

        String filtered = GroundedContentGuard.stripUnsupportedOptionalSections(
                answer,
                "The material discusses type() only."
        );

        assertThat(filtered).isBlank();
    }
}
