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
        return search(query, courseId, classId, maxChunks, false, false);
    }

    public List<ElasticVectorService.SearchChunk> searchTextbook(
            String query,
            String courseId,
            String classId,
            int maxChunks
    ) {
        return search(query, courseId, classId, maxChunks, true, false);
    }

    public List<ElasticVectorService.SearchChunk> searchApprovedKnowledge(
            String query,
            String courseId,
            String classId,
            int maxChunks
    ) {
        return search(query, courseId, classId, maxChunks, false, true);
    }

    private List<ElasticVectorService.SearchChunk> search(
            String query,
            String courseId,
            String classId,
            int maxChunks,
            boolean textbookOnly,
            boolean approvedKnowledgeOnly
    ) {
        if (courseId == null || courseId.isBlank()) {
            return List.of();
        }

        int limit = Math.max(1, maxChunks);
        List<String> queryTokens = extractTokens(query);
        List<ElasticVectorService.SearchChunk> relevant = new ArrayList<>();
        List<ElasticVectorService.SearchChunk> firstAvailable = new ArrayList<>();

        for (CourseMaterial material : materialRepository.findByCourseId(courseId.trim())) {
            if ((textbookOnly && !isTextbookMaterial(material))
                    || (approvedKnowledgeOnly && !isApprovedKnowledgeMaterial(material))
                    || !isVisibleForClass(material, classId)
                    || material.getContent() == null
                    || material.getContent().isBlank()) {
                continue;
            }

            List<CourseMaterialChunkingService.HierarchicalChunk> chunks =
                    chunkingService.chunkHierarchically(material);
            if (chunks.isEmpty()) {
                continue;
            }

            boolean capturedFirstChunk = false;
            for (CourseMaterialChunkingService.HierarchicalChunk hierarchicalChunk : chunks) {
                String chunk = hierarchicalChunk.content();
                if (chunk == null || chunk.isBlank()) {
                    continue;
                }
                double relevance = relevance(queryTokens, query, chunk);
                String parentContent = parentWindow(hierarchicalChunk.parentContent(), chunk, 3_600);
                ElasticVectorService.SearchChunk searchChunk = new ElasticVectorService.SearchChunk(
                        parentContent,
                        relevance > 0 ? RELEVANT_BASE_SCORE + Math.min(0.25, relevance * 0.25) : FALLBACK_BASE_SCORE,
                        material.getId(),
                        material.getCourseId(),
                        material.getClassId(),
                        material.getTeacherId(),
                        material.getMaterialScope(),
                        material.getSourceType(),
                        hierarchicalChunk.documentId(),
                        hierarchicalChunk.chapterId(),
                        null,
                        hierarchicalChunk.sectionId(),
                        null,
                        hierarchicalChunk.chunkId(),
                        hierarchicalChunk.chunkIndex(),
                        "SECTION"
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

        List<ElasticVectorService.SearchChunk> selected = relevant.isEmpty() && !approvedKnowledgeOnly
                ? firstAvailable
                : relevant;
        List<ElasticVectorService.SearchChunk> result = selected.stream()
                .sorted(Comparator.comparing(ElasticVectorService.SearchChunk::score, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .toList();

        if (!result.isEmpty()) {
            log.debug(
                    "Mongo lexical course material search selected chunks (courseId={}, classId={}, chunks={})",
                    courseId,
                    classId,
                    result.size()
            );
        }
        return result;
    }

    private String parentWindow(String parent, String child, int maxChars) {
        if (parent == null || parent.length() <= maxChars) return parent == null ? child.trim() : parent.trim();
        int position = child == null ? 0 : parent.indexOf(child);
        int start = Math.max(0, position - 800);
        int end = Math.min(parent.length(), start + maxChars);
        return parent.substring(start, end).trim();
    }

    private boolean isTextbookMaterial(CourseMaterial material) {
        return material != null
                && !"KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType())
                && !"GOLD_QA".equalsIgnoreCase(material.getSourceType())
                && !"senior-approved-knowledge".equalsIgnoreCase(material.getCategory());
    }

    private boolean isApprovedKnowledgeMaterial(CourseMaterial material) {
        return material != null
                && ("KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType())
                || "senior-approved-knowledge".equalsIgnoreCase(material.getCategory()));
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
