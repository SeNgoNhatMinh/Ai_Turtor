package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StudentFacingMessagesTest {

    @Test
    void recognizesGeneratedInsufficientMaterialAnswers() {
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Material không đủ để trả lời câu hỏi."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "The course material is not enough to answer this question."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu hiện có không cung cấp đủ thông tin chi tiết để giảng giải."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu hiện có không cung cấp định nghĩa về con trỏ."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu cung cấp không có phần giải thích khái niệm con trỏ."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu hiện có không bao gồm nội dung tổng quan về ngôn ngữ lập trình Pascal, "
                        + "vì vậy không thể cung cấp thông tin chi tiết về chủ đề này dựa trên nguồn tài liệu đã cho."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "The course material does not include an overview of Pascal."));
        assertTrue(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu hiện có không chứa phần mô tả về tính đóng gói (encapsulation) "
                        + "và không có ví dụ minh họa cho khái niệm này, vì vậy không thể trích dẫn "
                        + "hay giải thích dựa trên nội dung đã cung cấp."));
        assertFalse(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Tài liệu giải thích cách dùng get trong dictionary."));
        assertFalse(StudentFacingMessages.isInsufficientMaterialAnswer(
                "JSP không được trình duyệt thực thi trực tiếp.\n\n## Nguồn tài liệu đã dùng\n- materialId=abc"));
        assertFalse(StudentFacingMessages.isInsufficientMaterialAnswer(
                "Cách làm trong tài liệu là không đúng khi gọi service() trước init()."));
    }
}
