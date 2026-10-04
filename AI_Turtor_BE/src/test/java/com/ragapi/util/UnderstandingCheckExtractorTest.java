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
