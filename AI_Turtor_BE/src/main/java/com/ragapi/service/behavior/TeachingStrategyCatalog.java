package com.ragapi.service.behavior;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Stable teaching-strategy catalog. Codes are the only values the review LLM
 * may recommend; instructions are what the tutor prompt receives after teacher approval.
 */
public enum TeachingStrategyCatalog {

    STEP_BY_STEP(
            "Giải thích từng bước",
            "Chia kiến thức thành các bước nhỏ, tuần tự.",
            """
            Apply STEP_BY_STEP: break the explanation into small, logically ordered steps.
            Do not skip intermediate reasoning. Number the steps the student sees.
            """),

    VISUAL_EXAMPLES(
            "Ví dụ trực quan",
            "Minh họa bằng ví dụ thực tế, sơ đồ hoặc code từ tài liệu.",
            """
            Apply VISUAL_EXAMPLES: prefer a concrete example, short diagram, or code illustration
            grounded in COURSE MATERIAL CONTEXT. Do not invent APIs or results.
            """),

    GUIDED_PRACTICE(
            "Thực hành có hướng dẫn",
            "Hướng dẫn sinh viên giải bài tập từng bước, không đưa lời giải hoàn chỉnh.",
            """
            Apply GUIDED_PRACTICE: give a scaffolded exercise with blanks or hints.
            Never reveal the full finished solution unless the student already solved it.
            """),

    SOCRATIC_QUESTIONING(
            "Câu hỏi gợi mở",
            "Đặt câu hỏi giúp sinh viên tự suy luận.",
            """
            Apply SOCRATIC_QUESTIONING: ask short guiding questions that push the student to reason.
            Still answer the core question; do not only interrogate.
            """),

    CONCEPT_COMPARISON(
            "So sánh khái niệm",
            "Phân biệt các khái niệm dễ nhầm lẫn.",
            """
            Apply CONCEPT_COMPARISON: contrast the target idea with the nearest related idea
            from the material in a short table or paired bullets.
            """),

    MISCONCEPTION_REMEDIATION(
            "Sửa hiểu lầm",
            "Xác định và sửa các quan niệm sai lặp lại.",
            """
            Apply MISCONCEPTION_REMEDIATION: name the likely misconception explicitly,
            correct it with material-backed facts, then give one check question.
            """),

    CONCRETE_TO_ABSTRACT(
            "Cụ thể đến trừu tượng",
            "Bắt đầu bằng ví dụ cụ thể rồi mới giải thích lý thuyết.",
            """
            Apply CONCRETE_TO_ABSTRACT: start with a concrete example from the material,
            then generalize to the definition or rule.
            """),

    RETRIEVAL_PRACTICE(
            "Gợi nhớ chủ động",
            "Yêu cầu sinh viên tự nhớ và diễn đạt lại kiến thức.",
            """
            Apply RETRIEVAL_PRACTICE: briefly prompt the student to recall or restate
            a key idea before or after the explanation. Do not grade them harshly.
            """),

    INDEPENDENT_CHALLENGE(
            "Thử thách độc lập",
            "Tăng khả năng tự giải quyết vấn đề với ít scaffolding hơn.",
            """
            Apply INDEPENDENT_CHALLENGE: reduce scaffolding, give a harder check rooted
            in the material, and encourage independent reasoning without inventing facts.
            """),

    CODE_WALKTHROUGH(
            "Phân tích code",
            "Đọc và giải thích code theo từng dòng hoặc khối logic.",
            """
            Apply CODE_WALKTHROUGH: walk through code from the material line-by-line or by logic block.
            Explain what each part does; do not invent code outside the excerpts.
            """);

    private final String displayName;
    private final String shortDescription;
    private final String teachingInstruction;

    TeachingStrategyCatalog(String displayName, String shortDescription, String teachingInstruction) {
        this.displayName = displayName;
        this.shortDescription = shortDescription;
        this.teachingInstruction = teachingInstruction.strip();
    }

    public String code() {
        return name();
    }

    public String displayName() {
        return displayName;
    }

    public String shortDescription() {
        return shortDescription;
    }

    public String teachingInstruction() {
        return teachingInstruction;
    }

    /** Legacy ExplanationStyles label → catalog code, when mappable. */
    public static Optional<TeachingStrategyCatalog> fromLegacyLabel(String label) {
        if (label == null || label.isBlank()) return Optional.empty();
        String lower = label.trim().toLowerCase(Locale.ROOT);
        if (lower.startsWith("giải thích khái niệm") || lower.contains("từng bước")) return Optional.of(STEP_BY_STEP);
        if (lower.startsWith("ví dụ thực tế")) return Optional.of(VISUAL_EXAMPLES);
        if (lower.startsWith("minh họa trực quan")) return Optional.of(VISUAL_EXAMPLES);
        if (lower.startsWith("bảng so sánh") || lower.startsWith("so sánh")) return Optional.of(CONCEPT_COMPARISON);
        if (lower.startsWith("bài tập có hướng dẫn")) return Optional.of(GUIDED_PRACTICE);
        if (lower.startsWith("tự kiểm tra")) return Optional.of(RETRIEVAL_PRACTICE);
        return Optional.empty();
    }

    public static Optional<TeachingStrategyCatalog> fromCode(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        try {
            return Optional.of(TeachingStrategyCatalog.valueOf(raw.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException ignored) {
            return Optional.empty();
        }
    }

    public static boolean isKnown(String raw) {
        return fromCode(raw).isPresent();
    }

    public static List<TeachingStrategyCatalog> all() {
        return Arrays.asList(values());
    }

    public Map<String, Object> toPublicMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("strategyCode", code());
        map.put("strategyName", displayName);
        map.put("description", shortDescription);
        return map;
    }

    /** Catalog text for the adaptive-review LLM. */
    public static String reviewCatalogPrompt() {
        StringBuilder builder = new StringBuilder();
        builder.append("""
                strategyRecommendations must use ONLY these strategyCode values.
                Do not invent new codes. Prefer 1 to 3 items with real evidence.
                If evidence is weak, return an empty array.
                """);
        for (TeachingStrategyCatalog item : values()) {
            builder.append("- ").append(item.code()).append(" (").append(item.displayName())
                    .append("): ").append(item.shortDescription()).append('\n');
        }
        return builder.toString();
    }

    /** Prompt block for approved active strategies. */
    public static String activeContextBlock(List<TeachingStrategyCatalog> strategies) {
        if (strategies == null || strategies.isEmpty()) return "";
        StringBuilder block = new StringBuilder();
        block.append("""
                ACTIVE TEACHING STRATEGIES
                The following teaching strategies have been explicitly approved by the student's teacher.
                Apply them naturally. Do not force every strategy into every response.
                Select the relevant strategy based on the student's question.
                Strategies guide HOW to teach. COURSE MATERIAL CONTEXT remains the only source of facts.
                Do not invent information outside the retrieved course material.

                """);
        int index = 1;
        for (TeachingStrategyCatalog strategy : strategies) {
            block.append(index++).append(". ").append(strategy.code()).append(" — ")
                    .append(strategy.displayName()).append('\n')
                    .append(strategy.teachingInstruction()).append("\n\n");
        }
        return block.toString().stripTrailing();
    }
}
