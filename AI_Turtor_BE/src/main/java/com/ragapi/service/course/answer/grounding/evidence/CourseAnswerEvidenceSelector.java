package com.ragapi.service.course.answer.grounding.evidence;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextSanitizer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class CourseAnswerEvidenceSelector {

    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help"
    );

    public List<RetrievedCourseChunk> selectAnswerEvidenceChunks(
            List<RetrievedCourseChunk> chunks,
            String question,
            String answer
    ) {
        if (chunks == null || chunks.isEmpty() || answer == null || answer.isBlank()) {
            return List.of();
        }
        String focus = answer.replaceFirst(
                "(?is)\\n*#{1,6}\\s*(?:nguồn tài liệu đã dùng|sources?).*$",
                "").trim();
        List<EvidenceChunkScore> scored = chunks.stream()
                .filter(Objects::nonNull)
                .map(chunk -> new EvidenceChunkScore(
                        chunk,
                        focusedEvidenceScore(chunk.content(), focus, question)))
                .sorted((left, right) -> {
                    int byEvidence = Integer.compare(right.score(), left.score());
                    if (byEvidence != 0) {
                        return byEvidence;
                    }
                    return Double.compare(
                            right.chunk().score() == null ? 0.0 : right.chunk().score(),
                            left.chunk().score() == null ? 0.0 : left.chunk().score());
                })
                .toList();
        int best = scored.isEmpty() ? 0 : scored.get(0).score();
        if (best < 5) {
            return List.of();
        }
        int cutoff = Math.max(5, (int) Math.ceil(best * 0.60));
        return scored.stream()
                .filter(item -> item.score() >= cutoff)
                .limit(3)
                .map(EvidenceChunkScore::chunk)
                .toList();
    }

    private int focusedEvidenceScore(String content, String answer, String question) {
        if (content == null || content.isBlank()) {
            return 0;
        }
        int best = 0;
        for (String window : evidenceWindows(content)) {
            best = Math.max(best, provenanceMatchScore(window, List.of(answer, question)));
        }
        return best;
    }

    public String focusedExcerpt(String content, String answerFocus) {
        if (content == null || content.isBlank()) {
            return content;
        }
        if (answerFocus == null || answerFocus.isBlank()) {
            return excerpt(content);
        }
        String bestWindow = content;
        int bestScore = Integer.MIN_VALUE;
        for (String window : evidenceWindows(content)) {
            int score = provenanceMatchScore(window, List.of(answerFocus));
            if (score > bestScore) {
                bestScore = score;
                bestWindow = window;
            }
        }
        return excerpt(bestWindow);
    }

    private List<String> evidenceWindows(String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }
        String normalized = content.replace("\r\n", "\n").replace('\r', '\n');
        String clean = TextSanitizer.clean(normalized);
        if (clean == null || clean.isBlank()) {
            return List.of();
        }
        final int windowSize = 900;
        final int stride = 450;
        List<String> windows = new ArrayList<>();
        for (String paragraph : normalized.split("\\n\\s*\\n+")) {
            addEvidenceCandidate(windows, paragraph, windowSize);
            for (String sentence : paragraph.split("(?<=[.!?])\\s+")) {
                addEvidenceCandidate(windows, sentence, windowSize);
            }
        }
        if (clean.length() <= windowSize) {
            if (windows.size() > 1) {
                return windows;
            }
            addEvidenceCandidate(windows, clean, windowSize);
            return windows;
        }
        for (int start = 0; start < clean.length(); start += stride) {
            int end = Math.min(clean.length(), start + windowSize);
            int safeStart = start == 0 ? 0 : nextWhitespace(clean, start);
            int safeEnd = end == clean.length() ? end : previousWhitespace(clean, end);
            if (safeEnd > safeStart) {
                windows.add(clean.substring(safeStart, safeEnd).trim());
            }
            if (end == clean.length()) {
                break;
            }
        }
        return windows;
    }

    private void addEvidenceCandidate(List<String> windows, String value, int maxLength) {
        String candidate = TextSanitizer.clean(value);
        if (candidate == null || candidate.length() < 50 || candidate.length() > maxLength) {
            return;
        }
        if (!windows.contains(candidate)) {
            windows.add(candidate);
        }
    }

    private int nextWhitespace(String value, int from) {
        int cursor = Math.max(0, Math.min(from, value.length()));
        while (cursor < value.length() && !Character.isWhitespace(value.charAt(cursor))) {
            cursor++;
        }
        return cursor;
    }

    private int previousWhitespace(String value, int from) {
        int cursor = Math.max(0, Math.min(from, value.length()));
        while (cursor > 0 && !Character.isWhitespace(value.charAt(cursor - 1))) {
            cursor--;
        }
        return cursor;
    }

    private int provenanceMatchScore(String content, List<String> terms) {
        String normalizedContent = normalizeForMatch(content);
        if (normalizedContent.isBlank() || terms == null) {
            return 0;
        }
        int score = 0;
        for (String value : terms) {
            if (value == null || value.isBlank()) {
                continue;
            }
            String normalizedTerm = normalizeForMatch(value);
            if (normalizedTerm.length() >= 3 && normalizedContent.contains(normalizedTerm)) {
                score += 50;
            }
            for (String token : extractSignificantTokens(value)) {
                if (Pattern.compile(
                        "(?<![\\p{L}\\p{N}_])" + Pattern.quote(token) + "(?![\\p{L}\\p{N}_])",
                        Pattern.UNICODE_CHARACTER_CLASS
                ).matcher(normalizedContent).find()) {
                    score += token.length() >= 8 ? 20 : token.length() >= 5 ? 5 : 1;
                }
            }
        }
        return score;
    }

    private List<String> extractSignificantTokens(String text) {
        String normalized = normalizeForMatch(text);
        List<String> tokens = new ArrayList<>();
        for (String raw : normalized.split("\\s+")) {
            String token = raw.trim();
            if (token.length() < 3 || STOP_WORDS.contains(token)) {
                continue;
            }
            if (!tokens.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String normalizeForMatch(String text) {
        return TextSanitizer.normalizeAccentInsensitive(text);
    }

    private String excerpt(String content) {
        String clean = TextSanitizer.clean(content);
        if (clean == null || clean.length() <= 700) {
            return clean;
        }
        return clean.substring(0, 697).trim() + "...";
    }

    private record EvidenceChunkScore(RetrievedCourseChunk chunk, int score) {
    }

}
