package com.ragapi.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Prevents visibly cut-off or placeholder-shortened tutor answers from being persisted. */
public final class StudentAnswerCompletenessGuard {

    private static final Pattern ABBREVIATED_FENCED_OUTPUT = Pattern.compile(
            "(?s)```[^\\n]*\\n(?=[^`]*(?:,\\s*(?:\\.\\.\\.|\u2026)\\s*[}\\]]))[^`]*```"
    );
    private static final Pattern DANGLING_EXAMPLE_LEAD_IN = Pattern.compile(
            "(?im)^(.*?)(?:,?\\s*(?:ví dụ|for example))\\s*:\\s*$\\R*"
    );
    private static final Pattern INCOMPLETE_ENDING = Pattern.compile(
            "(?iu)(?:\\.\\.\\.|\u2026|[:,;]|\\b(?:và|hoặc|and|or|because|vì))$"
    );

    private StudentAnswerCompletenessGuard() {
    }

    public static boolean isClearlyIncomplete(String answer) {
        if (answer == null || answer.isBlank()) return true;
        String trimmed = answer.trim();
        if (count(trimmed, "```") % 2 != 0) return true;
        return INCOMPLETE_ENDING.matcher(trimmed).find();
    }

    public static boolean containsAbbreviatedExampleOutput(String answer) {
        return answer != null && ABBREVIATED_FENCED_OUTPUT.matcher(answer).find();
    }

    public static String removeAbbreviatedExampleOutputs(String answer) {
        if (answer == null || answer.isBlank()) return answer;
        Matcher matcher = ABBREVIATED_FENCED_OUTPUT.matcher(answer);
        String result = matcher.replaceAll("");
        result = DANGLING_EXAMPLE_LEAD_IN.matcher(result).replaceAll("$1.\n");
        return result.replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static int count(String text, String needle) {
        int count = 0;
        int from = 0;
        while ((from = text.indexOf(needle, from)) >= 0) {
            count++;
            from += needle.length();
        }
        return count;
    }
}
