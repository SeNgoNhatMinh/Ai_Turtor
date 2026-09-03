package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseMaterialFallbackSearchServiceTest {

    @Mock CourseMaterialRepository materialRepository;
    CourseMaterialFallbackSearchService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new CourseMaterialFallbackSearchService(materialRepository, new CourseMaterialChunkingService());
    }

    @Test
    void textbookSearchExcludesV1CandidatesAndGoldQa() {
        CourseMaterial textbook = material("book-1", "PDF", "Giáo trình giải thích recursion.");
        CourseMaterial candidate = material("candidate-1", "KNOWLEDGE_CANDIDATE", "Recursion từ V1.");
        candidate.setCategory("senior-approved-knowledge");
        CourseMaterial goldQa = material("gold-1", "GOLD_QA", "Question: recursion Gold answer.");
        when(materialRepository.findByCourseId("PFP191")).thenReturn(List.of(textbook, candidate, goldQa));

        List<ElasticVectorService.SearchChunk> result = service.searchTextbook(
                "recursion",
                "PFP191",
                null,
                8
        );

        assertEquals(1, result.size());
        assertEquals("book-1", result.get(0).materialId());
        assertEquals(null, result.get(0).chapterTitle());
        assertEquals(null, result.get(0).sectionTitle());
    }

    @Test
    void approvedKnowledgeSearchMatchesConceptInsideFullAnswerOnly() {
        CourseMaterial textbook = material("book-1", "PDF", "Giáo trình Python cơ bản.");
        CourseMaterial candidate = material(
                "candidate-1",
                "KNOWLEDGE_CANDIDATE",
                "Câu hỏi: PyTorch là gì? Câu trả lời: Forward Propagation đưa dữ liệu qua mạng neural."
        );
        candidate.setCategory("senior-approved-knowledge");
        when(materialRepository.findByCourseId("PFP191")).thenReturn(List.of(textbook, candidate));

        List<ElasticVectorService.SearchChunk> result = service.searchApprovedKnowledge(
                "Forward Propagation",
                "PFP191",
                null,
                8
        );

        assertEquals(1, result.size());
        assertEquals("candidate-1", result.get(0).materialId());
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
