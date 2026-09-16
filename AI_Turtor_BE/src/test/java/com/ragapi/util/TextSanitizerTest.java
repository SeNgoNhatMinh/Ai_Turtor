package com.ragapi.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.AiQueryResponse;
import com.ragapi.dto.CourseRagAnswer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TextSanitizerTest {

    @Test
    void repairsCommonMojibake() {
        // UTF-8 "Bạn muốn học" misread as Latin-1/Windows-1252
        String broken = "B\u00e1\u00ba\u00a1n mu\u00e1\u00bb\u0081n h\u00e1\u00bb\u008dc JSP";
        String cleaned = TextSanitizer.cleanForStudentAnswer(broken);
        assertTrue(cleaned.contains("Bạn") || cleaned.contains("muốn") || cleaned.contains("học"));
        assertFalse(cleaned.contains("\u00c3"));
    }

    @Test
    void stripsPromptNarrationFromStudentAnswers() {
        String leaked = """
                ## Giải thích
                TLD ánh xạ thẻ JSP sang Tag Handler.

                ## Bài tiếp theo
                (Omit as per instruction: "otherwise omit." I'll omit it to be safe.)
                - Wait, the prompt says:
                """;
        String cleaned = TextSanitizer.cleanForStudentAnswer(leaked);
        assertFalse(cleaned.toLowerCase().contains("the prompt says"));
        assertFalse(cleaned.contains("## Bài tiếp theo"));
        assertTrue(cleaned.contains("TLD ánh xạ"));
    }

    @Test
    void preservesVietnameseWithDiacritics() {
        String input = "Hệ thống chưa có tài liệu của môn PRJ301.";
        assertEquals(input, TextSanitizer.cleanForStudentAnswer(input));
    }

    @Test
    void detectsSystemFailureAnswersWithoutDiacritics() {
        assertTrue(TextSanitizer.isSystemFailureOrEscalationAnswer(
                "Loi may chu: Code Mentor chua the phan tich luc nay."));
    }

    @Test
    void detectsSystemFailureAnswersWithDiacritics() {
        assertTrue(TextSanitizer.isSystemFailureOrEscalationAnswer(
                "Lỗi máy chủ: Code Mentor chưa thể phân tích lúc này."));
    }

    @Test
    void normalizeAccentInsensitiveMatchesWithAndWithoutDiacritics() {
        String withDiacritics = TextSanitizer.normalizeAccentInsensitive("Máy ảo Java hoạt động?");
        String withoutDiacritics = TextSanitizer.normalizeAccentInsensitive("may ao java HOAT DONG!!!");
        assertEquals(withDiacritics, withoutDiacritics);
    }

    @Test
    void cleanListRemovesBlankEntries() {
        assertEquals(2, TextSanitizer.cleanList(java.util.List.of(" Servlet ", "", "JSP")).size());
    }

    @Test
    void stripsClosedReasoningBlockAndKeepsFinalAnswer() {
        String answer = "<think>private chain of thought</think>\n## Theo tài liệu môn học\nServlet có init, service và destroy.";

        String cleaned = TextSanitizer.cleanForStudentAnswer(answer);

        assertFalse(cleaned.contains("private chain of thought"));
        assertTrue(cleaned.startsWith("## Theo tài liệu môn học"));
    }

    @Test
    void rejectsUnclosedReasoningOnlyOutput() {
        String answer = "<think>Here's a thinking process: [Output Generation] draft only";

        assertEquals("", TextSanitizer.cleanForStudentAnswer(answer));
    }

    @Test
    void convertsEscapedMarkdownLineBreaksToActualNewlines() {
        String escaped = "## Giải thích\\n\\nCon trỏ lưu địa chỉ của biến.\\n\\n## Bài tiếp theo\\n\\n- Con trỏ và mảng";

        String cleaned = TextSanitizer.cleanForStudentAnswer(escaped);

        assertTrue(cleaned.contains("\n"));
        assertFalse(cleaned.contains("\\n"));
        assertTrue(cleaned.contains("## Giải thích\n\nCon trỏ lưu địa chỉ của biến."));
        assertTrue(cleaned.contains("## Bài tiếp theo\n\n- Con trỏ và mảng"));
    }

    @Test
    void unwrapsDoubleStringifiedMarkdownAnswer() {
        String doubleStringified = "\"## Giải thích\\n\\nCon trỏ lưu địa chỉ của biến.\"";

        String cleaned = TextSanitizer.cleanForStudentAnswer(doubleStringified);

        assertEquals("## Giải thích\n\nCon trỏ lưu địa chỉ của biến.", cleaned);
        assertFalse(cleaned.startsWith("\""));
        assertFalse(cleaned.endsWith("\""));
    }

    @Test
    void preservesMarkdownStructuresAndVietnameseUnicode() {
        String markdown = """
                ## Giải thích

                Con trỏ lưu địa chỉ của biến tiếng Việt.

                - Con trỏ và mảng

                ```c
                int *p = &x;
                printf("xin chào\\n");
                ```

                | Chủ đề | Mô tả |
                | --- | --- |
                | `int *p` | Con trỏ |
                """;

        String cleaned = TextSanitizer.cleanForStudentAnswer(markdown);

        assertTrue(cleaned.contains("tiếng Việt"));
        assertTrue(cleaned.contains("- Con trỏ và mảng"));
        assertTrue(cleaned.contains("```c\nint *p = &x;\nprintf(\"xin chào\\n\");\n```"));
        assertTrue(cleaned.contains("| Chủ đề | Mô tả |\n| --- | --- |"));
        assertFalse(cleaned.contains("\\n| --- |"));
    }

    @Test
    void preservesStreamingChunkNewlineCharacters() {
        String chunk = "\\n- Con trỏ và mảng";

        String cleaned = TextSanitizer.cleanStreamingAnswerChunk(chunk);

        assertEquals("\n- Con trỏ và mảng", cleaned);
        assertFalse(cleaned.contains("\\n"));
    }

    @Test
    void serializedDtoDeserializesToAnswerWithActualNewlines() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        AiQueryResponse response = new AiQueryResponse();
        response.setAnswer("## Giải thích\\n\\nCon trỏ lưu địa chỉ của biến.\\n\\n## Bài tiếp theo\\n\\n- Con trỏ và mảng");

        String json = mapper.writeValueAsString(response);
        AiQueryResponse roundTrip = mapper.readValue(json, AiQueryResponse.class);

        assertTrue(roundTrip.getAnswer().contains("\n"));
        assertFalse(roundTrip.getAnswer().contains("\\n"));
        assertTrue(roundTrip.getAnswer().contains("## Bài tiếp theo\n\n- Con trỏ và mảng"));
    }

    @Test
    void courseRagAnswerFieldContainsActualNewlinesAfterJsonDeserialization() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        CourseRagAnswer answer = CourseRagAnswer.builder()
                .answer("## Giải thích\\n\\nCon trỏ lưu địa chỉ của biến.\\n\\n## Bài tiếp theo\\n\\n- Con trỏ và mảng")
                .confidence(0.9)
                .build();

        String json = mapper.writeValueAsString(answer);
        CourseRagAnswer roundTrip = mapper.readValue(json, CourseRagAnswer.class);

        assertTrue(roundTrip.getAnswer().contains("\n"));
        assertFalse(roundTrip.getAnswer().contains("\\n"));
        assertTrue(roundTrip.getAnswer().contains("## Giải thích\n\nCon trỏ lưu địa chỉ của biến."));
    }
}
