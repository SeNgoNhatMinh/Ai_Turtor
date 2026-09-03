package com.ragapi.util;

import com.ragapi.service.ElasticVectorService.SearchChunk;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Keeps textbook chunks that actually mention the student's terms ahead of
 * semantically nearby but off-target chapters (for example JSP tag-handler
 * pages when the student asked "jsp là gì").
 */
public final class TextbookChunkAlignment {

    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help", "especially",
            "using", "only", "course", "material", "materials",
            "when", "where", "why", "how", "which", "who", "does", "do", "did",
            "called", "used", "use", "order", "each", "first", "time", "loaded"
    );
    private static final Set<String> GENERIC_TOKENS = Set.of(
            "java", "web", "page", "code", "data", "file", "system", "application",
            "programming", "computer", "software", "class", "method"
    );

    private TextbookChunkAlignment() {
    }

    @SafeVarargs
    public static List<SearchChunk> merge(String question, List<SearchChunk>... lists) {
        LinkedHashMap<String, SearchChunk> unique = new LinkedHashMap<>();
        if (lists == null) {
            return List.of();
        }
        for (List<SearchChunk> list : lists) {
            if (list == null) {
                continue;
            }
            for (SearchChunk chunk : list) {
                if (chunk == null || chunk.content() == null || chunk.content().isBlank()) {
                    continue;
                }
                unique.putIfAbsent(dedupeKey(chunk), chunk);
            }
        }
        return rank(question, excludeNavigation(new ArrayList<>(unique.values())));
    }

    public static List<SearchChunk> rank(String question, List<SearchChunk> chunks) {
        if (chunks == null || chunks.size() <= 1) {
            return chunks == null ? List.of() : chunks;
        }
        List<String> tokens = distinctiveTokens(question);
        boolean definition = isDefinitionQuestion(question);
        return chunks.stream()
                .sorted(Comparator
                        .comparing((SearchChunk chunk) -> alignmentScore(question, chunk, tokens, definition))
                        .reversed()
                        .thenComparing(chunk -> normalizedRetrievalScore(chunk.score()), Comparator.reverseOrder()))
                .toList();
    }

    public static List<SearchChunk> excludeNavigation(List<SearchChunk> chunks) {
        if (chunks == null || chunks.size() <= 1) {
            return chunks == null ? List.of() : chunks;
        }
        List<SearchChunk> learningChunks = chunks.stream()
                .filter(chunk -> !isLikelyNavigationChunk(chunk))
                .toList();
        return learningChunks.isEmpty() ? chunks : learningChunks;
    }

    public static boolean isLikelyNavigationChunk(SearchChunk chunk) {
        if (chunk == null) {
            return false;
        }
        String title = (blankToEmpty(chunk.chapterTitle()) + " " + blankToEmpty(chunk.sectionTitle())).trim();
        String normalizedTitle = TextSanitizer.normalizeAccentInsensitive(title).toLowerCase(Locale.ROOT);
        if (normalizedTitle.matches("^(contents?|table of contents|index)$")) {
            return true;
        }
        String normalizedContent = TextSanitizer.normalizeAccentInsensitive(
                chunk.content() == null ? "" : chunk.content()
        ).toLowerCase(Locale.ROOT);
        return normalizedContent.startsWith("contents ")
                && normalizedContent.matches("(?s).*(chapter\\s+\\d+|part\\s+\\d+|appendix).*")
                && normalizedContent.matches("(?s).*\\b\\d{1,3}\\b.*\\b\\d{1,3}\\b.*\\b\\d{1,3}\\b.*");
    }

    public static List<SearchChunk> diversifyByCoverage(String question, List<SearchChunk> chunks, int maxPromoted) {
        if (chunks == null || chunks.size() <= 1) {
            return chunks == null ? List.of() : chunks;
        }
        List<String> tokens = distinctiveTokens(question);
        if (tokens.size() <= 1) {
            return chunks;
        }

        List<SearchChunk> remaining = new ArrayList<>(chunks);
        List<SearchChunk> promoted = new ArrayList<>();
        Set<String> covered = new java.util.LinkedHashSet<>();
        int promotionLimit = Math.min(Math.max(1, maxPromoted), chunks.size());

        while (promoted.size() < promotionLimit && covered.size() < tokens.size()) {
            SearchChunk best = null;
            int bestNewHits = 0;
            double bestScore = Double.NEGATIVE_INFINITY;
            for (SearchChunk chunk : remaining) {
                Set<String> hits = hitTokens(chunk.content(), tokens);
                hits.removeAll(covered);
                int newHits = hits.size();
                double score = normalizedRetrievalScore(chunk.score());
                if (newHits > bestNewHits || (newHits == bestNewHits && newHits > 0 && score > bestScore)) {
                    best = chunk;
                    bestNewHits = newHits;
                    bestScore = score;
                }
            }
            if (best == null || bestNewHits <= 0) {
                break;
            }
            promoted.add(best);
            covered.addAll(hitTokens(best.content(), tokens));
            remaining.remove(best);
        }

        if (promoted.isEmpty()) {
            return chunks;
        }
        List<SearchChunk> result = new ArrayList<>(promoted);
        for (SearchChunk chunk : chunks) {
            if (!promoted.contains(chunk)) {
                result.add(chunk);
            }
        }
        return result;
    }

    public static boolean topChunksCoverQuestion(String question, List<SearchChunk> chunks, int inspect) {
        if (chunks == null || chunks.isEmpty()) {
            return false;
        }
        List<String> tokens = distinctiveTokens(question);
        if (tokens.isEmpty()) {
            return true;
        }
        int limit = Math.min(Math.max(1, inspect), chunks.size());
        boolean definition = isDefinitionQuestion(question);
        boolean anyHit = false;
        boolean anyDefinition = false;
        for (int i = 0; i < limit; i++) {
            SearchChunk chunk = chunks.get(i);
            if (hitCount(chunk.content(), tokens) > 0) {
                anyHit = true;
            }
            String normalized = TextSanitizer.normalizeAccentInsensitive(
                    chunk.content() == null ? "" : chunk.content()
            ).toLowerCase(Locale.ROOT);
            if (looksLikeDefinition(normalized, tokens)) {
                anyDefinition = true;
            }
        }
        return definition ? anyDefinition : anyHit;
    }

    /**
     * Conservative gate for optional sources such as Gold Q&A teaching notes.
     * A semantic score alone must not attach an unrelated teacher note to the answer.
     */
    public static boolean hasDistinctiveOverlap(String question, SearchChunk chunk, int minimumHits) {
        if (chunk == null || chunk.content() == null || chunk.content().isBlank()) {
            return false;
        }
        List<String> tokens = distinctiveTokens(question);
        if (tokens.isEmpty()) {
            return false;
        }
        return hitCount(chunk.content(), tokens) >= Math.max(1, minimumHits);
    }

    static double alignmentScore(
            String question,
            SearchChunk chunk,
            List<String> tokens,
            boolean definition
    ) {
        String content = chunk.content() == null ? "" : chunk.content();
        String normalized = TextSanitizer.normalizeAccentInsensitive(content).toLowerCase(Locale.ROOT);
        int hits = hitCount(content, tokens);
        String leadingContent = normalized.substring(0, Math.min(normalized.length(), 500));
        int leadingHits = hitCount(leadingContent, tokens);
        double score = hits * 3.0 + leadingHits * 2.0;
        if (definition && looksLikeDefinition(normalized, tokens)) {
            score += 4.0;
        }
        score += normalizedRetrievalScore(chunk.score());
        if (isLikelyNavigationChunk(chunk)) {
            score -= 20.0;
        }
        return score;
    }

    static boolean isDefinitionQuestion(String question) {
        String normalized = TextSanitizer.normalizeAccentInsensitive(question).toLowerCase(Locale.ROOT);
        return normalized.contains(" la gi")
                || normalized.endsWith(" la gi")
                || normalized.contains("la gi ")
                || normalized.contains("what is")
                || normalized.contains("dinh nghia")
                || normalized.contains("khai niem")
                || normalized.contains("khac nhau")
                || normalized.contains("difference")
                || normalized.contains("khac gi");
    }

    static List<String> distinctiveTokens(String question) {
        String normalized = TextSanitizer.normalizeAccentInsensitive(question).toLowerCase(Locale.ROOT);
        List<String> tokens = new ArrayList<>();
        for (String raw : normalized.split("\\s+")) {
            String token = raw.trim().replaceAll("[^a-z0-9]+", "");
            if (token.length() < 3 || STOP_WORDS.contains(token) || GENERIC_TOKENS.contains(token)) {
                continue;
            }
            if (!tokens.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private static int hitCount(String content, List<String> tokens) {
        if (content == null || tokens == null || tokens.isEmpty()) {
            return 0;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(content).toLowerCase(Locale.ROOT);
        int hits = 0;
        for (String token : tokens) {
            Pattern wholeTerm = Pattern.compile(
                    "(?<![\\p{L}\\p{N}])" + Pattern.quote(token) + "(?![\\p{L}\\p{N}])",
                    Pattern.UNICODE_CHARACTER_CLASS
            );
            if (wholeTerm.matcher(normalized).find()) {
                hits++;
            }
        }
        return hits;
    }

    private static Set<String> hitTokens(String content, List<String> tokens) {
        Set<String> hits = new java.util.LinkedHashSet<>();
        if (content == null || tokens == null || tokens.isEmpty()) {
            return hits;
        }
        String normalized = TextSanitizer.normalizeAccentInsensitive(content).toLowerCase(Locale.ROOT);
        for (String token : tokens) {
            Pattern wholeTerm = Pattern.compile(
                    "(?<![\\p{L}\\p{N}])" + Pattern.quote(token) + "(?![\\p{L}\\p{N}])",
                    Pattern.UNICODE_CHARACTER_CLASS
            );
            if (wholeTerm.matcher(normalized).find()) {
                hits.add(token);
            }
        }
        return hits;
    }

    private static boolean looksLikeDefinition(String normalizedContent, List<String> tokens) {
        String leading = normalizedContent.substring(0, Math.min(normalizedContent.length(), 500));
        for (String token : tokens) {
            if (token.length() < 3) {
                continue;
            }
            int tokenIndex = leading.indexOf(token);
            if (tokenIndex < 0) {
                continue;
            }
            String following = leading.substring(
                    tokenIndex,
                    Math.min(leading.length(), tokenIndex + 160)
            );
            boolean conceptStartsPassage = tokenIndex <= 32
                    && following.matches("(?s).*\\b(is|are|refers to|means|defined as|known as|stands for)\\b.*");
            boolean explicitDefinition = following.matches(
                    "(?s).*(\\b(is a|is an|refers to|means|defined as|known as|stands for|la mot|duoc goi la)\\b"
                            + "|\\bare\\s+(?:a\\s+|an\\s+)?[a-z0-9]).*"
            );
            if (conceptStartsPassage || explicitDefinition) {
                return true;
            }
        }
        return false;
    }

    private static String dedupeKey(SearchChunk chunk) {
        String material = chunk.materialId() == null ? "" : chunk.materialId();
        String content = chunk.content().replaceAll("\\s+", " ").trim();
        String prefix = content.length() <= 96 ? content : content.substring(0, 96);
        return material + "|" + prefix;
    }

    private static double normalizedRetrievalScore(Double score) {
        if (score == null || score.isNaN()) {
            return 0.0;
        }
        if (score <= 1.0) {
            return Math.max(0.0, score);
        }
        return Math.min(3.0, Math.log1p(score));
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value;
    }
}
