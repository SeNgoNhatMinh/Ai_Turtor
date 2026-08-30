package com.ragapi.util;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Ensures LLM Vietnamese answers use full diacritics (có dấu).
 */
public final class VietnameseOutputEnforcer {

    private static final Pattern WORD_SPLIT = Pattern.compile("\\s+");
    private static final Pattern VI_DIACRITIC = Pattern.compile(
            "[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩị"
                    + "òóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
                    + "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊ"
                    + "ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]"
    );

    private static final Set<String> TONELESS_VI_WORDS = Set.of(
            "khong", "duoc", "hoc", "mon", "tai", "lieu", "cua", "nhu", "the", "nao",
            "gi", "voi", "cho", "nguoi", "sinh", "giao", "vien", "tra", "loi", "he",
            "thong", "ban", "toi", "anh", "chi", "em", "can", "muon", "dieu", "neu",
            "va", "hay", "hoac", "sau", "truoc", "khi", "trong", "ngoai", "tren", "duoi",
            "theo", "cac", "nhung", "mot", "nhieu", "it", "rat", "se", "da", "dang",
            "nen", "vi", "ma", "thi", "la", "co", "lam", "dung", "sai"
    );

    private static final String PROMPT_SUFFIX = """

            MANDATORY VIETNAMESE OUTPUT (CRITICAL):
            - When writing Vietnamese, ALWAYS use correct diacritics (có dấu): ví dụ "học", "môn học", "tài liệu", "không", "được".
            - NEVER write toneless Vietnamese such as "hoc", "mon hoc", "tai lieu", "khong", "duoc".
            - If the student writes Vietnamese without accents, still reply in proper Vietnamese with full diacritics.
            - Keep English technical terms, code, APIs, class names, and materialId values unchanged.
            """;

    private VietnameseOutputEnforcer() {
    }

    public static String wrapPrompt(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return prompt;
        }
        if (prompt.contains("MANDATORY VIETNAMESE OUTPUT")) {
            return prompt;
        }
        return prompt + PROMPT_SUFFIX;
    }

    /**
     * Local models must finish every required heading with real content, not a stub.
     */
    public static String wrapOllamaCompleteness(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return prompt;
        }
        if (prompt.contains("LOCAL MODEL OUTPUT BUDGET")) {
            return prompt;
        }
        return prompt + """

                LOCAL MODEL OUTPUT BUDGET:
                - Write a FULL student-facing lesson. Cover every required heading with real content (not one-line stubs).
                - Include explanation, a small example when the material supports it, the understanding-check (A/B/C), and sources.
                - Never stop mid-sentence, mid-list, or mid-code fence. Close every markdown code fence.
                - Do not omit a required heading to save tokens. Finish the last heading before you stop.
                """;
    }

    public static String buildCorrectionPrompt(String text) {
        return """
                You are a Vietnamese copy editor. Fix ONLY missing diacritics in the text below.
                Rules:
                - Output ONLY the corrected text, no explanation.
                - Keep markdown headings, bullets, English terms, code, URLs, and materialId unchanged.
                - Convert toneless Vietnamese to proper Vietnamese with diacritics.

                TEXT:
                %s
                """.formatted(text == null ? "" : text);
    }

    public static boolean needsDiacriticsCorrection(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        if (!containsVietnameseIntent(text)) {
            return false;
        }
        if (isEnglishPrimary(text)) {
            return false;
        }
        int tonelessHits = countTonelessViWords(text);
        double diacriticRatio = vietnameseDiacriticRatio(text);
        return tonelessHits >= 2 && diacriticRatio < 0.08;
    }

    public static double vietnameseDiacriticRatio(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        int letters = 0;
        int withDiacritics = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (Character.isLetter(ch)) {
                letters++;
                if (VI_DIACRITIC.matcher(String.valueOf(ch)).matches()) {
                    withDiacritics++;
                }
            }
        }
        if (letters == 0) {
            return 0;
        }
        return (double) withDiacritics / letters;
    }

    public static int countTonelessViWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(text);
        int hits = 0;
        for (String token : WORD_SPLIT.split(normalized)) {
            if (token.length() >= 2 && TONELESS_VI_WORDS.contains(token)) {
                hits++;
            }
        }
        return hits;
    }

    public static boolean containsVietnameseIntent(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        if (VI_DIACRITIC.matcher(text).find()) {
            return true;
        }
        return countTonelessViWords(text) >= 2;
    }

    public static boolean isEnglishPrimary(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        int asciiWords = 0;
        int viTonelessHits = 0;
        for (String raw : text.split("\\s+")) {
            String token = raw.replaceAll("[^\\p{L}\\p{N}]+", "").toLowerCase(Locale.ROOT);
            if (token.length() < 3) {
                continue;
            }
            if (token.chars().allMatch(ch -> ch < 128)) {
                asciiWords++;
            }
            if (TONELESS_VI_WORDS.contains(TextSanitizer.normalizeAccentInsensitive(token))) {
                viTonelessHits++;
            }
        }
        return asciiWords >= 8 && viTonelessHits <= 1 && vietnameseDiacriticRatio(text) < 0.03;
    }

    /** Compare outputs — higher score means more Vietnamese diacritics. */
    public static int diacriticsScore(String text) {
        if (text == null) {
            return 0;
        }
        int score = 0;
        var matcher = VI_DIACRITIC.matcher(text);
        while (matcher.find()) {
            score++;
        }
        return score;
    }
}
