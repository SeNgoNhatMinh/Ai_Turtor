package com.ragapi.util;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps a generated quiz inside the passages actually retrieved for the
 * student's own words. There is no topic dictionary: a passage is eligible
 * only when it contains a term the student typed, and a question is kept
 * only when its evidence quote is copied from one of those passages.
 */
public final class QuizMaterialGrounding {

    public static final int MAX_PASSAGES = 6;
    private static final int PASSAGE_CHARS = 1_600;
    private static final int MIN_QUOTE_WORDS = 6;
    private static final Pattern LATIN_TERM = Pattern.compile(
            "(?<![\\p{L}\\p{N}])([A-Za-z][A-Za-z0-9]{2,})(?![\\p{L}\\p{N}])"
    );
    private static final Pattern LETTER_ANSWER = Pattern.compile(
            "^(?:dap an|phuong an|option|answer)?\\s*([a-d1-4])$"
    );
    private static final Set<String> STOP_WORDS = Set.of(
            "hoc", "ve", "chu", "de", "mon", "bai", "kien", "thuc", "sinh", "vien",
            "giup", "minh", "muon", "nay", "hom", "cho", "cac", "mot", "nhung", "trong",
            "cua", "voi", "hay", "theo", "duoc", "khong", "nhu", "the", "nao", "ban",
            "toi", "can", "dieu", "neu", "hoac", "sau", "truoc", "khi", "ngoai", "tren",
            "duoi", "nhieu", "rat", "nen", "lam", "dung", "sai", "start", "lesson",
            "learn", "about", "and", "with", "from", "course", "this", "that",
            "what", "how", "why", "study", "topic", "quiz", "into", "using", "used",
            "your", "for", "are", "was", "were", "bat", "dau", "phan", "chuong"
    );

    private QuizMaterialGrounding() {
    }

    public record SourceChunk(String content, String materialId, String chapterTitle, Double score) {
    }

    public record QuizPassage(String id, String materialId, String chapterTitle, String text) {
    }

    public static String retrievalQuery(String topic, String suggestion) {
        String safeTopic = topic == null ? "" : topic.trim();
        String safeSuggestion = suggestion == null ? "" : suggestion.trim();
        if (safeSuggestion.isBlank() || safeSuggestion.equalsIgnoreCase(safeTopic)) {
            return safeTopic;
        }
        return (safeTopic + " " + safeSuggestion).trim();
    }

    public static boolean chunkMatchesTopic(String query, String chapterTitle, String content) {
        String body = QuizContentFilter.sanitizeMaterialContextForQuiz(content);
        if (body.isBlank() && (chapterTitle == null || chapterTitle.isBlank())) {
            return false;
        }
        List<String> anchors = topicTerms(query);
        if (anchors.isEmpty()) {
            return false;
        }
        String haystack = normalize((chapterTitle == null ? "" : chapterTitle) + "\n" + body);
        for (String anchor : anchors) {
            if (containsTerm(haystack, anchor)) {
                return true;
            }
        }
        return false;
    }

    public static List<QuizPassage> toPassages(String query, List<SourceChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        List<String> anchors = topicTerms(query);
        List<SourceChunk> ordered = chunks.stream()
                .filter(chunk -> chunk != null && chunkMatchesTopic(query, chunk.chapterTitle(), chunk.content()))
                .sorted((left, right) -> Double.compare(
                        right.score() == null ? 0.0 : right.score(),
                        left.score() == null ? 0.0 : left.score()))
                .toList();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<QuizPassage> passages = new ArrayList<>();
        for (SourceChunk chunk : ordered) {
            if (passages.size() >= MAX_PASSAGES) {
                break;
            }
            String body = QuizContentFilter.sanitizeMaterialContextForQuiz(chunk.content());
            if (body.isBlank()) {
                continue;
            }
            String text = window(body, anchors);
            String fingerprint = normalize(text);
            if (fingerprint.length() > 180) {
                fingerprint = fingerprint.substring(0, 180);
            }
            if (!seen.add(fingerprint)) {
                continue;
            }
            passages.add(new QuizPassage(
                    "P" + (passages.size() + 1),
                    chunk.materialId(),
                    chunk.chapterTitle(),
                    text
            ));
        }
        return List.copyOf(passages);
    }

