package com.ragapi.util;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic guardrails for student-facing RAG additions. Prompt instructions
 * alone are not a sufficient grounding boundary because a model can still invent
 * a quiz topic or a study recommendation that is absent from the retrieved text.
 */
public final class GroundedContentGuard {

    private static final Pattern CALL_REFERENCE = Pattern.compile(
            "(?iu)(?<![\\p{L}\\p{N}_])([a-z_][a-z0-9_]{2,})\\s*\\("
    );
    private static final Pattern HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");
    private static final Pattern STUDY_TIPS_HEADING = Pattern.compile(
            "(?ium)^#{1,6}\\s*(?:lưu ý để học tốt hơn|study tips?)\\s*$"
    );
    private static final Pattern OPTIONAL_PEDAGOGY_HEADING = Pattern.compile(
            "(?ium)^#{1,6}\\s*(?:kiểm tra hiểu|understanding check|"
                    + "học tiếp phần này|học chuyên sâu)\\s*$"
    );
    private static final Pattern EXPLICIT_STUDY_ADVICE = Pattern.compile(
            "(?iu)\\b(?:thực hành|bài tập|ôn tập|luyện tập|hãy thử|lưu ý|"
                    + "practice|exercise|review|study tip|try to|remember to)\\b"
    );

    private GroundedContentGuard() {
    }

    /** Returns function/API call names used by the question but absent from evidence. */
    public static Set<String> unsupportedCallReferences(String question, String context) {
        Set<String> unsupported = new LinkedHashSet<>();
        String normalizedContext = TextSanitizer.normalizeAccentInsensitive(context)
                .toLowerCase(Locale.ROOT);
        Matcher matcher = CALL_REFERENCE.matcher(question == null ? "" : question);
        while (matcher.find()) {
            String reference = matcher.group(1).toLowerCase(Locale.ROOT);
            if (!containsWholeToken(normalizedContext, reference)) {
                unsupported.add(reference + "()");
            }
        }
        return unsupported;
    }

    /**
     * Removes optional teaching widgets when their subject is not present in the
     * retrieved evidence. Study tips are even stricter: the material itself must
     * contain an explicit exercise/review recommendation.
     */
    public static String stripUnsupportedOptionalSections(String answer, String context) {
        if (answer == null || answer.isBlank()) {
            return answer;
        }
        String result = answer;
        if (!EXPLICIT_STUDY_ADVICE.matcher(context == null ? "" : context).find()) {
            result = dropSections(result, STUDY_TIPS_HEADING, false, context);
        }
        result = dropSections(result, OPTIONAL_PEDAGOGY_HEADING, true, context);
        return result.replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static String dropSections(
            String answer,
            Pattern headingPattern,
            boolean onlyWhenTechnicalReferenceIsUnsupported,
            String context
    ) {
        String result = answer;
        int searchFrom = 0;
        while (true) {
            Matcher heading = headingPattern.matcher(result);
            if (!heading.find(searchFrom)) {
                return result;
            }
            int bodyStart = heading.end();
            Matcher next = HEADING.matcher(result.substring(bodyStart));
            int end = next.find() ? bodyStart + next.start() : result.length();
            String body = result.substring(bodyStart, end);
            boolean shouldDrop = !onlyWhenTechnicalReferenceIsUnsupported
                    || !unsupportedCallReferences(body, context).isEmpty();
            if (!shouldDrop) {
                searchFrom = end;
                continue;
            }
            result = result.substring(0, heading.start()) + result.substring(end);
            result = result.replaceAll("\\n{3,}", "\n\n").trim();
        }
    }

    private static boolean containsWholeToken(String normalizedText, String token) {
        return Pattern.compile(
                "(?<![\\p{L}\\p{N}_])" + Pattern.quote(token) + "(?![\\p{L}\\p{N}_])",
                Pattern.UNICODE_CHARACTER_CLASS
        ).matcher(normalizedText).find();
    }
}
