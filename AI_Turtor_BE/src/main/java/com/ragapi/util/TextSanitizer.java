package com.ragapi.util;

import com.fasterxml.jackson.databind.ObjectMapper;

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
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Pattern TOKEN_OR_SPACE = Pattern.compile("\\S+|\\s+");
    private static final Pattern COMPLETE_REASONING_BLOCK = Pattern.compile(
            "(?is)<(?:think|analysis|reasoning)>.*?</(?:think|analysis|reasoning)>"
    );
    private static final Pattern REASONING_TAG = Pattern.compile(
            "(?is)</?(?:think|analysis|reasoning)>"
    );
    private static final Pattern TRAILING_LINE_WHITESPACE = Pattern.compile("[ \\t]+$", Pattern.MULTILINE);
    private static final Pattern EXCESSIVE_BLANK_LINES = Pattern.compile("\\n{3,}");
    private static final Pattern MARKDOWN_HEADING = Pattern.compile("(?m)^#{1,6}\\s+\\S");

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
        if (value == null) {
            return null;
        }
        String cleaned = cleanMarkdownAnswerTransport(value);
        if (cleaned == null || cleaned.isBlank()) {
            return cleaned;
        }
        cleaned = stripReasoningEnvelope(cleaned);
        if (cleaned.isBlank()) {
            return cleaned;
        }
        cleaned = stripUnexpectedScripts(cleaned);
        cleaned = PromptLeakFilter.strip(cleaned);
        return finalizeMarkdownWhitespace(cleaned);
    }

    /**
     * Normalize a streamed student-answer chunk without converting it into a full
     * answer. This preserves real newline characters and only decodes transport
     * escaping when a provider accidentally emits literal "\\n" sequences.
     */
    public static String cleanStreamingAnswerChunk(String value) {
        if (value == null) {
            return null;
        }
        String result = unwrapJsonStringAnswer(value);
        result = decodeEscapedMarkdownLineBreaks(result);
        return result.replace("\r\n", "\n").replace('\r', '\n');
    }

    private static String stripReasoningEnvelope(String value) {
        String withoutCompleteBlocks = COMPLETE_REASONING_BLOCK.matcher(value).replaceAll("").trim();
        if (REASONING_TAG.matcher(withoutCompleteBlocks).find()) {
            return "";
        }
        String lower = withoutCompleteBlocks.toLowerCase(Locale.ROOT);
        if (lower.contains("here's a thinking process:")
                || (lower.contains("self-correction/verification") && lower.contains("[output generation]"))) {
            return "";
        }
        return withoutCompleteBlocks;
    }

    private static String cleanMarkdownAnswerTransport(String value) {
        String result = value;
        for (int i = 0; i < 4; i++) {
            String repaired = repairMojibakeOnce(result);
            if (repaired.equals(result)) {
                break;
            }
            result = repaired;
        }
        result = result
                .replace('\u00a0', ' ')
                .replace('\uFFFD', ' ');
        result = normalizeMarkdownTransport(result);
        return finalizeMarkdownWhitespace(result);
    }

    private static String normalizeMarkdownTransport(String value) {
        String result = value == null ? null : value.trim();
        if (result == null || result.isBlank()) {
            return result;
        }

        result = unwrapJsonStringAnswer(result);
        result = decodeEscapedMarkdownLineBreaks(result);
        result = result.replace("\r\n", "\n").replace('\r', '\n');
        return result;
    }

    private static String unwrapJsonStringAnswer(String value) {
        if (!looksLikeJsonString(value)) {
            return value;
        }
        try {
            String parsed = OBJECT_MAPPER.readValue(value, String.class);
            if (parsed != null && looksLikeStudentMarkdownOrEscapedAnswer(parsed)) {
                return parsed;
            }
        } catch (Exception ignored) {
            // Fall through: a malformed quoted answer should not break student chat.
        }
        return value;
    }

    private static boolean looksLikeJsonString(String value) {
        return value != null
                && value.length() >= 2
                && value.startsWith("\"")
                && value.endsWith("\"")
                && (value.contains("\\n")
                || value.contains("\\r")
                || value.contains("\\\"")
                || value.contains("\\t")
                || value.contains("##"));
    }

    private static boolean looksLikeStudentMarkdownOrEscapedAnswer(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return MARKDOWN_HEADING.matcher(value).find()
                || shouldDecodeEscapedMarkdownLineBreaks(value)
                || value.contains("```")
                || value.contains("| --- |")
                || value.contains("Đáp án:")
                || value.contains("Giải thích:");
    }

    private static String decodeEscapedMarkdownLineBreaks(String value) {
        if (!shouldDecodeEscapedMarkdownLineBreaks(value)) {
            return value;
        }
        return value
                .replace("\\r\\n", "\n")
                .replace("\\n", "\n")
                .replace("\\r", "\n");
    }

    private static boolean shouldDecodeEscapedMarkdownLineBreaks(String value) {
        if (value == null || !value.contains("\\n")) {
            return false;
        }
        return Pattern.compile("(?s).*#{1,6}\\s+[^\\\\n]+\\\\n.*").matcher(value).matches()
                || Pattern.compile("(?s).*\\\\n\\s*#{1,6}\\s+.*").matcher(value).matches()
                || Pattern.compile("(?s).*\\\\n\\s*(?:[-*+]\\s+|\\d+[.)]\\s+).*").matcher(value).matches()
                || value.contains("\\n```")
                || value.contains("```\\n")
                || value.contains("\\n|")
                || value.contains("|\\n");
    }

    private static String finalizeMarkdownWhitespace(String value) {
        if (value == null) {
            return null;
        }
        String result = value.replace("\r\n", "\n").replace('\r', '\n');
        result = TRAILING_LINE_WHITESPACE.matcher(result).replaceAll("");
        result = EXCESSIVE_BLANK_LINES.matcher(result).replaceAll("\n\n");
        return result.trim();
    }

    /** Lowercase, strip diacritics, keep letters/digits for cross-accent search/matching. */
    public static String normalizeAccentInsensitive(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String decomposed = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return decomposed
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace('đ', 'd')
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
