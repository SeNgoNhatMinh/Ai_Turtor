package com.ragapi.harness.util;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps one chat request inside a provider token budget.
 * Groq's on-demand tier rejects a request whose size exceeds the whole
 * tokens-per-minute limit, and the student then receives no lesson.
 */
public final class PromptTokenBudget {

    /** Conservative for Vietnamese and code: one token per two characters. */
    static final int CHARS_PER_TOKEN = 2;

    private static final int SECTION_FLOOR_CHARS = 400;
    private static final Pattern LIMIT_THEN_REQUESTED = Pattern.compile(
            "limit\\s+(\\d+)\\D{0,40}requested\\s+(\\d+)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern REQUESTED_THEN_LIMIT = Pattern.compile(
            "requested\\s+(\\d+)\\D{0,40}limit\\s+(\\d+)",
            Pattern.CASE_INSENSITIVE
    );
    /** Optional tutor notes. The textbook excerpt is not in this list. */
    private static final String[] TRIMMABLE_SECTIONS = {
            "ACTIVE PEDAGOGICAL DIRECTIVES:",
            "STUDENT LEARNING CONTEXT:"
    };
    private static final String CONTEXT_HEADER = "COURSE MATERIAL CONTEXT:";
    private static final String[] SECTION_END_MARKERS = {
            "\nSTUDENT QUESTION:",
            "\nSTUDENT LESSON:",
            "\nCOURSE MATERIAL CONTEXT:",
            "\nACTIVE PEDAGOGICAL DIRECTIVES:",
            "\nSTUDENT LEARNING CONTEXT:",
            "\nSOURCE MATERIAL IDS:",
            "\nRESPONSE FORMAT:",
            "\nSCOPE:",
            "\nWORKER-",
            "\nMANDATORY "
    };

    private PromptTokenBudget() {
    }

