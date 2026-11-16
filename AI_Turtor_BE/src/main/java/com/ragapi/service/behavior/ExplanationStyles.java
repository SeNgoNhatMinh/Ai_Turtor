package com.ragapi.service.behavior;

import java.util.List;

/**
 * The six explanation styles a review may recommend and the tutor must render.
 * A style changes how the current answer is phrased. It is not a new topic
 * and not a homework assignment about an older concept.
 */
public final class ExplanationStyles {

    public static final List<String> STRATEGIES = List.of(
            "Giải thích khái niệm",
            "Ví dụ thực tế",
            "Minh họa trực quan",
            "Bảng so sánh",
            "Bài tập có hướng dẫn",
            "Tự kiểm tra");

    private ExplanationStyles() {
    }

    /** The style label when an instruction starts with one; otherwise null. */
    public static String strategyOf(String instruction) {
        if (instruction == null) return null;
        String text = instruction.trim();
        for (String strategy : STRATEGIES) {
            if (text.regionMatches(true, 0, strategy, 0, strategy.length())) return strategy;
        }
        return null;
    }

    /** Instructions for the review model that writes teachingRecommendations. */
    public static String reviewCatalog() {
        return """
                teachingRecommendations are explanation STYLES, not homework topics.
                Return 2 to 4 items. Each item is one Vietnamese sentence and MUST
                start with exactly one of these labels:
                - "Giải thích khái niệm:" a short plain-language definition before any example.
                - "Ví dụ thực tế:" one everyday situation that makes the same idea concrete. Do not invent APIs or results.
                - "Minh họa trực quan:" a short flow of how the idea runs (steps or a small diagram).
                - "Bảng so sánh:" a table that distinguishes this idea from the nearest related idea.
                - "Bài tập có hướng dẫn:" a code skeleton with one or more blanks, never the finished solution.
                - "Tự kiểm tra:" one short question the student answers or writes themselves, with no answer attached.
                After the colon, say in at most 20 words how to use that style for this student's gap.
                Pick only styles the evidence supports. Do not repeat a style.
                Do not name a different topic than the gap. Do not write a task that stays hidden from the student.
                The tutor will render each selected style as its own section in the next answer.
                """;
    }

    /** Instructions for the tutor that turns selected styles into answer sections. */
    public static String answerSections() {
        return """
                EXPLANATION STYLES — use these only when TEACHING BEHAVIORS TO APPLY is present
                and COURSE MATERIAL CONTEXT covers the question. Otherwise omit every heading below.
                Each behavior is a way to phrase THIS answer. If a behavior names an older concept,
                ignore that concept and apply the style to STUDENT QUESTION.
                Include a heading only when a behavior calls for that style.
                Number every bold title in the whole answer as one sequence. If an earlier heading is already "## 1.", the next style continues at 2. Never restart at 1.
                Keep this order. Drop a style you do not use instead of leaving its number empty.
                Example when only the example and the table apply:
                ## 1. Ví dụ thực tế
                ## 2. So sánh

                ## 1. Giải thích khái niệm
                One or two short paragraphs. Define the idea in plain Vietnamese before any example.

                ## 2. Ví dụ thực tế
                One everyday situation for the same idea. Do not invent an API, a file, or a result
                that the course material does not show.

                ## 3. Minh họa trực quan
                One compact flow of how it runs: a short numbered step list or a small Mermaid flowchart.
                Do not add facts that are absent from the material.

                ## 4. So sánh
                A GitHub markdown table distinguishing this idea from the nearest related idea in the material.
                | Khía cạnh | ... | ... |
                | --- | --- | --- |

                ## 5. Bài tập có hướng dẫn
                A short fenced code skeleton. Mark every blank the student must fill as ____.
                Use one ____ for each missing piece. Do not paste the finished solution.
                Do not use a blank line instead of ____.

                ## 6. Tự thực hành
                One short question that asks the student to explain or try the idea. Do not give the answer here.
                Do not write an A/B/C quiz; the system adds "## Kiểm tra hiểu" separately.
                """;
    }
}