    public static String formatPassages(List<QuizPassage> passages) {
        if (passages == null || passages.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (QuizPassage passage : passages) {
            if (!builder.isEmpty()) {
                builder.append("\n\n");
            }
            builder.append("PASSAGE ").append(passage.id());
            if (passage.chapterTitle() != null && !passage.chapterTitle().isBlank()) {
                builder.append("\nChapter: ").append(passage.chapterTitle().trim());
            }
            builder.append('\n').append(passage.text());
        }
        return builder.toString();
    }

    /**
     * @return the passage that actually contains the quote. A wrong passage id
     * is ignored when the quote itself is a verbatim span of another passage.
     */
    public static QuizPassage supportingPassage(String quote, String sourcePassageId, List<QuizPassage> passages) {
        if (passages == null || passages.isEmpty() || !hasEnoughQuoteWords(quote)) {
            return null;
        }
        List<QuizPassage> hits = new ArrayList<>();
        for (QuizPassage passage : passages) {
            if (passage != null && quoteMatches(quote, passage.text())) {
                hits.add(passage);
            }
        }
        if (hits.isEmpty()) {
            return null;
        }
        if (sourcePassageId != null && !sourcePassageId.isBlank()) {
            String requested = sourcePassageId.trim();
            for (QuizPassage hit : hits) {
                if (hit.id().equalsIgnoreCase(requested)) {
                    return hit;
                }
            }
        }
        return hits.get(0);
    }

    public static boolean quoteMatches(String quote, String passage) {
        List<String> quoteWords = words(quote);
        List<String> passageWords = words(passage);
        if (quoteWords.size() < MIN_QUOTE_WORDS || passageWords.isEmpty()) {
            return false;
        }
        int required = quoteWords.size() <= 8
                ? MIN_QUOTE_WORDS
                : Math.max(MIN_QUOTE_WORDS, (quoteWords.size() * 7) / 10);
        required = Math.min(required, quoteWords.size());
        for (int start = 0; start + required <= quoteWords.size(); start++) {
            if (indexOfSequence(passageWords, quoteWords.subList(start, start + required)) >= 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Maps a model answer onto an option the student will see. Letter answers
     * such as "A" or "Đáp án B" count only when the whole answer is that letter.
     */
    public static String matchOption(String answer, List<String> options) {
        if (answer == null || options == null || options.isEmpty()) {
            return null;
        }
        String trimmed = answer.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        Matcher letter = LETTER_ANSWER.matcher(normalize(trimmed));
        if (letter.matches()) {
            int index = letterIndex(letter.group(1));
            if (index >= 0 && index < options.size() && options.get(index) != null && !options.get(index).isBlank()) {
                return options.get(index);
            }
            return null;
        }
        String normalizedAnswer = normalize(stripChoicePrefix(trimmed));
        if (normalizedAnswer.equals("true") || normalizedAnswer.equals("dung")) {
            String matched = findNormalized(options, "dung");
            if (matched != null) {
                return matched;
            }
        } else if (normalizedAnswer.equals("false") || normalizedAnswer.equals("sai")) {
            String matched = findNormalized(options, "sai");
            if (matched != null) {
                return matched;
            }
        }
        for (String option : options) {
            if (option != null && normalize(stripChoicePrefix(option)).equals(normalizedAnswer)) {
                return option;
            }
        }
        return null;
    }

    private static boolean hasEnoughQuoteWords(String quote) {
        return words(quote).size() >= MIN_QUOTE_WORDS;
    }

    private static int letterIndex(String token) {
        char marker = Character.toLowerCase(token.charAt(0));
        if (marker >= 'a' && marker <= 'd') {
            return marker - 'a';
        }
        if (marker >= '1' && marker <= '4') {
            return marker - '1';
        }
        return -1;
    }

    private static String findNormalized(List<String> options, String normalizedTarget) {
        for (String option : options) {
            if (option != null && normalize(option).equals(normalizedTarget)) {
                return option;
            }
        }
        return null;
    }

    private static String stripChoicePrefix(String value) {
        return value.replaceFirst("(?i)^[a-d][.)]\\s+", "");
    }

    private static List<String> topicTerms(String query) {
        LinkedHashSet<String> anchors = new LinkedHashSet<>();
        if (query != null) {
            Matcher matcher = LATIN_TERM.matcher(query);
            while (matcher.find()) {
                String token = normalize(matcher.group(1));
                if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                    anchors.add(token);
                }
            }
        }
        if (!anchors.isEmpty()) {
            return List.copyOf(anchors);
        }
        for (String token : words(query)) {
            if (token.length() >= 4 && !STOP_WORDS.contains(token)) {
                anchors.add(token);
            }
        }
        return List.copyOf(anchors);
    }

    private static boolean containsTerm(String normalizedHaystack, String term) {
        if (term == null || term.isBlank() || normalizedHaystack == null || normalizedHaystack.isBlank()) {
            return false;
        }
        String padded = " " + normalizedHaystack + " ";
        return padded.contains(" " + term + " ")
                || padded.contains(" " + term + "s ")
                || padded.contains(" " + term + "es ");
    }

    private static String window(String text, List<String> anchors) {
        String cleaned = text.trim();
        if (cleaned.length() <= PASSAGE_CHARS) {
            return cleaned;
        }
        int pivot = 0;
        String folded = normalize(cleaned);
        for (String anchor : anchors) {
            int at = folded.indexOf(anchor);
            if (at >= 0) {
                pivot = (int) ((long) at * cleaned.length() / Math.max(1, folded.length()));
                break;
            }
        }
        int start = Math.max(0, pivot - PASSAGE_CHARS / 3);
        int end = Math.min(cleaned.length(), start + PASSAGE_CHARS);
        start = Math.max(0, end - PASSAGE_CHARS);
        return cleaned.substring(start, end).trim();
    }

    private static List<String> words(String value) {
        String normalized = normalize(value);
        if (normalized.isBlank()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String token : normalized.split("\\s+")) {
            if (token.length() >= 2) {
                result.add(token);
            }
        }
        return result;
    }

    private static int indexOfSequence(List<String> passage, List<String> sequence) {
        if (sequence.isEmpty() || sequence.size() > passage.size()) {
            return -1;
        }
        for (int i = 0; i + sequence.size() <= passage.size(); i++) {
            boolean matched = true;
            for (int j = 0; j < sequence.size(); j++) {
                if (!passage.get(i + j).equals(sequence.get(j))) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                return i;
            }
        }
        return -1;
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replace("đ", "d")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }
}
