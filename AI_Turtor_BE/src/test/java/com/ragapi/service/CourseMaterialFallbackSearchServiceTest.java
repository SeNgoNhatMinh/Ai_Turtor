package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseMaterialFallbackSearchServiceTest {

    @Mock CourseMaterialRepository materialRepository;
    @Mock CourseMaterialChunkingService chunkingService;
    @InjectMocks CourseMaterialFallbackSearchService service;

    @Test
    void textbookSearchExcludesV1CandidatesAndGoldQa() {
        CourseMaterial textbook = material("book-1", "PDF", "Giáo trình giải thích recursion.");
        CourseMaterial candidate = material("candidate-1", "KNOWLEDGE_CANDIDATE", "Recursion từ V1.");
        candidate.setCategory("senior-approved-knowledge");
        CourseMaterial goldQa = material("gold-1", "GOLD_QA", "Question: recursion Gold answer.");
        when(materialRepository.findByCourseId("PFP191")).thenReturn(List.of(textbook, candidate, goldQa));
        when(chunkingService.chunk(anyString())).thenAnswer(invocation -> {
            String content = invocation.getArgument(0, String.class);
            return List.of(content);
        });

        List<ElasticVectorService.SearchChunk> result = service.searchTextbook(
                "recursion",
                "PFP191",
                null,
                8
        );

        assertEquals(1, result.size());
        assertEquals("book-1", result.get(0).materialId());
    }

    private CourseMaterial material(String id, String sourceType, String content) {
        CourseMaterial material = new CourseMaterial();
        material.setId(id);
        material.setCourseId("PFP191");
        material.setSourceType(sourceType);
        material.setContent(content);
        material.setMaterialScope("COURSE_SHARED");
        return material;
    }
}
