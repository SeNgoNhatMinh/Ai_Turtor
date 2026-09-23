package com.ragapi.service.course.search;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Local lexical reranker used when the external model cannot be called. */
@Slf4j
@Service
public class CourseHeuristicRankingService {

    private static final Set<String> STOP_WORDS = Set.of(
            "and", "are", "definition", "for", "from", "how", "the", "what",
            "cua", "cho", "gi", "la", "nhu", "va"
    );

    public List<RetrievedCourseChunk> rerank(
            String query,
            List<RetrievedCourseChunk> chunks,
            int topK,
            String reason
    ) {
        int limit = Math.min(Math.max(1, topK), chunks.size());
        Set<String> queryTokens = meaningfulTokens(query);
        if (queryTokens.isEmpty()) {
            log.debug("Rerank fallback used without lexical tokens: {}", reason);
            return chunks.stream().limit(limit).toList();
        }

        List<RetrievedCourseChunk> reranked = new ArrayList<>(chunks);
        reranked.sort(
                Comparator.comparingDouble(
                                (RetrievedCourseChunk chunk) -> lexicalScore(queryTokens, chunk.content()))
                        .reversed()
                        .thenComparing(
                                chunk -> chunk.score() == null ? Double.NEGATIVE_INFINITY : chunk.score(),
                                Comparator.reverseOrder())
        );
        log.info("Local lexical rerank fallback selected {} of {} chunks: {}", limit, chunks.size(), reason);
        return reranked.stream().limit(limit).toList();
    }

    private double lexicalScore(Set<String> queryTokens, String content) {
        Set<String> contentTokens = meaningfulTokens(content);
        if (contentTokens.isEmpty()) {
            return 0.0;
        }
        long matches = queryTokens.stream().filter(contentTokens::contains).count();
        return (double) matches / queryTokens.size();
    }

    private Set<String> meaningfulTokens(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return Set.of();
        }
        Set<String> tokens = new LinkedHashSet<>();
        for (String token : normalized.split("\\s+")) {
            if (token.length() >= 3 && !STOP_WORDS.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }
}
