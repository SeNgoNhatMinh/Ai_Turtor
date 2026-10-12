package com.ragapi.service.course.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.CourseMaterialChunkingService;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** Retrieves textbook chunks explicitly linked to an improve-plan item. */
@Service
@RequiredArgsConstructor
@Slf4j
public class CourseImprovePlanContextService {

    private static final int LARGE_MATERIAL_CHARS = 24_000;
    private static final int EXCERPT_RADIUS = 700;
    private static final int MAX_GROUNDED_CHARS = 2_000;

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
        List<CourseMaterial> materials = materialRepository.findAllById(materialIds);
        boolean staleMaterialProvenance = materials.stream()
                .noneMatch(material -> isUsableTextbook(material, courseId, classId));
        if (staleMaterialProvenance) {
            log.warn(
                    "Source material provenance is stale; falling back to ranked course retrieval "
                            + "(courseId={}, staleMaterialIds={})",
                    courseId,
                    materialIds);
            return List.of();
        }

        List<RetrievedCourseChunk> result = new ArrayList<>();
        List<String> searchTerms = searchTerms(terms);
        for (CourseMaterial material : materials) {
            if (!isUsableTextbook(material, courseId, classId)) {
                continue;
            }
            // Rebuilding every section of a full textbook and comparing each child
            // against that section blocked the live answer for several minutes.
            if (chunkIds.isEmpty() && material.getContent().length() > LARGE_MATERIAL_CHARS) {
                long startedNanos = System.nanoTime();
                List<RetrievedCourseChunk> excerpts = excerptMatches(material, excerptNeedles(terms));
                log.info("Large source material excerpted in {} ms (materialId={}, chars={}, excerpts={})",
                        (System.nanoTime() - startedNanos) / 1_000_000,
                        material.getId(),
                        material.getContent().length(),
                        excerpts.size());
                result.addAll(excerpts);
                continue;
            }
            List<CourseMaterialChunkingService.HierarchicalChunk> chunks = chunkingService.chunkHierarchically(material);
            for (CourseMaterialChunkingService.HierarchicalChunk chunk : chunks) {
                boolean exactChunk = !chunkIds.isEmpty() && chunkIds.contains(chunk.chunkId());
                int termMatchScore = provenanceMatchScore(chunk.content(), searchTerms);
                if (!exactChunk && termMatchScore == 0) {
                    continue;
                }
                result.add(new RetrievedCourseChunk(
                        groundedChunkContent(chunk),
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

    private String groundedChunkContent(CourseMaterialChunkingService.HierarchicalChunk chunk) {
        String parent = Objects.toString(chunk.parentContent(), "").trim();
        String content = Objects.toString(chunk.content(), "").trim();
        if (parent.isBlank() || parent.equals(content)) {
            return content;
        }
        if (content.isBlank() || parent.contains(content)) {
            return capGroundedText(parent, content);
        }
        return capGroundedText(parent + "\n\n" + content, content);
    }

    private List<RetrievedCourseChunk> excerptMatches(CourseMaterial material, List<String> searchTerms) {
        String content = material.getContent();
        String lower = content.toLowerCase(Locale.ROOT);
        List<RetrievedCourseChunk> excerpts = new ArrayList<>();
        for (String term : searchTerms) {
            if (excerpts.size() >= 6) {
                break;
            }
            int at = lower.indexOf(term);
            if (at < 0) {
                continue;
            }
            int start = Math.max(0, at - EXCERPT_RADIUS);
            int end = Math.min(content.length(), at + term.length() + EXCERPT_RADIUS);
            String excerpt = content.substring(start, end).trim();
            if (excerpt.isBlank() || excerpts.stream().anyMatch(existing -> overlaps(existing.content(), excerpt))) {
                continue;
            }
            excerpts.add(new RetrievedCourseChunk(
                    excerpt,
                    0.9,
                    material.getId(),
                    material.getCourseId(),
                    material.getClassId(),
                    material.getTeacherId(),
                    material.getMaterialScope(),
                    material.getSourceType(),
                    material.getId(),
                    null,
                    "Document",
                    material.getId() + ":excerpt:" + start,
                    "Document",
                    material.getId() + ":excerpt:" + start,
                    excerpts.size(),
                    "SECTION"
            ));
        }
        if (excerpts.isEmpty()) {
            log.info("Large source material had no direct term match; using ranked retrieval (materialId={}, chars={})",
                    material.getId(), content.length());
        }
        return excerpts;
    }

    private boolean overlaps(String left, String right) {
        return left.contains(right) || right.contains(left);
    }

    private String capGroundedText(String candidate, String child) {
        if (candidate.length() <= MAX_GROUNDED_CHARS) {
            return candidate;
        }
        return child.length() <= MAX_GROUNDED_CHARS ? child : child.substring(0, MAX_GROUNDED_CHARS);
    }

    private List<String> excerptNeedles(List<String> terms) {
        LinkedHashSet<String> needles = new LinkedHashSet<>();
        for (String term : terms) {
            String lower = term == null ? "" : term.toLowerCase(Locale.ROOT).trim();
            if (lower.length() >= 4) {
                needles.add(lower);
            }
            for (String raw : lower.split("[^\\p{L}\\p{N}_.]+")) {
                if (raw.length() >= 4 && !STOP_WORDS.contains(raw)) {
                    needles.add(raw);
                }
            }
        }
        return new ArrayList<>(needles);
    }

    private List<String> searchTerms(List<String> terms) {
        LinkedHashSet<String> needles = new LinkedHashSet<>();
        for (String term : terms) {
            String normalized = normalizeForMatch(term);
            if (normalized.length() >= 4) {
                needles.add(normalized);
            }
            extractSignificantTokens(term).stream()
                    .filter(token -> token.length() >= 4)
                    .forEach(needles::add);
        }
        return new ArrayList<>(needles);
    }

    private boolean isUsableTextbook(CourseMaterial material, String courseId, String classId) {
        return material != null
                && courseId.equalsIgnoreCase(Objects.toString(material.getCourseId(), ""))
                && isMaterialVisibleForClass(material, classId)
                && !isNonTextbookMaterial(material)
                && material.getContent() != null
                && !material.getContent().isBlank();
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

    private int provenanceMatchScore(String content, List<String> searchTerms) {
        String normalizedContent = normalizeForMatch(content);
        if (normalizedContent.isBlank() || searchTerms == null || searchTerms.isEmpty()) {
            return 0;
        }
        int score = 0;
        for (String term : searchTerms) {
            if (term.length() >= 4 && normalizedContent.contains(term)) {
                score += term.length() >= 8 ? 20 : 5;
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
        for (String raw : normalized.split("[^\\p{L}\\p{N}_.]+")) {
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
