package com.ragapi.util;

import com.ragapi.dto.UnderstandingCheckPayload;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Converts the legacy markdown understanding-check block into a typed API payload.
 * The answer text is intentionally kept for backward compatibility with saved chats.
 */
public final class UnderstandingCheckExtractor {

    private static final Pattern CHECK_HEADING = Pattern.compile(
            "(?ium)^#{1,6}\\s*(?:kiểm tra hiểu|understanding check)\\s*$");
    private static final Pattern NEXT_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");
    private static final Pattern OPTION = Pattern.compile(
            "(?iu)(?:^|\\s)(?:\\(([A-D])\\)|([A-D])\\.)\\s+");
    private static final Pattern QUESTION_PREFIX = Pattern.compile(
            "(?iu)^(?:câu hỏi|cau hoi|question)\\s*[:：]\\s*");
    private static final Pattern ANSWER = Pattern.compile(
            "(?iu)(?:^|\\s)(?:đáp án|dap an|(?:the\\s+)?(?:correct\\s+)?answer)"
                    + "(?:\\s+đúng)?\\s*(?:là|is|:|：|-)?\\s*([A-D])\\b");
    private static final Pattern EXPLANATION = Pattern.compile(
            "(?iu)(?:^|\\s)(?:giải thích|giai thich|explanation|lý do|ly do)\\s*[:：]\\s*");
    private static final Pattern DECORATION = Pattern.compile("[*_`]+");

    private UnderstandingCheckExtractor() {
    }

    public static UnderstandingCheckPayload extract(String answer) {
        String body = findBody(answer);
        if (body == null || body.isBlank()) {
            return null;
        }

        String raw = DECORATION.matcher(body).replaceAll("").trim();
        Matcher answerMatcher = ANSWER.matcher(raw);
        boolean hasAnswer = answerMatcher.find();
        Matcher explanationMatcher = EXPLANATION.matcher(raw);
        boolean hasExplanation = explanationMatcher.find();

        int metadataStart = raw.length();
        if (hasAnswer) metadataStart = Math.min(metadataStart, answerMatcher.start());
        if (hasExplanation) metadataStart = Math.min(metadataStart, explanationMatcher.start());
        String visible = raw.substring(0, metadataStart).trim();

        List<OptionMark> marks = new ArrayList<>();
        Matcher optionMatcher = OPTION.matcher(visible);
        while (optionMatcher.find()) {
            String key = optionMatcher.group(1) != null ? optionMatcher.group(1) : optionMatcher.group(2);
            marks.add(new OptionMark(key.toUpperCase(Locale.ROOT), optionMatcher.start(), optionMatcher.end()));
        }
        if (marks.size() < 2) {
            return null;
        }

        String question = clean(visible.substring(0, marks.get(0).start()));
        question = QUESTION_PREFIX.matcher(question).replaceFirst("").replaceAll("[?\\s]+$", "").trim();
        if (question.isBlank()) {
            return null;
        }

        List<UnderstandingCheckPayload.Option> options = new ArrayList<>();
        for (int index = 0; index < marks.size(); index++) {
            OptionMark mark = marks.get(index);
            int end = index + 1 < marks.size() ? marks.get(index + 1).start() : visible.length();
            String text = clean(visible.substring(mark.textStart(), end)).replaceAll("[;|]+$", "").trim();
            if (!text.isBlank()) {
                options.add(new UnderstandingCheckPayload.Option(mark.key(), text));
            }
        }
        if (options.size() < 2) {
            return null;
        }

        String correctKey = hasAnswer ? answerMatcher.group(1).toUpperCase(Locale.ROOT) : "";
        String explanation = "";
        if (hasExplanation) {
            int start = explanationMatcher.end();
            int end = hasAnswer && answerMatcher.start() > start ? answerMatcher.start() : raw.length();
            explanation = clean(raw.substring(start, end));
        }

        return new UnderstandingCheckPayload(question + "?", options, correctKey, explanation);
    }

    private static String findBody(String answer) {
        if (answer == null || answer.isBlank()) return null;
        Matcher heading = CHECK_HEADING.matcher(answer);
        if (!heading.find()) return null;
        int bodyStart = heading.end();
        String rest = answer.substring(bodyStart);
        Matcher next = NEXT_HEADING.matcher(rest);
        int bodyEnd = next.find() ? bodyStart + next.start() : answer.length();
        return answer.substring(bodyStart, bodyEnd);
    }

    private static String clean(String value) {
        return String.valueOf(value)
                .replaceAll("(?m)^\\s*[-*+]\\s+", "")
                .replaceAll("(?m)^\\s*-{3,}\\s*$", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record OptionMark(String key, int start, int textStart) {
    }
}
