package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StudentAnswerCompletenessGuardTest {

    @Test
    void removesPlaceholderShortenedDictionaryOutputAndItsLeadIn() {
        String answer = """
                Chương trình in tần suất của mỗi từ, ví dụ:

                ```
                {'But': 1, 'soft': 1, 'what': 1, 'light': 1, ...}
                ```

                ## Nguồn tài liệu đã dùng
                materialId=book-1
                """;

        assertThat(StudentAnswerCompletenessGuard.containsAbbreviatedExampleOutput(answer)).isTrue();
        assertThat(StudentAnswerCompletenessGuard.removeAbbreviatedExampleOutputs(answer))
                .doesNotContain("...", "ví dụ:")
                .contains("Chương trình in tần suất", "Nguồn tài liệu");
    }

    @Test
    void detectsUnclosedCodeFenceAndIncompleteSentenceEnding() {
        assertThat(StudentAnswerCompletenessGuard.isClearlyIncomplete("Ví dụ:\n```python\nprint('x')"))
                .isTrue();
        assertThat(StudentAnswerCompletenessGuard.isClearlyIncomplete("Có hai bước và"))
                .isTrue();
        assertThat(StudentAnswerCompletenessGuard.isClearlyIncomplete("Câu trả lời đã hoàn chỉnh."))
                .isFalse();
    }
}
