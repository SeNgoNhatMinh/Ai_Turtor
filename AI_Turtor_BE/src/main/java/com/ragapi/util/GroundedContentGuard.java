package com.ragapi.util;

import java.util.LinkedHashSet;
import java.util.Arrays;
import java.util.HashSet;
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
    private static final Pattern VIETNAMESE_TEXT = Pattern.compile(
            "(?iu)[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]"
    );
    private static final Pattern STUDY_TIP_ITEM = Pattern.compile(
            "^(\\s*(?:[-*+] |\\d+[.)]\\s+))(.*)$"
    );
    private static final Set<String> STUDY_TIP_STOP_WORDS = new HashSet<>(Arrays.asList(
            "ban", "hay", "nen", "khi", "voi", "cua", "cho", "mot", "nhung", "cac", "nay",
            "kia", "do", "de", "duoc", "trong", "ngoai", "sau", "truoc", "hon", "roi", "lai",
            "va", "hoac", "neu", "thi", "ma", "rat", "giup", "tot", "hieu", "phan", "viec",
            "the", "vao", "ra", "tu", "den", "theo", "qua", "can", "cam", "thay", "dang"
    ));

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
        } else if (VIETNAMESE_TEXT.matcher(context == null ? "" : context).find()) {
            result = keepOnlyLexicallyGroundedStudyTips(result, context);
        }
        result = dropSections(result, OPTIONAL_PEDAGOGY_HEADING, true, context);
        return result.replaceAll("\\n{3,}", "\n\n").trim();
    }

    private static String keepOnlyLexicallyGroundedStudyTips(String answer, String context) {
        String result = answer;
        int searchFrom = 0;
        while (true) {
            if (searchFrom > result.length()) return result;
            Matcher heading = STUDY_TIPS_HEADING.matcher(result);
            if (!heading.find(searchFrom)) return result;
            int bodyStart = heading.end();
            Matcher next = HEADING.matcher(result.substring(bodyStart));
            int end = next.find() ? bodyStart + next.start() : result.length();
            String[] lines = result.substring(bodyStart, end).split("\\R", -1);
            StringBuilder kept = new StringBuilder();
            int keptItems = 0;
            for (String line : lines) {
                Matcher item = STUDY_TIP_ITEM.matcher(line);
                if (!item.matches()) continue;
                if (isLexicallyGrounded(item.group(2), context)) {
                    kept.append('\n').append(item.group(1)).append(item.group(2).trim());
                    keptItems++;
                }
            }
            if (keptItems == 0) {
                result = result.substring(0, heading.start()) + result.substring(end);
                searchFrom = Math.max(0, heading.start());
            } else {
                String replacement = result.substring(heading.start(), heading.end()) + kept + "\n";
                result = result.substring(0, heading.start()) + replacement + result.substring(end);
                searchFrom = heading.start() + replacement.length();
            }
            result = result.replaceAll("\\n{3,}", "\n\n").trim();
        }
    }

    private static boolean isLexicallyGrounded(String tip, String context) {
        String normalizedContext = TextSanitizer.normalizeAccentInsensitive(context);
        String normalizedTip = TextSanitizer.normalizeAccentInsensitive(tip);
        for (String token : normalizedTip.split("\\s+")) {
            if (token.length() < 3 || STUDY_TIP_STOP_WORDS.contains(token) || token.chars().allMatch(Character::isDigit)) {
                continue;
            }
            if (!containsWholeToken(normalizedContext, token)) return false;
        }
        return true;
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
