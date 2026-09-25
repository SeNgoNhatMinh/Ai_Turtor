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
    void lessonTeachAddsMissingUnderstandingCheckFromCourseContext() {
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

                        ## Nguồn tài liệu đã dùng
                        material-1
                        """);
        when(model.generateUtility(contains("Create exactly one short Vietnamese multiple-choice")))
                .thenReturn("""
                        ## Kiểm tra hiểu
                        Câu hỏi: Hàm nào nhận dữ liệu do người dùng nhập?
                        A. print()
                        B. input()
                        C. type()
                        Đáp án: B
                        Giải thích: `input()` nhận dữ liệu nhập từ người dùng.
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
        assertTrue(answer.contains("Đáp án: B"));
        assertTrue(answer.indexOf("## Kiểm tra hiểu") < answer.indexOf("## Học chuyên sâu"));
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
}
