package com.ragapi.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class RagContextBudgetService {

    @Value("${rag.generation.max-context-chars:12000}")
    private int maxContextChars;

    public List<ElasticVectorService.SearchChunk> applyBudget(List<ElasticVectorService.SearchChunk> chunks) {
        if (chunks == null || chunks.isEmpty() || maxContextChars <= 0) {
            return chunks == null ? List.of() : chunks;
        }
        int limit = Math.max(1000, maxContextChars);
        List<ElasticVectorService.SearchChunk> selected = new ArrayList<>();
        int used = 0;
        for (ElasticVectorService.SearchChunk chunk : chunks) {
            String content = chunk.content() == null ? "" : chunk.content();
            if (content.isBlank()) {
                continue;
            }
            int remaining = limit - used;
            if (remaining <= 0) {
                break;
            }
            if (content.length() <= remaining) {
                selected.add(chunk);
                used += content.length();
                continue;
            }
            selected.add(new ElasticVectorService.SearchChunk(
                    content.substring(0, remaining),
                    chunk.score(),
                    chunk.materialId(),
                    chunk.courseId(),
                    chunk.classId(),
                    chunk.teacherId(),
                    chunk.materialScope()
            ));
            used += remaining;
            break;
        }
        if (selected.size() < chunks.size()) {
            log.info("RAG context budget applied: kept {} of {} chunks (~{} chars, limit={})",
                    selected.size(), chunks.size(), used, limit);
        }
        return selected;
    }
}
