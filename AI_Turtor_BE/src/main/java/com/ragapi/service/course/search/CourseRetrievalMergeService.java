package com.ragapi.service.course.search;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.util.TextbookChunkAlignment;
import com.ragapi.util.RagStageTimer;
import dev.langchain4j.data.embedding.Embedding;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** Deterministically expands, deduplicates, and budgets retrieval candidates. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseRetrievalMergeService {

    /** Kept as a constructor-compatible dependency; ranking is not invoked by the runtime pipeline. */
    private final CourseMaterialStoreGateway materialRepository;
    private final CourseSearchContextLimitService contextLimit;
    private final ApprovedKnowledgeSearchService approvedKnowledgeSearch;
    private final CourseSectionExpansionService sectionExpansion;
    private final CourseRetrievalCandidateService candidateService;

    @org.springframework.beans.factory.annotation.Value("${rag.retrieval.conditional-approved-knowledge.enabled:true}")
    private boolean conditionalApprovedKnowledgeEnabled;

    @org.springframework.beans.factory.annotation.Value("${rag.retrieval.primary-sufficient.min-chunks:2}")
    private int primarySufficientMinChunks;

    @org.springframework.beans.factory.annotation.Value("${rag.retrieval.primary-sufficient.min-context-chars:900}")
    private int primarySufficientMinContextChars;

    public List<RetrievedCourseChunk> merge(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            boolean textbookOnly,
            List<RetrievedCourseChunk> priorityChunks,
            List<RetrievedCourseChunk> candidates,
            Embedding queryEmbedding
    ) {
        long started = RagStageTimer.start();
        try {
        List<RetrievedCourseChunk> pinned = priorityChunks == null ? List.of() : priorityChunks;
        List<RetrievedCourseChunk> chunks = TextbookChunkAlignment.mergeDeduplicated(
                query.language(), candidates);
        if (sectionExpansion.requiresExpansion(chunks)) {
            chunks = sectionExpansion.expand(chunks, loadMaterials(chunks));
        }
        chunks = TextbookChunkAlignment.excludeNavigation(chunks);
        chunks = pinPriorityChunks(pinned, chunks);

        if (textbookOnly) {
            return contextLimit.applyBudget(chunks);
        }
        if (conditionalApprovedKnowledgeEnabled && hasSufficientPrimaryContext(chunks)) {
            log.info("Skipping supplemental knowledge because primary course context is sufficient");
            return contextLimit.applyBudget(chunks);
        }
        return mergeAdditionalKnowledge(query, courseId, classId, chunks, queryEmbedding);
        } finally {
            RagStageTimer.record("T9_MERGE_DEDUP_CONTEXT", started);
        }
    }

    public Map<String, CourseMaterial> loadMaterials(List<RetrievedCourseChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return Map.of();
        }
        Set<String> materialIds = chunks.stream()
                .map(RetrievedCourseChunk::materialId)
                .filter(Objects::nonNull)
                .filter(id -> !id.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (materialIds.isEmpty()) {
            return Map.of();
        }
        Map<String, CourseMaterial> result = new LinkedHashMap<>();
        materialRepository.findAllById(materialIds)
                .forEach(material -> result.put(material.getId(), material));
        return result;
    }

    private List<RetrievedCourseChunk> mergeAdditionalKnowledge(
            CourseRetrievalQuery query,
            String courseId,
            String classId,
            List<RetrievedCourseChunk> textbookChunks,
            Embedding queryEmbedding
    ) {
        List<RetrievedCourseChunk> teachingNotes = candidateService.retrieveTeachingNotes(
                query, courseId, classId, queryEmbedding);
        List<RetrievedCourseChunk> approvedChunks;
        try {
            approvedChunks = approvedKnowledgeSearch.retrieveRelevant(
                    query.focus(), courseId, classId, queryEmbedding);
        } catch (Exception exception) {
            log.debug("Approved knowledge retrieval skipped: {}", exception.getMessage());
            approvedChunks = List.of();
        }

        Set<String> usedMaterialIds = textbookChunks.stream()
                .map(RetrievedCourseChunk::materialId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<RetrievedCourseChunk> textbookAndNotes = new ArrayList<>(textbookChunks);
        for (RetrievedCourseChunk note : teachingNotes) {
            if (note == null || note.materialId() == null || usedMaterialIds.contains(note.materialId())) {
                continue;
            }
            if (!TextbookChunkAlignment.hasDistinctiveOverlap(query.focus(), note, 2)) {
                log.debug("Ignoring semantically nearby Gold Q&A without enough lexical topic overlap: {}",
                        note.materialId());
                continue;
            }
            usedMaterialIds.add(note.materialId());
            textbookAndNotes.add(note);
        }

        List<RetrievedCourseChunk> budgeted = contextLimit.applyBudget(textbookAndNotes);
        Set<String> keptChunkKeys = new LinkedHashSet<>();
        List<RetrievedCourseChunk> merged = new ArrayList<>();
        for (RetrievedCourseChunk approved : approvedChunks) {
            if (approved != null && keptChunkKeys.add(chunkIdentity(approved))) {
                merged.add(approved);
            }
        }
        for (RetrievedCourseChunk textbook : budgeted) {
            if (textbook != null && keptChunkKeys.add(chunkIdentity(textbook))) {
                merged.add(textbook);
            }
        }
        return merged;
    }

    private boolean hasSufficientPrimaryContext(List<RetrievedCourseChunk> chunks) {
        if (chunks == null || chunks.size() < Math.max(1, primarySufficientMinChunks)) return false;
        int chars = chunks.stream()
                .map(RetrievedCourseChunk::content)
                .filter(Objects::nonNull)
                .mapToInt(String::length)
                .sum();
        return chars >= Math.max(200, primarySufficientMinContextChars);
    }

    private List<RetrievedCourseChunk> pinPriorityChunks(
            List<RetrievedCourseChunk> pinned,
            List<RetrievedCourseChunk> retrieved
    ) {
        if (pinned == null || pinned.isEmpty()) {
            return retrieved == null ? List.of() : retrieved;
        }
        LinkedHashMap<String, RetrievedCourseChunk> result = new LinkedHashMap<>();
        for (RetrievedCourseChunk chunk : pinned) {
            result.putIfAbsent(chunkIdentity(chunk), chunk);
        }
        if (retrieved != null) {
            for (RetrievedCourseChunk chunk : retrieved) {
                result.putIfAbsent(chunkIdentity(chunk), chunk);
            }
        }
        return new ArrayList<>(result.values());
    }

    private String chunkIdentity(RetrievedCourseChunk chunk) {
        return String.join(
                "|",
                Objects.toString(chunk.sourceType(), ""),
                Objects.toString(chunk.materialId(), ""),
                Objects.toString(chunk.content(), "").strip().replaceAll("\\s+", " ")
        );
    }
}
