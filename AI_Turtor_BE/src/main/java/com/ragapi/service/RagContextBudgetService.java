package com.ragapi.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class RagContextBudgetService {

    static final int MIN_PARTIAL_CHUNK_CHARS = 240;

    private final OpenRouterChatService chatService;

    @Value("${rag.generation.max-context-chars:12000}")
    private int maxContextChars;

    @Value("${rag.generation.ollama-max-context-chars:6000}")
    private int ollamaMaxContextChars;

    public RagContextBudgetService(OpenRouterChatService chatService) {
        this.chatService = chatService;
    }

    public List<ElasticVectorService.SearchChunk> applyBudget(List<ElasticVectorService.SearchChunk> chunks) {
        int configuredLimit = chatService.isOllamaOnlyActive()
                ? Math.min(maxContextChars, ollamaMaxContextChars)
                : maxContextChars;
        if (chunks == null || chunks.isEmpty() || configuredLimit <= 0) {
            return chunks == null ? List.of() : chunks;
        }
        int limit = Math.max(1000, configuredLimit);
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
            if (remaining < MIN_PARTIAL_CHUNK_CHARS) {
                break;
            }
            String partial = truncateAtBoundary(content, remaining);
            if (partial.length() < MIN_PARTIAL_CHUNK_CHARS) {
                break;
            }
            selected.add(new ElasticVectorService.SearchChunk(
                    partial,
                    chunk.score(),
                    chunk.materialId(),
                    chunk.courseId(),
                    chunk.classId(),
                    chunk.teacherId(),
                    chunk.materialScope(),
                    chunk.sourceType(),
                    chunk.documentId(),
                    chunk.chapterId(),
                    chunk.chapterTitle(),
                    chunk.sectionId(),
                    chunk.sectionTitle(),
                    chunk.chunkId(),
                    chunk.chunkIndex(),
                    chunk.nodeType()
            ));
            used += partial.length();
            break;
        }
        if (selected.size() < chunks.size()) {
            log.info("RAG context budget applied: kept {} of {} chunks (~{} chars, limit={})",
                    selected.size(), chunks.size(), used, limit);
        }
        return selected;
    }

    private String truncateAtBoundary(String content, int limit) {
        String prefix = content.substring(0, Math.min(limit, content.length())).trim();
        int minimumBoundary = Math.min(MIN_PARTIAL_CHUNK_CHARS, prefix.length());
        int boundary = Math.max(
                Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('.')),
                prefix.lastIndexOf(' ')
        );
        if (boundary >= minimumBoundary) {
            prefix = prefix.substring(0, boundary).trim();
        }
        return prefix;
    }
}
