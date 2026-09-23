package com.ragapi.service.course.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.CourseMaterialChunkingService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Retrieves textbook chunks explicitly linked to an improve-plan item. */
@Service
@RequiredArgsConstructor
public class CourseImprovePlanContextService {

    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help"
    );

    private final CourseMaterialStoreGateway materialRepository;
    private final CourseMaterialChunkingService chunkingService;

    public List<RetrievedCourseChunk> retrieve(
            RagQueryIntent ragQueryIntent,
            String courseId,
            String classId
    ) {
        if (ragQueryIntent == null || ragQueryIntent.getSourceMaterialIds() == null
                || ragQueryIntent.getSourceMaterialIds().isEmpty()) {
            return List.of();
        }
        Set<String> materialIds = ragQueryIntent.getSourceMaterialIds().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(id -> !id.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (materialIds.isEmpty()) {
            return List.of();
        }
        Set<String> chunkIds = ragQueryIntent.getSourceChunkIds() == null
                ? Set.of()
                : ragQueryIntent.getSourceChunkIds().stream()
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .filter(id -> !id.isBlank())
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        List<String> terms = mergeRetrievalTerms(ragQueryIntent);
        List<RetrievedCourseChunk> result = new ArrayList<>();

        for (CourseMaterial material : materialRepository.findAllById(materialIds)) {
            if (material == null || !courseId.equalsIgnoreCase(Objects.toString(material.getCourseId(), ""))
                    || !isMaterialVisibleForClass(material, classId)
                    || isNonTextbookMaterial(material)
                    || material.getContent() == null
                    || material.getContent().isBlank()) {
                continue;
            }
            List<CourseMaterialChunkingService.HierarchicalChunk> chunks = chunkingService.chunkHierarchically(material);
            for (CourseMaterialChunkingService.HierarchicalChunk chunk : chunks) {
                boolean exactChunk = !chunkIds.isEmpty() && chunkIds.contains(chunk.chunkId());
                int termMatchScore = provenanceMatchScore(
                        chunk.parentContent() + "\n" + chunk.content(), terms);
                if (!exactChunk && termMatchScore == 0) {
                    continue;
                }
                result.add(new RetrievedCourseChunk(
                        chunk.parentContent(),
                        exactChunk ? 0.99 : Math.min(0.97, 0.82 + (termMatchScore / 100.0)),
                        material.getId(),
                        material.getCourseId(),
                        material.getClassId(),
                        material.getTeacherId(),
                        material.getMaterialScope(),
                        material.getSourceType(),
                        chunk.documentId(),
                        chunk.chapterId(),
                        chunk.chapterTitle(),
                        chunk.sectionId(),
                        chunk.sectionTitle(),
                        chunk.chunkId(),
                        chunk.chunkIndex(),
                        "SECTION"
                ));
            }
        }
        return result.stream()
                .sorted((left, right) -> Double.compare(
                        Objects.requireNonNullElse(right.score(), 0.0),
                        Objects.requireNonNullElse(left.score(), 0.0)))
                .limit(6)
                .toList();
    }

    private List<String> mergeRetrievalTerms(RagQueryIntent ragQueryIntent) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        if (ragQueryIntent.getSourceTerms() != null) {
            ragQueryIntent.getSourceTerms().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .forEach(terms::add);
        }
        if (ragQueryIntent.getRetrievalTerms() != null) {
            ragQueryIntent.getRetrievalTerms().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .forEach(terms::add);
        }
        if (ragQueryIntent.getRetrievalQuery() != null && !ragQueryIntent.getRetrievalQuery().isBlank()) {
            terms.add(ragQueryIntent.getRetrievalQuery().trim());
        }
        return new ArrayList<>(terms);
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

    private boolean isMaterialVisibleForClass(CourseMaterial material, String requestedClassId) {
        String materialClassId = material.getClassId();
        if (materialClassId == null || materialClassId.isBlank() || "null".equalsIgnoreCase(materialClassId)) {
            return true;
        }
        return requestedClassId != null && materialClassId.equalsIgnoreCase(requestedClassId.trim());
    }

    private boolean isNonTextbookMaterial(CourseMaterial material) {
        return "KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType())
                || "GOLD_QA".equalsIgnoreCase(material.getSourceType())
                || "senior-approved-knowledge".equalsIgnoreCase(material.getCategory());
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
}
