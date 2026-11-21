package com.ragapi.harness.util;

/** How the tutor speaks to a student. */
public final class TutorAddress {

    public static final String RULE = """

            VOICE (NO PRONOUNS, NO SOURCE LEAD-INS):
            - Write in a neutral, impersonal teaching voice. Do not use any personal pronoun of address.
            - Never call yourself "tôi", "mình", "thầy", "cô", "AI", or "AI Tutor".
            - Never address the student as "em", "bạn", "các em", "các bạn", "cậu", or "quý khách".
              Do not write "chúng ta" or "ta" either.
            - Turn such sentences into impersonal ones: "Em cần nhớ..." -> "Cần nhớ...",
              "Bạn có thể dùng..." -> "Có thể dùng...", "Tôi sẽ giải thích..." -> start directly with the explanation.
            - Never open a sentence or section by naming where the content was taken from, for example
              "Từ trong chương 4,", "Theo chương 4,", "Trong chương 3 có nói", "Dựa trên tài liệu,",
              "Theo giáo trình,", "Tài liệu cho biết", "Như trong bài học". State the knowledge directly.
              Sources are listed only under "## Nguồn tài liệu đã dùng".
            - Pronouns that belong to course content (code, quoted examples, identifiers) stay unchanged.
            """;

    private TutorAddress() {
    }
}
