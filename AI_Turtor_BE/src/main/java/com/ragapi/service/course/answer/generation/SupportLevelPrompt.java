package com.ragapi.service.course.answer.generation;

import com.ragapi.service.behavior.plan.TeachingPlan;

import java.util.Locale;

/**
 * Single source of truth for HIGH_SUPPORT / STANDARD / CHALLENGE prompt rules.
 * Prefer {@link TeachingPlan#supportLevel()} over scanning pedagogical context strings.
 */
public enum SupportLevelPrompt {
    STANDARD,
    HIGH_SUPPORT,
    CHALLENGE;

    public static SupportLevelPrompt from(String raw) {
        if (raw == null || raw.isBlank()) {
            return STANDARD;
        }
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "HIGH_SUPPORT" -> HIGH_SUPPORT;
            case "CHALLENGE" -> CHALLENGE;
            default -> STANDARD;
        };
    }

    public static SupportLevelPrompt fromPlan(TeachingPlan plan) {
        return plan == null ? STANDARD : from(plan.supportLevel());
    }

    /**
     * Prefer explicit plan/support level fields. Fall back to an exact ACTIVE SUPPORT LEVEL
     * line — never a bare substring match that a behavior sentence could flip.
     */
    public static SupportLevelPrompt resolve(TeachingPlan plan, String supportLevel, String pedagogicalContext) {
        if (plan != null && plan.supportLevel() != null && !plan.supportLevel().isBlank()) {
            return from(plan.supportLevel());
        }
        if (supportLevel != null && !supportLevel.isBlank()) {
            return from(supportLevel);
        }
        if (pedagogicalContext == null || pedagogicalContext.isBlank()) {
            return STANDARD;
        }
        for (String line : pedagogicalContext.split("\n")) {
            String trimmed = line.trim().toUpperCase(Locale.ROOT);
            if (trimmed.startsWith("- ACTIVE SUPPORT LEVEL:")) {
                String value = trimmed.substring("- ACTIVE SUPPORT LEVEL:".length()).trim();
                int end = value.indexOf(' ');
                return from(end < 0 ? value : value.substring(0, end));
            }
            if (trimmed.startsWith("ACTIVE SUPPORT LEVEL:")) {
                String value = trimmed.substring("ACTIVE SUPPORT LEVEL:".length()).trim();
                int end = value.indexOf(' ');
                return from(end < 0 ? value : value.substring(0, end));
            }
        }
        return STANDARD;
    }

    public boolean isHighSupport() {
        return this == HIGH_SUPPORT;
    }

    public String quizCountInstruction() {
        return switch (this) {
            case HIGH_SUPPORT -> "Write 2 to 3 multiple-choice questions (no fewer than 2, no more than 3).";
            case CHALLENGE -> "Write 3 to 5 multiple-choice questions (no fewer than 3, no more than 5).";
            case STANDARD -> "Write exactly 3 multiple-choice questions.";
        };
    }

    /** Compact active-level reminder for tutor-context appendices. */
    public String activeLevelReminder() {
        return switch (this) {
            case HIGH_SUPPORT -> """
                    - Active support level: HIGH_SUPPORT.
                      Keep every concept the excerpts explain, plus one short textbook example for each.
                      Teach in small steps and simple Vietnamese: one idea, then the example, then what each line does.
                      Do not say the material is missing when the excerpts already cover the question.
                      Do not drop that example to make the answer shorter, and do not invent an example.
                      End with one easy recognition question whose choices are clearly different.
                    """.stripTrailing();
            case CHALLENGE -> """
                    - Active support level: CHALLENGE.
                      Reduce scaffolding, ask the student to reason from the material, and make the required
                      understanding check an application or comparison question without adding outside facts.
                    """.stripTrailing();
            case STANDARD -> """
                    - Active support level: STANDARD.
                      Balance explanation and learner effort. Make the required understanding check a direct
                      application of the lesson, using only the supplied course material.
                    """.stripTrailing();
        };
    }

    public String recoveryAppendix() {
        if (this != HIGH_SUPPORT) {
            return "";
        }
        return """

                HIGH_SUPPORT RECOVERY:
                This student needs one short textbook example for each concept the excerpts explain. Explain every
                shown line in simple Vietnamese. Do not copy every >>> prompt in the chapter, do not invent an
                example, and do not claim the course material is missing when the excerpts already answer.
                """;
    }

    /** Shared PERSONALIZED TUTORING support-level definitions for the main composer. */
    public static String personalizationRules() {
        return """
                - STANDARD is the default for every student: give a balanced explanation with normal pacing and moderate detail,
                  including one short textbook example when the course context contains one.
                - Use HIGH_SUPPORT only when ACTIVE PEDAGOGICAL DIRECTIVES explicitly says HIGH_SUPPORT. Apply it from the first answer.
                  A student at this level must receive the same concepts and the same short textbook examples a STANDARD answer would use.
                  Simpler wording means shorter sentences, not fewer examples.
                  For each concept the excerpts actually illustrate: one plain sentence, then one short textbook example,
                  then 2-4 bullets saying what each line does.
                  Use the examples that are present. Do not try to copy every >>> line in the chapter, and do not say the
                  course material is missing when those excerpts already explain the requested structures.
                  Do not invent an example, name, or result that the context does not show.
                  This overrides the rule that an example is included only when the student asks for one.
                  End with one easy three-choice check under "## Kiểm tra hiểu", then the lines "Đáp án:" and "Giải thích:".
                - Use CHALLENGE only when ACTIVE PEDAGOGICAL DIRECTIVES explicitly says CHALLENGE. Give less scaffolding,
                  ask guiding questions and encourage independent reasoning while still answering the question.
                """;
    }
}
