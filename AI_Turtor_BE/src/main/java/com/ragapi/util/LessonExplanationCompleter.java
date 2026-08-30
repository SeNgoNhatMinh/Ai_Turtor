package com.ragapi.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Local models sometimes emit only "## Kiểm tra hiểu" for a numbered lesson.
 * The student must still receive a real explanation before the quiz.
 */
public final class LessonExplanationCompleter {

    private static final Pattern QUIZ_HEADING = Pattern.compile(
            "(?im)^#{1,6}\\s*(?:kiểm tra hiểu|understanding check)\\s*$");
    private static final Pattern HEADING_LINE = Pattern.compile("(?m)^#{1,6}\\s+\\S.*$");
    private static final int MIN_PROSE_CHARS = 160;

    private LessonExplanationCompleter() {
    }

    public static boolean missingLessonBody(String answer) {
        String prose = proseBeforeQuiz(answer);
        return prose.length() < MIN_PROSE_CHARS;
    }

    public static String lessonBodyPrompt(String question, String courseContext) {
        String topic = question == null ? "" : question.trim();
        String context = courseContext == null ? "" : courseContext.trim();
        if (context.length() > 2500) {
            context = context.substring(0, 2500);
        }
        return """
                Teach this one lesson in Vietnamese. Output ONLY the explanation.
                Start with heading ## Giải thích.
                Write at least 4 short paragraphs grounded in COURSE MATERIAL CONTEXT.
                Do not invent APIs, files, classes, or steps that are not in the context.
                If the context is thin, explain only what is there and say what is missing.
                Do not write a quiz, A/B/C options, Đáp án, ## Kiểm tra hiểu, or ## Bài tiếp theo.
                Do not mention prompts or instructions.

                STUDENT LESSON:
                %s

                COURSE MATERIAL CONTEXT:
                %s
                """.formatted(topic.isBlank() ? "(unnamed lesson)" : topic, context.isBlank() ? "(none)" : context);
    }

    public static String prependExplanation(String answer, String generated) {
        String explanation = sanitizeExplanation(generated);
        if (explanation.isBlank() || answer == null) {
            return answer;
        }
        if (!explanation.startsWith("#")) {
            explanation = "## Giải thích\n" + explanation;
        }
        Matcher quiz = QUIZ_HEADING.matcher(answer);
        if (!quiz.find()) {
            return (explanation + "\n\n" + answer).replaceAll("\\n{3,}", "\n\n").trim();
        }
        String before = answer.substring(0, quiz.start()).stripTrailing();
        String fromQuiz = answer.substring(quiz.start());
        String combined = before.isBlank()
                ? explanation + "\n\n" + fromQuiz
                : before + "\n\n" + explanation + "\n\n" + fromQuiz;
        return combined.replaceAll("\\n{3,}", "\n\n").trim();
    }

    static String sanitizeExplanation(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String text = PromptLeakFilter.strip(raw).trim();
        Matcher quiz = QUIZ_HEADING.matcher(text);
        if (quiz.find()) {
            text = text.substring(0, quiz.start()).trim();
        }
        return text.replaceFirst("(?im)^#{1,6}\\s*giải thích\\s*\n?", "## Giải thích\n").trim();
    }

    static String proseBeforeQuiz(String answer) {
        if (answer == null || answer.isBlank()) {
            return "";
        }
        Matcher quiz = QUIZ_HEADING.matcher(answer);
        String before = quiz.find() ? answer.substring(0, quiz.start()) : answer;
        return HEADING_LINE.matcher(before).replaceAll(" ").replaceAll("\\s+", " ").trim();
    }
}
