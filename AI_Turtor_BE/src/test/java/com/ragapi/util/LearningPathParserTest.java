package com.ragapi.util;

import com.ragapi.dto.SuggestionItem;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LearningPathParserTest {

    @Test
    void parsesNumberedBaiLessonsFromRoadmap() {
        String answer = """
                ## Lộ trình học
                1. Bài 1: Servlet là gì?
                2. Bài 2: Request và Response
                - Bài 3: JSP + Servlet

                ## Bắt đầu thế nào
                Hãy gửi: Bắt đầu bài 1: Servlet là gì?
                """;

        List<SuggestionItem> items = LearningPathParser.parseLessonSuggestions(answer);

        assertEquals(3, items.size());
        assertEquals("Bắt đầu bài 1: Servlet là gì?", items.get(0).getTitle());
        assertEquals("Bắt đầu bài 2: Request và Response", items.get(1).getTitle());
        assertEquals("Bắt đầu bài 3: JSP + Servlet", items.get(2).getTitle());
        assertEquals(List.of(
                "Bắt đầu bài 1: Servlet là gì?",
                "Bắt đầu bài 2: Request và Response",
                "Bắt đầu bài 3: JSP + Servlet"
        ), LearningPathParser.lessonStarterTexts(items));
    }

    @Test
    void retrievalFocusUsesLessonTitle() {
        assertEquals(
                "Servlet là gì?",
                LearningPathParser.retrievalFocus("Bắt đầu bài 1: Servlet là gì?")
        );
        assertEquals(
                "Nay mình học Java Servlet",
                LearningPathParser.retrievalFocus("Nay mình học Java Servlet")
        );
    }

    @Test
    void retrievalFocusPrependsSessionTopicForFollowUpsOnly() {
        assertEquals(
                "Servlet Specification giúp mình hiểu khái niệm của phần này với? có ví dụ ko?",
                LearningPathParser.retrievalFocus(
                        "có ví dụ ko?",
                        "Servlet Specification giúp mình hiểu khái niệm của phần này với?"
                )
        );
        assertEquals(
                "Java Servlet còn response thì sao?",
                LearningPathParser.retrievalFocus("còn response thì sao?", "Java Servlet")
        );
        assertEquals(
                "Nay mình học JDBC",
                LearningPathParser.retrievalFocus("Nay mình học JDBC", "Java Servlet")
        );
        assertEquals(
                "Servlet là gì?",
                LearningPathParser.retrievalFocus("Servlet là gì?", "Java Servlet")
        );
    }

    @Test
    void parsesMarkdownBoldAndInlineCodeLessonLines() {
        String answer = """
                ## Lộ trình học
                1. **Bài 1: Giới thiệu vòng lặp `for`** – hiểu cú pháp và cách lặp qua một danh sách.
                2. **Bài 2: Vòng lặp while**
                6. Bài 6: Xử lý lỗi ngữ nghĩa (semantic error) khi viết vòng lặp – tránh lỗi logic.

                ## Bắt đầu thế nào
                Bạn muốn bắt đầu với bài nào? Gợi ý: **Bắt đầu bài 1: Giới thiệu vòng lặp for**.
                """;

        List<SuggestionItem> items = LearningPathParser.parseLessonSuggestions(answer);

        assertEquals(3, items.size());
        assertEquals("Bắt đầu bài 1: Giới thiệu vòng lặp for – hiểu cú pháp và cách lặp qua một danh sách.",
                items.get(0).getTitle());
        assertEquals("Bắt đầu bài 2: Vòng lặp while", items.get(1).getTitle());
        assertEquals("Bắt đầu bài 6: Xử lý lỗi ngữ nghĩa (semantic error) khi viết vòng lặp – tránh lỗi logic.",
                items.get(2).getTitle());
    }

    @Test
    void nextLessonBulletUsesTheFollowingNumberedPathItem() {
        String path = "1. Bài 1: Servlet 2. Bài 2: Request 5. Bài 5: Custom tag 6. Bài 6: Kiểm tra runtime custom tag";
        assertEquals(
                "- Bài 6: Kiểm tra runtime custom tag",
                LearningPathParser.nextLessonBullet(
                        "Bắt đầu bài 5: Triển khai custom tag trong JSPX và kiểm tra runtime",
                        path
                )
        );
    }

    @Test
    void nextLessonBulletKeepsStoredPathWhenHistoryHasADifferentChapter() {
        List<String> path = List.of(
                "Bắt đầu bài 1: Câu lệnh if cơ bản – hiểu cú pháp và cách thực thi khi điều kiện đúng.",
                "Bắt đầu bài 2: Toán tử so sánh – các phép so sánh (==, !=, >, <, >=, <=) dùng trong điều kiện.",
                "Bắt đầu bài 3: Toán tử logic và rút gọn điều kiện."
        );
        String context = LearningPathParser.activePathContext(path)
                + "\n## Bài tiếp theo\n- Bài 2: Nắm rõ đặc điểm và cách hoạt động của vòng lặp for (definite) và while (indefinite)";
        assertEquals(
                "- Bài 2: Toán tử so sánh – các phép so sánh (==, !=, >, <, >=, <=) dùng trong điều kiện.",
                LearningPathParser.nextLessonBullet(
                        "Bắt đầu bài 1: Câu lệnh if cơ bản – hiểu cú pháp và cách thực thi khi điều kiện đúng.",
                        context
                )
        );
    }

    @Test
    void activePathContextFormatsStoredLessonStarters() {
        String context = LearningPathParser.activePathContext(List.of(
                "Bắt đầu bài 1: Câu lệnh if cơ bản",
                "Bắt đầu bài 2: Toán tử so sánh"
        ));
        assertTrue(context.contains("Bài 1: Câu lệnh if cơ bản"));
        assertTrue(context.contains("Bài 2: Toán tử so sánh"));
        assertTrue(LearningPathParser.hasNumberedPath(context));
    }

    @Test
    void nextLessonBulletIsNullAtEndOfPath() {
        String path = LearningPathParser.activePathContext(List.of(
                "Bắt đầu bài 1: Câu lệnh if cơ bản",
                "Bắt đầu bài 2: Toán tử so sánh"
        ));
        assertEquals(null, LearningPathParser.nextLessonBullet("Bắt đầu bài 2: Toán tử so sánh", path));
        assertTrue(LearningPathParser.hasNumberedPath(path));
    }

    @Test
    void deepDivePromptsKeepTheSameLessonNumberForNextBai() {
        String path = LearningPathParser.activePathContext(List.of(
                "Bắt đầu bài 3: Cache",
                "Bắt đầu bài 4: Các cấp độ cache (L1, L2)"
        ));
        assertEquals(Integer.valueOf(3), LearningPathParser.currentLessonNumber(
                "Gợi ý học chuyên sâu bài 3: Cache"));
        assertEquals(Integer.valueOf(3), LearningPathParser.currentLessonNumber(
                "Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu"));
        assertEquals(
                "- Bài 4: Các cấp độ cache (L1, L2)",
                LearningPathParser.nextLessonBullet(
                        "Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu",
                        path
                )
        );
        assertEquals(
                "Cache miss khi CPU không tìm thấy dữ liệu",
                LearningPathParser.retrievalFocus(
                        "Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu")
        );
    }

    @Test
    void ignoresAnswersWithoutBaiLessons() {
        assertTrue(LearningPathParser.parseLessonSuggestions(
                "## Theo tài liệu môn học\nServlet là chương trình Java chạy trên web server."
        ).isEmpty());
    }
}
