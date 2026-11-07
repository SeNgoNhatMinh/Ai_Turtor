package com.ragapi.util;

/** Shared system-prompt rule: every bold section title the student sees is numbered. */
public final class NumberedTitlePrompt {

    public static final String RULE = """
            NUMBERED BOLD TITLES (required on every student-facing answer):
            - Every bold section title must have a sequence number, starting at 1, with no gaps and no repeated numbers.
            - A Markdown heading is a bold title. Write "## 1. Title", then "## 2. Title". A smaller heading continues the same count: "### 3. Title".
            - A title that is only bold, on its own line, uses the next number too: **4. Title**.
            - Do not number a word just because it is bold inside a sentence, a code name, or a table cell.
            - Do not number lines inside code fences or quiz choices A. B. C. D.
            - Leave these headings exactly unnumbered, with no "1." in front: Kiểm tra hiểu, Học chuyên sâu, Học tiếp phần này, Bài tiếp theo, Nguồn tài liệu đã dùng, Lộ trình học, Bắt đầu thế nào.
            """;

    private NumberedTitlePrompt() {
    }
}
