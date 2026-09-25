package com.ragapi.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Ensures a taught numbered lesson ends with one grounded understanding check. */
public final class LessonUnderstandingCheckCompleter {

    private static final Pattern CHECK_HEADING = Pattern.compile(
            "(?ium)^#{1,6}\\s*(?:kiểm tra hiểu|understanding check)\\s*$"
    );
    private static final Pattern NEXT_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");
    private static final Pattern INSERT_BEFORE = Pattern.compile(
            "(?ium)^#{1,6}\\s*(?:học chuyên sâu|học tiếp phần này|bài tiếp theo|nguồn tài liệu đã dùng)\\s*$"
    );

    private LessonUnderstandingCheckCompleter() {
    }

    public static boolean hasUsableCheck(String answer) {
        return UnderstandingCheckExtractor.extract(answer) != null;
    }

    public static String generationPrompt(String question, String courseContext) {
        return """
                Create exactly one short Vietnamese multiple-choice understanding check for the numbered lesson below.
                Use only facts explicitly present in COURSE MATERIAL CONTEXT. Do not use outside knowledge.
                Test the central learning objective, not a minor wording detail.
                Return exactly this Markdown block and nothing else:

                ## Kiểm tra hiểu
                Câu hỏi: <one clear question>
                A. <choice>
                B. <choice>
                C. <choice>
                Đáp án: <A or B or C>
                Giải thích: <one short sentence grounded in the context>

                LESSON REQUEST:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(
                question == null ? "" : question,
                limit(courseContext, 8_000)
        );
    }

    public static String insert(String answer, String generatedCheck) {
        if (answer == null || answer.isBlank() || hasUsableCheck(answer)) {
            return answer;
        }
        String check = extractCheckSection(generatedCheck);
        if (check == null || !hasUsableCheck(check)) {
            return answer;
        }

        Matcher insertion = INSERT_BEFORE.matcher(answer);
        int index = insertion.find() ? insertion.start() : answer.length();
        String before = answer.substring(0, index).stripTrailing();
        String after = answer.substring(index).stripLeading();
        return after.isBlank()
                ? before + "\n\n" + check
                : before + "\n\n" + check + "\n\n" + after;
    }

    private static String extractCheckSection(String generated) {
        if (generated == null || generated.isBlank()) {
            return null;
        }
        String cleaned = TextSanitizer.cleanForStudentAnswer(generated);
        Matcher heading = CHECK_HEADING.matcher(cleaned);
        if (!heading.find()) {
            return null;
        }
        String rest = cleaned.substring(heading.end());
        Matcher next = NEXT_HEADING.matcher(rest);
        int end = next.find() ? heading.end() + next.start() : cleaned.length();
        return cleaned.substring(heading.start(), end).trim();
    }

    private static String limit(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "(no context)";
        }
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }
}
