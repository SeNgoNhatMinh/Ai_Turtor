package com.ragapi.util;

import com.ragapi.dto.UnderstandingCheckPayload;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UnderstandingCheckExtractorTest {

    @Test
    void extractsTypedQuizAndKeepsAnswerMetadataOutOfOptions() {
        String answer = """
                ## Kiểm tra hiểu
                Câu hỏi: Phương thức nào chạy đầu tiên?
                A. service() xử lý request
                B. init() khởi tạo tài nguyên
                C. destroy() Đáp án: B Giải thích: init() chạy trước service().

                ## Lưu ý để học tốt hơn
                - Ôn vòng đời Servlet
                """;

        UnderstandingCheckPayload quiz = UnderstandingCheckExtractor.extract(answer);

        assertThat(quiz).isNotNull();
        assertThat(quiz.getQuestion()).isEqualTo("Phương thức nào chạy đầu tiên?");
        assertThat(quiz.getOptions()).extracting(UnderstandingCheckPayload.Option::getText)
                .containsExactly("service() xử lý request", "init() khởi tạo tài nguyên", "destroy()");
        assertThat(quiz.getCorrectKey()).isEqualTo("B");
        assertThat(quiz.getExplanation()).isEqualTo("init() chạy trước service().");
    }

    @Test
    void extractAllReturnsEveryQuizItemInOrder() {
        String answer = """
                ## Giải thích
                Nội dung bài học.

                ## Kiểm tra hiểu

                Q1.
                Câu một là gì?
                A. Một
                B. Hai
                Đáp án đúng: B
                Giải thích: Vì hai.

                Q2.
                Câu hai là gì?
                A. Một
                B. Hai
                Đáp án đúng: A
                Giải thích: Vì một.

                Q3.
                Câu ba là gì?
                A. Một
                B. Hai
                Đáp án đúng: B
                Giải thích: Vì hai.
                """;

        var checks = UnderstandingCheckExtractor.extractAll(answer);

        assertThat(checks).hasSize(3);
        assertThat(checks.get(0).getQuestion()).isEqualTo("Câu một là gì?");
        assertThat(checks.get(1).getQuestion()).isEqualTo("Câu hai là gì?");
        assertThat(checks.get(2).getQuestion()).isEqualTo("Câu ba là gì?");
        // The singular extractor still returns only the first item.
        assertThat(UnderstandingCheckExtractor.extract(answer).getQuestion()).isEqualTo("Câu một là gì?");
    }

    @Test
    void returnsNullForOrdinaryAnswer() {
        assertThat(UnderstandingCheckExtractor.extract("Giải thích vòng đời Servlet.")).isNull();
    }

    @Test
    void hidesAnswerMetadataUntilTheStudentSubmits() {
        String answer = """
                ## Kiểm tra hiểu
                Câu hỏi: Spring dùng thành phần nào?
                A. Filter
                B. ViewResolver
                C. Listener
                Đáp án: B
                Giải thích: ViewResolver phân giải tên view.

                ## Học chuyên sâu
                - MVC
                """;

        UnderstandingCheckPayload stored = UnderstandingCheckExtractor.extract(answer);
        UnderstandingCheckPayload student = UnderstandingCheckExtractor.studentView(stored, false);
        String visible = UnderstandingCheckExtractor.stripHiddenAnswerMetadata(answer);

        assertThat(student.getCorrectKey()).isEmpty();
        assertThat(student.getExplanation()).isEmpty();
        assertThat(visible).doesNotContain("Đáp án:", "Giải thích:");
        assertThat(visible).contains("## Học chuyên sâu");
    }
}