    public static int estimateTokens(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        return (text.length() + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN;
    }

    public static String fit(String prompt, int maxInputTokens) {
        if (prompt == null || maxInputTokens <= 0) {
            return prompt;
        }
        return fitChars(prompt, Math.max(1, maxInputTokens) * CHARS_PER_TOKEN);
    }

    /**
     * True when the provider rejected the request because the input itself is
     * larger than its token limit. Output-token limits are a different failure.
     */
    public static boolean inputExceedsReportedLimit(String errorText) {
        if (errorText == null || errorText.isBlank()) {
            return false;
        }
        String text = errorText.toLowerCase(Locale.ROOT);
        if (text.contains("output token") || text.contains("otpm")) {
            return false;
        }
        if (!text.contains("request too large") && !text.contains("tokens per minute")) {
            return false;
        }
        int[] limitRequested = parseLimitRequested(errorText);
        return limitRequested != null && limitRequested[1] > limitRequested[0];
    }

    /** Shorten a rejected prompt using the provider's own Limit and Requested counts. */
    public static String shrinkToReportedLimit(String prompt, String errorText) {
        if (prompt == null || prompt.isEmpty()) {
            return prompt;
        }
        int[] limitRequested = parseLimitRequested(errorText);
        int targetChars;
        if (limitRequested == null || limitRequested[1] <= 0) {
            targetChars = Math.max(800, prompt.length() * 3 / 4);
        } else {
            int limit = limitRequested[0];
            int requested = limitRequested[1];
            targetChars = (int) Math.floor(prompt.length() * (limit * 0.75d) / requested);
            targetChars = Math.max(800, targetChars);
        }
        if (targetChars >= prompt.length()) {
            targetChars = Math.max(800, prompt.length() * 3 / 4);
        }
        return fitChars(prompt, targetChars);
    }

    private static String fitChars(String prompt, int maxChars) {
        if (prompt.length() <= maxChars) {
            return prompt;
        }
        String fitted = prompt;
        for (String header : TRIMMABLE_SECTIONS) {
            if (fitted.length() <= maxChars) {
                return fitted;
            }
            fitted = shrinkSection(fitted, header, maxChars);
        }
        if (fitted.length() <= maxChars) {
            return fitted;
        }
        return keepLesson(fitted, maxChars);
    }

    /**
     * The textbook excerpt and the student question stay. The long instruction
     * preamble is what shrinks, because cutting the chapter makes a shallow answer.
     */
    private static String keepLesson(String prompt, int maxChars) {
        int questionAt = questionStart(prompt);
        String question = questionAt >= 0 ? prompt.substring(questionAt) : "";
        int contextAt = prompt.lastIndexOf(CONTEXT_HEADER);
        if (contextAt >= 0 && (questionAt < 0 || contextAt < questionAt)) {
            int contextEnd = questionAt > contextAt ? questionAt : prompt.length();
            String context = prompt.substring(contextAt, contextEnd);
            String lesson = context + question;
            if (lesson.length() >= maxChars) {
                return fitProtectedLesson(context, question, maxChars);
            }
            int instructionRoom = maxChars - lesson.length();
            String instructions = prompt.substring(0, contextAt);
            if (instructions.length() > instructionRoom) {
                instructions = instructions.substring(0, Math.max(0, instructionRoom)).stripTrailing();
            }
            return instructions + lesson;
        }
        if (question.length() >= maxChars) {
            return question.substring(0, maxChars);
        }
        int headBudget = maxChars - question.length();
        String head = questionAt > 0 ? prompt.substring(0, questionAt) : prompt;
        if (head.length() > headBudget) {
            head = head.substring(Math.max(0, head.length() - headBudget));
        }
        return head + question;
    }

    private static String fitProtectedLesson(String context, String question, int maxChars) {
        if (question.length() >= maxChars) {
            return question.substring(question.length() - maxChars);
        }
        int contextRoom = maxChars - question.length();
        String keptContext = context.length() <= contextRoom
                ? context
                : context.substring(0, contextRoom).stripTrailing();
        return keptContext + question;
    }

    private static int questionStart(String prompt) {
        int questionAt = prompt.lastIndexOf("\nSTUDENT QUESTION:");
        int lessonAt = prompt.lastIndexOf("\nSTUDENT LESSON:");
        if (questionAt < 0) {
            return lessonAt;
        }
        if (lessonAt < 0) {
            return questionAt;
        }
        return Math.max(questionAt, lessonAt);
    }

    private static String shrinkSection(String prompt, String header, int maxChars) {
        String current = prompt;
        while (current.length() > maxChars) {
            int headerAt = current.indexOf(header);
            if (headerAt < 0) {
                break;
            }
            int bodyStart = headerAt + header.length();
            int bodyEnd = sectionEnd(current, bodyStart);
            String body = current.substring(bodyStart, bodyEnd);
            int removable = Math.max(0, body.length() - SECTION_FLOOR_CHARS);
            int overflow = current.length() - maxChars;
            if (removable == 0 || overflow <= 0) {
                break;
            }
            int cut = Math.min(removable, overflow);
            String kept = body.substring(0, body.length() - cut).stripTrailing();
            if (cut >= 24) {
                kept = kept + "\n[...]";
            }
            String next = current.substring(0, bodyStart) + kept + current.substring(bodyEnd);
            if (next.length() >= current.length()) {
                break;
            }
            current = next;
        }
        return current;
    }

    private static int sectionEnd(String prompt, int bodyStart) {
        int end = prompt.length();
        for (String marker : SECTION_END_MARKERS) {
            int at = prompt.indexOf(marker, bodyStart);
            if (at >= bodyStart && at < end) {
                end = at;
            }
        }
        return end;
    }

    private static int[] parseLimitRequested(String errorText) {
        if (errorText == null) {
            return null;
        }
        Matcher limitFirst = LIMIT_THEN_REQUESTED.matcher(errorText);
        if (limitFirst.find()) {
            return new int[] {Integer.parseInt(limitFirst.group(1)), Integer.parseInt(limitFirst.group(2))};
        }
        Matcher requestedFirst = REQUESTED_THEN_LIMIT.matcher(errorText);
        if (requestedFirst.find()) {
            return new int[] {Integer.parseInt(requestedFirst.group(2)), Integer.parseInt(requestedFirst.group(1))};
        }
        return null;
    }
}
