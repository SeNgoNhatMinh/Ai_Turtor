package com.ragapi.service.course.answer.generation;

import com.ragapi.service.course.gateway.CourseAnswerModelGateway;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseAnswerGenerationServiceTest {

    @Test
    void lessonTeachFillsAMissingCheckFromThePinnedChapter() {
        CourseAnswerModelGateway model = mock(CourseAnswerModelGateway.class);
        when(model.generate("prompt", "Bắt đầu bài 1: print và input"))
                .thenReturn("""
                        ## Giải thích
                        `print()` hiển thị dữ liệu ra màn hình để người học quan sát kết quả chương trình.

                        `input()` dừng chương trình để nhận dữ liệu do người dùng nhập từ bàn phím.

                        Hai câu lệnh giúp chương trình đầu tiên vừa đưa thông tin ra vừa nhận thông tin vào.

                        Dữ liệu nhận từ `input()` có thể được lưu vào biến để chương trình sử dụng ở bước tiếp theo.

                        ## Học chuyên sâu
                        - Dữ liệu trả về từ input
                        """);
        when(model.generateUtility(contains("Create exactly one short Vietnamese multiple-choice"))).thenReturn("""
                ## Kiểm tra hiểu
                Câu hỏi: Lệnh nào nhận dữ liệu người dùng nhập?
                A. print()
                B. input()
                C. len()
                Đáp án: B
                Giải thích: input() nhận dữ liệu từ người dùng.
                """);
        CourseAnswerGenerationService service = new CourseAnswerGenerationService(model);

        String answer = service.generateGroundedAnswer(
                "prompt",
                "Bắt đầu bài 1: print và input",
                "LESSON_TEACH",
                "Tài liệu: print hiển thị dữ liệu; input nhận dữ liệu người dùng nhập.",
                ""
        );

        assertTrue(answer.contains("## Giải thích"));
        assertTrue(answer.contains("## Kiểm tra hiểu"));
        assertTrue(answer.contains("Đáp án: B"));
    }

    @Test
    void lessonTeachKeepsExistingUnderstandingCheckWithoutExtraGeneration() {
        CourseAnswerModelGateway model = mock(CourseAnswerModelGateway.class);
        when(model.generate("prompt", "Bắt đầu bài 1: print và input"))
                .thenReturn("""
                        ## Giải thích
                        `print()` hiển thị dữ liệu ra màn hình, còn `input()` nhận dữ liệu người dùng nhập.
                        Đây là hai thao tác nhập và xuất cơ bản trong một chương trình Python đầu tiên.
                        Người học có thể lưu dữ liệu nhận được vào biến và hiển thị lại bằng `print()`.
                        Cách kết hợp này tạo nên một tương tác đơn giản giữa chương trình và người dùng.

                        ## Kiểm tra hiểu
                        Câu hỏi: Hàm nào nhận dữ liệu nhập?
                        A. print()
                        B. input()
                        C. len()
                        Đáp án: B
                        Giải thích: `input()` nhận dữ liệu từ người dùng.
                        """);
        CourseAnswerGenerationService service = new CourseAnswerGenerationService(model);

        String answer = service.generateGroundedAnswer(
                "prompt",
                "Bắt đầu bài 1: print và input",
                "LESSON_TEACH",
                "Tài liệu: print hiển thị dữ liệu; input nhận dữ liệu người dùng nhập.",
                ""
        );

        assertTrue(answer.contains("## Kiểm tra hiểu"));
        verify(model, never()).generateUtility(contains("Create exactly one short Vietnamese multiple-choice"));
    }

    @Test
    void remediationAddsParaphrasedCheckWhenTheReteachOmitsIt() {
        CourseAnswerModelGateway model = mock(CourseAnswerModelGateway.class);
        String question = """
                Ôn lại sau câu trả lời chưa đúng.
                Câu vừa làm: Vì sao tuple sắp xếp theo giá trị phải là (val, key)?
                """;
        when(model.generate("prompt", question)).thenReturn("""
                ## Giảng lại dễ hiểu
                Khi sort so sánh từ trái sang phải, value phải đứng trước.

                ### Minh họa trực quan (Visual Representation)
                `l.append((val, key))` đưa value lên đầu tuple.
                """);
        when(model.generateUtility(contains("Paraphrase the question"))).thenReturn("""
                ## Kiểm tra hiểu
                Câu hỏi: Muốn sort giảm dần theo value thì tuple phải xếp thế nào?
                A. (key, val)
                B. (val, key)
                C. chỉ có key
                Đáp án: B
                Giải thích: Phần tử đầu tiên được so sánh trước.
                """);
        CourseAnswerGenerationService service = new CourseAnswerGenerationService(model);

        String answer = service.generateGroundedAnswer(
                "prompt",
                question,
                "EXPLAIN_CONCEPT",
                "sort so sánh từ trái sang phải; append((val, key)) đưa value lên đầu.",
                ""
        );

        assertTrue(answer.contains("## Giảng lại dễ hiểu"));
        assertTrue(answer.contains("Muốn sort giảm dần theo value"));
        assertTrue(answer.contains("Đáp án: B"));
    }
}
