package com.ragapi.service;

import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class TtsTextNormalizationService {

    private static final String CODE_REPLACEMENT = " Đoạn mã bên dưới là ví dụ minh họa. ";
    private static final Pattern FENCED_CODE = Pattern.compile("(?s)```(?:[^\\n]*)\\n?.*?```");
    private static final Pattern IMAGE = Pattern.compile("!\\[[^]]*]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^]]+)]\\([^)]*\\)");
    private static final Pattern RAW_URL = Pattern.compile("(?i)\\b(?:https?://|www\\.)\\S+");
    private static final Pattern INLINE_CODE = Pattern.compile("`([^`]+)`");
    private static final Pattern MARKDOWN_PREFIX = Pattern.compile("(?m)^\\s{0,3}(?:#{1,6}|>|[-+*]|\\d+[.)])\\s+");
    private static final Pattern CITATION = Pattern.compile("(?:\\[(?:\\d+(?:\\s*[-,]\\s*\\d+)*)]|[【〖][^】〗]{1,80}[】〗])");
    private static final Pattern MARKDOWN_MARKS = Pattern.compile("[*_~]{1,3}");
    private static final Pattern CODE_SYMBOLS = Pattern.compile("=>|[{};()]");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    @Value("${tts.max-text-length:6000}")
    private int maxTextLength;

    @Value("${tts.max-chunk-length:600}")
    private int maxChunkLength;

    public String normalize(String markdown) {
        if (markdown == null || markdown.isBlank()) return "";
        String value = FENCED_CODE.matcher(markdown).replaceAll(CODE_REPLACEMENT);
        value = IMAGE.matcher(value).replaceAll(" ");
        value = LINK.matcher(value).replaceAll("$1");
        value = RAW_URL.matcher(value).replaceAll(" ");
        value = CITATION.matcher(value).replaceAll(" ");
        value = INLINE_CODE.matcher(value).replaceAll("$1");
        value = MARKDOWN_PREFIX.matcher(value).replaceAll("");
        value = MARKDOWN_MARKS.matcher(value).replaceAll("");
        value = Jsoup.parse(value).text();
        value = value.replace('|', ',');
        value = CODE_SYMBOLS.matcher(value).replaceAll(" ");
        value = WHITESPACE.matcher(value).replaceAll(" ").trim();
        if (value.length() <= maxTextLength) return value;
        String shortened = value.substring(0, maxTextLength).trim();
        int sentenceEnd = Math.max(shortened.lastIndexOf('.'),
                Math.max(shortened.lastIndexOf('!'), shortened.lastIndexOf('?')));
        return sentenceEnd >= maxTextLength / 2 ? shortened.substring(0, sentenceEnd + 1) : shortened;
    }

    public List<String> normalizeAndChunk(String markdown) {
        String normalized = normalize(markdown);
        if (normalized.isBlank()) return List.of();
        int limit = Math.max(100, Math.min(2000, maxChunkLength));
        return splitNormalized(normalized, limit);
    }

    public List<String> splitForProviderRetry(String normalizedText) {
        String value = normalizedText == null ? "" : normalizedText.trim();
        if (value.isBlank()) return List.of();
        int retryLimit = Math.max(100, Math.min(400, value.length() / 2));
        return splitNormalized(value, retryLimit);
    }

    private List<String> splitNormalized(String normalized, int limit) {
        if (normalized.length() <= limit) return List.of(normalized);

        List<String> chunks = new ArrayList<>();
        String remaining = normalized;
        while (remaining.length() > limit) {
            int split = bestBoundary(remaining, limit);
            if (split <= 0) {
                throw new IllegalArgumentException("TTS text contains a word longer than the provider limit");
            }
            String chunk = remaining.substring(0, split).trim();
            if (!chunk.isBlank()) chunks.add(chunk);
            remaining = remaining.substring(split).trim();
        }
        if (!remaining.isBlank()) chunks.add(remaining);
        return List.copyOf(chunks);
    }

    private int bestBoundary(String value, int limit) {
        int sentence = lastBoundary(value, limit, ".!?\u2026");
        if (sentence >= limit / 3) return sentence + 1;
        int phrase = lastBoundary(value, limit, ";:,\n");
        if (phrase >= limit / 3) return phrase + 1;
        for (int index = limit; index > 0; index--) {
            if (Character.isWhitespace(value.charAt(index - 1))) return index;
        }
        return -1;
    }

    private int lastBoundary(String value, int limit, String boundaries) {
        int last = -1;
        for (int index = 0; index < limit && index < value.length(); index++) {
            if (boundaries.indexOf(value.charAt(index)) >= 0) last = index;
        }
        return last;
    }
}
