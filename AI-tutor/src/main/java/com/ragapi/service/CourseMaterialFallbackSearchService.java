package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class CourseMaterialFallbackSearchService {

    private static final int DEFAULT_MAX_CHUNKS = 8;
    private static final double RELEVANT_BASE_SCORE = 0.65;
    private static final double FALLBACK_BASE_SCORE = 0.55;
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Set<String> STOP_WORDS = new LinkedHashSet<>(List.of(
            "la", "gi", "cua", "cho", "em", "anh", "chi", "the", "nao", "hay",
            "giai", "thich", "tao", "quiz", "on", "tap", "chu", "de", "mon", "hoc",
            "what", "is", "a", "an", "and", "or", "in", "on", "of", "to", "with", "about",
            "please", "help", "explain"
    ));

    private final CourseMaterialRepository materialRepository;
    private final CourseMaterialChunkingService chunkingService;

    public List<ElasticVectorService.SearchChunk> search(String query, String courseId, String classId) {
        return search(query, courseId, classId, DEFAULT_MAX_CHUNKS);
    }

    public List<ElasticVectorService.SearchChunk> search(String query, String courseId, String classId, int maxChunks) {
        if (courseId == null || courseId.isBlank()) {
            return List.of();
        }

        int limit = Math.max(1, maxChunks);
        List<String> queryTokens = extractTokens(query);
        List<ElasticVectorService.SearchChunk> relevant = new ArrayList<>();
        List<ElasticVectorService.SearchChunk> firstAvailable = new ArrayList<>();

        for (CourseMaterial material : materialRepository.findByCourseId(courseId.trim())) {
            if (!isVisibleForClass(material, classId) || material.getContent() == null || material.getContent().isBlank()) {
                continue;
            }

            List<String> chunks = chunkingService.chunk(material.getContent());
            if (chunks.isEmpty()) {
                chunks = List.of(material.getContent().trim());
            }

            boolean capturedFirstChunk = false;
            for (String chunk : chunks) {
                if (chunk == null || chunk.isBlank()) {
                    continue;
                }
                double relevance = relevance(queryTokens, query, chunk);
                ElasticVectorService.SearchChunk searchChunk = new ElasticVectorService.SearchChunk(
                        chunk.trim(),
                        relevance > 0 ? RELEVANT_BASE_SCORE + Math.min(0.25, relevance * 0.25) : FALLBACK_BASE_SCORE,
                        material.getId(),
                        material.getCourseId(),
                        material.getClassId(),
                        material.getTeacherId(),
                        material.getMaterialScope()
                );
                if (!capturedFirstChunk) {
                    firstAvailable.add(searchChunk);
                    capturedFirstChunk = true;
                }
                if (relevance > 0) {
                    relevant.add(searchChunk);
                }
            }
        }

        List<ElasticVectorService.SearchChunk> selected = relevant.isEmpty() ? firstAvailable : relevant;
        List<ElasticVectorService.SearchChunk> result = selected.stream()
                .sorted(Comparator.comparing(ElasticVectorService.SearchChunk::score, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .toList();

        if (!result.isEmpty()) {
            log.warn(
                    "Using Mongo course material fallback search because Elasticsearch returned no usable chunks (courseId={}, classId={}, chunks={})",
                    courseId,
                    classId,
                    result.size()
            );
        }
        return result;
    }

    private boolean isVisibleForClass(CourseMaterial material, String requestedClassId) {
        String materialClassId = material.getClassId();
        if (materialClassId == null || materialClassId.isBlank() || "null".equalsIgnoreCase(materialClassId)) {
            return true;
        }
        return requestedClassId != null && materialClassId.equalsIgnoreCase(requestedClassId.trim());
    }

    private double relevance(List<String> queryTokens, String query, String chunk) {
        if (chunk == null || chunk.isBlank()) {
            return 0.0;
        }
        String normalizedChunk = normalize(chunk);
        if (normalizedChunk.isBlank()) {
            return 0.0;
        }

        LinkedHashSet<String> matched = new LinkedHashSet<>();
        for (String token : queryTokens) {
            if (normalizedChunk.contains(token)) {
                matched.add(token);
            }
        }
        double tokenScore = queryTokens.isEmpty() ? 0.0 : (double) matched.size() / queryTokens.size();

        String normalizedQuery = normalize(query);
        double phraseScore = !normalizedQuery.isBlank() && normalizedQuery.length() >= 4 && normalizedChunk.contains(normalizedQuery)
                ? 0.4
                : 0.0;
        return Math.min(1.0, tokenScore + phraseScore);
    }

    private List<String> extractTokens(String text) {
        String normalized = normalize(text);
        if (normalized.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        for (String raw : normalized.split("\\s+")) {
            String token = raw.trim();
            if (token.length() < 3 || STOP_WORDS.contains(token)) {
                continue;
            }
            tokens.add(token);
        }
        return new ArrayList<>(tokens);
    }

    private String normalize(String text) {
        if (text == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(text.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return DIACRITICS.matcher(decomposed)
                .replaceAll("")
                .replaceAll("[^\\p{L}\\p{N}+#]+", " ")
                .trim();
    }
}
