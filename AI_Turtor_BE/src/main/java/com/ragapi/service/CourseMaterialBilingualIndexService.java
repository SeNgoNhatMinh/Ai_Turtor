package com.ragapi.service;

import com.ragapi.service.course.search.LocalRetrievalQueryProcessor;
import dev.langchain4j.model.openai.OpenAiChatModel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Creates a Vietnamese retrieval representation at import time only.
 * The source CourseMaterial remains the single business record and the English
 * chunks remain the source of truth.
 */
@Slf4j
@Service
public class CourseMaterialBilingualIndexService {

    private final boolean enabled;
    private final LocalRetrievalQueryProcessor queryProcessor;
    private final OpenAiChatModel translationModel;

    public CourseMaterialBilingualIndexService(
            LocalRetrievalQueryProcessor queryProcessor,
            @Value("${rag.indexing.bilingual.enabled:false}") boolean enabled,
            @Value("${rag.indexing.bilingual.api-key:${NVIDIA_API_KEY:}}") String apiKey,
            @Value("${rag.indexing.bilingual.base-url:https://integrate.api.nvidia.com/v1}") String baseUrl,
            @Value("${rag.indexing.bilingual.translation-model:NVIDIABuild-Autogen-17}") String model,
            @Value("${rag.indexing.bilingual.timeout-seconds:120}") int timeoutSeconds) {
        this.queryProcessor = queryProcessor;
        this.enabled = enabled;
        if (enabled && (apiKey == null || apiKey.isBlank())) {
            throw new IllegalStateException("NVIDIA_API_KEY is required when bilingual import is enabled");
        }
        this.translationModel = enabled
                ? OpenAiChatModel.builder()
                    .apiKey(apiKey)
                    .baseUrl(baseUrl)
                    .modelName(model)
                    .timeout(Duration.ofSeconds(Math.max(15, timeoutSeconds)))
                    .maxRetries(0)
                    .build()
                : null;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public int countEnglishChunks(List<CourseMaterialChunkingService.HierarchicalChunk> chunks) {
        if (chunks == null) return 0;
        return (int) chunks.stream()
                .filter(chunk -> chunk != null && "en".equals(queryProcessor.process(chunk.content()).language()))
                .count();
    }

    public int countTechnicalTerms(List<CourseMaterialChunkingService.HierarchicalChunk> chunks) {
        if (chunks == null) return 0;
        return chunks.stream().filter(java.util.Objects::nonNull)
                .mapToInt(chunk -> queryProcessor.process(chunk.content()).technicalTerms().size()).sum();
    }

    public List<String> failedEnglishChunkIds(
            List<CourseMaterialChunkingService.HierarchicalChunk> sourceChunks,
            List<CourseMaterialChunkingService.HierarchicalChunk> translatedChunks) {
        if (sourceChunks == null) return List.of();
        java.util.Set<String> translatedSourceIds = translatedChunks == null ? java.util.Set.of()
                : translatedChunks.stream().map(CourseMaterialChunkingService.HierarchicalChunk::chunkId)
                .filter(java.util.Objects::nonNull)
                .map(id -> id.endsWith("-vi") ? id.substring(0, id.length() - 3) : id)
                .collect(java.util.stream.Collectors.toSet());
        return sourceChunks.stream()
                .filter(java.util.Objects::nonNull)
                .filter(chunk -> "en".equals(queryProcessor.process(chunk.content()).language()))
                .map(CourseMaterialChunkingService.HierarchicalChunk::chunkId)
                .filter(id -> id != null && !translatedSourceIds.contains(id))
                .toList();
    }

    public List<CourseMaterialChunkingService.HierarchicalChunk> createVietnameseRepresentations(
            List<CourseMaterialChunkingService.HierarchicalChunk> sourceChunks) {
        if (!enabled || sourceChunks == null || sourceChunks.isEmpty()) {
            return List.of();
        }
        List<CourseMaterialChunkingService.HierarchicalChunk> translated = new ArrayList<>();
        Map<String, String> translatedParents = new HashMap<>();
        for (CourseMaterialChunkingService.HierarchicalChunk source : sourceChunks) {
            if (!"en".equals(queryProcessor.process(source.content()).language())) {
                continue;
            }
            try {
                List<String> technicalTerms = queryProcessor.process(source.content()).technicalTerms();
                String vietnamese = translateWithRetry(source.content(), technicalTerms);
                if (!isValidTranslation(source.content(), vietnamese, technicalTerms)) {
                    log.warn("Skipping invalid VI representation for chunkId={}", source.chunkId());
                    continue;
                }
                String vietnameseParent = translateParent(source, vietnamese, translatedParents);
                translated.add(new CourseMaterialChunkingService.HierarchicalChunk(
                        source.documentId(),
                        source.chapterId(),
                        source.chapterTitle(),
                        source.sectionId(),
                        source.sectionTitle(),
                        vietnameseParent,
                        source.chunkId() + "-vi",
                        source.chunkIndex(),
                        vietnamese
                ));
            } catch (RuntimeException failure) {
                // Import remains usable with the EN source of truth when local translation fails.
                log.warn("VI representation failed for chunkId={}: {}", source.chunkId(), failure.getMessage());
            }
        }
        return List.copyOf(translated);
    }

    private String translateParent(
            CourseMaterialChunkingService.HierarchicalChunk source,
            String translatedChild,
            Map<String, String> translatedParents
    ) {
        String parent = source.parentContent();
        if (parent == null || parent.isBlank() || parent.equals(source.content())) {
            return translatedChild;
        }
        String cached = translatedParents.get(parent);
        if (cached != null) return cached;
        try {
            List<String> terms = queryProcessor.process(parent).technicalTerms();
            String translated = translateWithRetry(parent, terms);
            if (!isValidTranslation(parent, translated, terms)) {
                log.warn("Parent VI representation failed validation for sectionId={}", source.sectionId());
                return translatedChild;
            }
            translatedParents.put(parent, translated);
            return translated;
        } catch (RuntimeException error) {
            log.warn("Parent VI representation failed for sectionId={}: {}",
                    source.sectionId(), error.getMessage());
            return translatedChild;
        }
    }

    private String translate(String source, List<String> technicalTerms) {
        String protectedTerms = technicalTerms.isEmpty() ? "(none)" : String.join(", ", technicalTerms);
        String prompt = """
                Translate the course-material excerpt below from English to natural Vietnamese.
                Return only the translated excerpt, without commentary or Markdown fences.
                Preserve code, identifiers, API names, and these canonical technical terms exactly: %s
                Do not omit facts, examples, conditions, warnings, or references.

                SOURCE:
                %s
                """.formatted(protectedTerms, source);
        String output = translationModel.generate(prompt);
        return output == null ? "" : output.trim();
    }

    private String translateWithRetry(String source, List<String> technicalTerms) {
        String translated = translate(source, technicalTerms);
        if (isValidTranslation(source, translated, technicalTerms)) return translated;
        log.warn("Retrying import translation after deterministic validation failed");
        return translate(source, technicalTerms);
    }

    boolean isValidTranslation(String source, String translated, List<String> technicalTerms) {
        if (translated == null || translated.isBlank()) return false;
        double ratio = (double) translated.length() / Math.max(1, source.length());
        if (ratio < 0.35 || ratio > 2.75) return false;
        String outputLower = translated.toLowerCase(Locale.ROOT);
        if (technicalTerms.stream().anyMatch(term -> !outputLower.contains(term.toLowerCase(Locale.ROOT)))) {
            return false;
        }
        String language = queryProcessor.process(translated).language();
        return "vi".equals(language) || "mixed".equals(language);
    }
}
