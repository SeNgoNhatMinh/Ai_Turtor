package com.ragapi.util;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TextSanitizer {

    private static final Charset WINDOWS_1252 = Charset.forName("windows-1252");
    private static final Pattern TOKEN_OR_SPACE = Pattern.compile("\\S+|\\s+");

    private TextSanitizer() {
    }

    public static String clean(String value) {
        if (value == null) {
            return null;
        }
        String result = value.trim();
        for (int i = 0; i < 4; i++) {
            String repaired = repairMojibakeOnce(result);
            if (repaired.equals(result)) {
                break;
            }
            result = repaired;
        }
        return result
                .replace('\u00a0', ' ')
                .replace('\uFFFD', ' ')
                .replaceAll("[ \\t]{2,}", " ")
                .replaceAll("(?m)^\\s+", "")
                .trim();
    }

    public static String cleanForStudentAnswer(String value) {
        String cleaned = clean(value);
        if (cleaned == null || cleaned.isBlank()) {
            return cleaned;
        }
        cleaned = stripUnexpectedScripts(cleaned);
        return cleaned.replaceAll("[ \\t]{2,}", " ").trim();
    }

    /** Lowercase, strip diacritics, keep letters/digits for cross-accent search/matching. */
    public static String normalizeAccentInsensitive(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String decomposed = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return decomposed
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replaceAll("[^\\p{L}\\p{N}+#]+", " ")
                .trim();
    }

    public static List<String> cleanList(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        LinkedHashSet<String> cleaned = new LinkedHashSet<>();
        for (String value : values) {
            String normalized = clean(value);
            if (normalized != null && !normalized.isBlank()) {
                cleaned.add(normalized);
            }
        }
        return new ArrayList<>(cleaned);
    }

    public static boolean isSystemFailureOrEscalationAnswer(String value) {
        String text = clean(value);
        if (text == null || text.isBlank()) {
            return true;
        }
        String lower = removeVietnameseTones(text).toLowerCase();
        return lower.contains("loi may chu")
                || lower.contains("khong the goi dich vu llm")
                || lower.contains("llm call failed")
                || lower.contains("ai suggestion failed")
                || lower.contains("server error")
                || lower.contains("minh dang xu ly hoi cham")
                || lower.contains("hien tai minh chua tao duoc cau tra loi")
                || lower.contains("minh chua phan tich xong phan nay")
                || (lower.contains("tai lieu hien co cua mon") && lower.contains("khong co noi dung du phu hop"))
                || lower.contains("he thong chua co tai lieu")
                || lower.contains("cau hoi se duoc chuyen")
                || lower.contains("chuyen cho giao vien")
                || (lower.contains("mentor phu trach") && lower.contains("tranh ai"))
                || lower.contains("question escalation created")
                || lower.contains("khong the cung cap ma nguon")
                || lower.contains("api key")
                || (lower.contains("token") && lower.contains("thong tin nhay cam"))
                || (lower.contains("minh la ai tutor cua mon") && lower.contains("paste code"));
    }

    private static String repairMojibakeOnce(String value) {
        if (!looksLikeMojibake(value)) {
            return value;
        }
        Candidate best = new Candidate(value, suspicionScore(value));
        best = chooseBetter(best, decodeCandidate(value, WINDOWS_1252));
        best = chooseBetter(best, decodeCandidate(value, StandardCharsets.ISO_8859_1));
        best = chooseBetter(best, repairByToken(value));
        return best.text();
    }

    private static Candidate decodeCandidate(String value, Charset charset) {
        try {
            String repaired = new String(value.getBytes(charset), StandardCharsets.UTF_8);
            return new Candidate(repaired, suspicionScore(repaired));
        } catch (Exception ignored) {
            return new Candidate(value, suspicionScore(value));
        }
    }

    private static Candidate repairByToken(String value) {
        Matcher matcher = TOKEN_OR_SPACE.matcher(value);
        StringBuilder repaired = new StringBuilder();
        while (matcher.find()) {
            String part = matcher.group();
            if (part.isBlank() || !looksLikeMojibake(part)) {
                repaired.append(part);
                continue;
            }
            Candidate original = new Candidate(part, suspicionScore(part));
            Candidate bestPart = chooseBetter(original, decodeCandidate(part, WINDOWS_1252));
            bestPart = chooseBetter(bestPart, decodeCandidate(part, StandardCharsets.ISO_8859_1));
            repaired.append(bestPart.text());
        }
        String result = repaired.toString();
        return new Candidate(result, suspicionScore(result));
    }

    private static Candidate chooseBetter(Candidate current, Candidate candidate) {
        if (candidate.score() < current.score()) {
            return candidate;
        }
        return current;
    }

    private record Candidate(String text, int score) {
    }

    private static boolean looksLikeMojibake(String value) {
        return value.indexOf('\u00c3') >= 0
                || value.indexOf('\u00c2') >= 0
                || value.indexOf('\u00c4') >= 0
                || value.indexOf('\u00c6') >= 0
                || value.contains("\u00e1\u00ba")
                || value.contains("\u00e1\u00bb")
                || value.contains("\u00e2\u20ac")
                || value.contains("\u00ef\u00bf\u00bd");
    }

    private static int suspicionScore(String value) {
        int score = 0;
        String[] markers = {
                "\u00c3", "\u00c2", "\u00c4", "\u00c6", "\u00e1\u00ba", "\u00e1\u00bb",
                "\u00e2\u20ac", "\u00ef\u00bf\u00bd", "\uFFFD"
        };
        for (String marker : markers) {
            int index = value.indexOf(marker);
            while (index >= 0) {
                score++;
                index = value.indexOf(marker, index + marker.length());
            }
        }
        int questionIndex = value.indexOf('?');
        while (questionIndex >= 0) {
            score++;
            questionIndex = value.indexOf('?', questionIndex + 1);
        }
        return score;
    }

    private static String stripUnexpectedScripts(String value) {
        return value.replaceAll("[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}\\p{IsCyrillic}]+", "");
    }

    private static String removeVietnameseTones(String value) {
        String normalized = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }
}

