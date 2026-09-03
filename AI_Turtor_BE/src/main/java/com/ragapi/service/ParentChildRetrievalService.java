package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Expands precise child hits to their containing section. This is intentionally
 * local and deterministic: it does not add a network reranker or ask an LLM to
 * summarize the source.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentChildRetrievalService {

    private static final int MAX_PARENT_SECTIONS = 6;
    private static final int MAX_PARENT_CHARS = 3_600;

    private final CourseMaterialChunkingService chunkingService;

    public List<ElasticVectorService.SearchChunk> expand(
            List<ElasticVectorService.SearchChunk> rankedChildren,
            Map<String, CourseMaterial> materialsById
    ) {
        if (rankedChildren == null || rankedChildren.isEmpty() || materialsById == null || materialsById.isEmpty()) {
            return rankedChildren == null ? List.of() : rankedChildren;
        }

        Map<String, List<CourseMaterialChunkingService.HierarchicalChunk>> hierarchyCache = new LinkedHashMap<>();
        LinkedHashMap<String, ElasticVectorService.SearchChunk> parents = new LinkedHashMap<>();

        for (ElasticVectorService.SearchChunk child : rankedChildren) {
            if (child == null || parents.size() >= MAX_PARENT_SECTIONS) break;
            if ("SECTION".equalsIgnoreCase(child.nodeType())
                    && child.sectionId() != null && !child.sectionId().isBlank()) {
                parents.putIfAbsent(child.materialId() + '|' + child.sectionId(), child);
                continue;
            }
            CourseMaterial material = materialsById.get(child.materialId());
            if (!isExpandableTextbook(material, child)) continue;

            CourseMaterialChunkingService.HierarchicalChunk matched = findChild(child, material, hierarchyCache);
            if (matched == null || matched.parentContent() == null || matched.parentContent().isBlank()) continue;

            String parentKey = material.getId() + '|' + matched.sectionId();
            parents.putIfAbsent(parentKey, toParentChunk(child, matched));
        }

        if (parents.isEmpty()) return rankedChildren;

        List<ElasticVectorService.SearchChunk> expanded = new ArrayList<>(parents.values());
        for (ElasticVectorService.SearchChunk child : rankedChildren) {
            boolean coveredByParent = expanded.stream().anyMatch(parent -> isCovered(parent, child));
            if (!coveredByParent) expanded.add(child);
        }
        log.info("Parent-child retrieval expanded {} child hits into {} parent sections ({} total candidates)",
                rankedChildren.size(), parents.size(), expanded.size());
        return expanded;
    }

    private boolean isCovered(
            ElasticVectorService.SearchChunk parent, ElasticVectorService.SearchChunk child) {
        if (!Objects.equals(parent.materialId(), child.materialId())) return false;
        if (parent.sectionId() != null && child.sectionId() != null) {
            return parent.sectionId().equals(child.sectionId());
        }
        return parent.content() != null && child.content() != null
                && normalize(parent.content()).contains(normalize(child.content()));
    }

    private CourseMaterialChunkingService.HierarchicalChunk findChild(
            ElasticVectorService.SearchChunk child,
            CourseMaterial material,
            Map<String, List<CourseMaterialChunkingService.HierarchicalChunk>> hierarchyCache
    ) {
        List<CourseMaterialChunkingService.HierarchicalChunk> hierarchy = hierarchyCache.computeIfAbsent(
                material.getId(),
                ignored -> chunkingService.chunkHierarchically(material)
        );
        if (child.chunkId() != null && !child.chunkId().isBlank()) {
            for (CourseMaterialChunkingService.HierarchicalChunk candidate : hierarchy) {
                if (child.chunkId().equals(candidate.chunkId())) return candidate;
            }
        }
        String needle = normalize(child.content());
        if (needle.isBlank()) return null;
        for (CourseMaterialChunkingService.HierarchicalChunk candidate : hierarchy) {
            String candidateText = normalize(candidate.content());
            if (candidateText.equals(needle) || candidateText.contains(needle) || needle.contains(candidateText)) {
                return candidate;
            }
        }
        return null;
    }

    private ElasticVectorService.SearchChunk toParentChunk(
            ElasticVectorService.SearchChunk child,
            CourseMaterialChunkingService.HierarchicalChunk matched
    ) {
        String parentContent = parentWindow(matched.parentContent(), child.content(), MAX_PARENT_CHARS);
        return new ElasticVectorService.SearchChunk(
                parentContent,
                child.score(),
                child.materialId(),
                child.courseId(),
                child.classId(),
                child.teacherId(),
                child.materialScope(),
                child.sourceType(),
                matched.documentId(),
                matched.chapterId(),
                matched.chapterTitle(),
                matched.sectionId(),
                matched.sectionTitle(),
                null,
                -1,
                "SECTION"
        );
    }

    private boolean isExpandableTextbook(CourseMaterial material, ElasticVectorService.SearchChunk child) {
        if (material == null || material.getContent() == null || material.getContent().isBlank()) return false;
        String sourceType = child.sourceType();
        return !"GOLD_QA".equalsIgnoreCase(sourceType)
                && !"KNOWLEDGE_CANDIDATE".equalsIgnoreCase(sourceType);
    }

    private String parentWindow(String value, String childContent, int maxChars) {
        if (value == null || value.length() <= maxChars) return value;
        int childPosition = childContent == null ? 0 : value.indexOf(childContent);
        int start = Math.max(0, childPosition - 800);
        if (start > 0) {
            int nextSpace = value.indexOf(' ', start);
            if (nextSpace > 0) start = nextSpace + 1;
        }
        int hardEnd = Math.min(value.length(), start + maxChars);
        int end = hardEnd;
        if (hardEnd < value.length()) {
            int sentence = Math.max(value.lastIndexOf(". ", hardEnd), value.lastIndexOf('\n', hardEnd));
            int space = value.lastIndexOf(' ', hardEnd);
            if (sentence > start + maxChars / 2) end = sentence + 1;
            else if (space > start) end = space;
        }
        return value.substring(start, end).trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }
}
