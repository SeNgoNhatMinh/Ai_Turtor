package com.ragapi.service.course.search;

import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import dev.langchain4j.data.embedding.Embedding;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseRetrievalMergeServiceTest {

    @Mock CourseMaterialStoreGateway materialRepository;
    @Mock CourseSearchContextLimitService contextLimit;
    @Mock ApprovedKnowledgeSearchService approvedKnowledgeSearch;
    @Mock CourseSectionExpansionService sectionExpansion;
    @Mock CourseRetrievalCandidateService candidateService;

    private CourseRetrievalMergeService service;

    @BeforeEach
    void setUp() {
        service = new CourseRetrievalMergeService(
                materialRepository,
                contextLimit,
                approvedKnowledgeSearch,
                sectionExpansion,
                candidateService
        );
        when(sectionExpansion.requiresExpansion(any())).thenReturn(false);
        when(contextLimit.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void normalRagChecksAndPinsApprovedKnowledgeEvenWhenPrimaryContextIsLarge() {
        CourseRetrievalQuery query = new CourseRetrievalQuery("Pytorch là gì?", "Pytorch là gì?");
        Embedding sharedQueryEmbedding = new Embedding(new float[]{0.3f, 0.7f});
        RetrievedCourseChunk approved = chunk(
                "approved-pytorch",
                "Câu hỏi: pytorch là gì? Câu trả lời: PyTorch là thư viện tensor.",
                "KNOWLEDGE_CANDIDATE"
        );
        RetrievedCourseChunk primaryOne = chunk(
                "python-list",
                "A".repeat(1200),
                "PDF"
        );
        RetrievedCourseChunk primaryTwo = chunk(
                "python-aliasing",
                "B".repeat(1200),
                "PDF"
        );
        when(candidateService.retrieveTeachingNotes(
                query, "PFP191", "PFP191-01", sharedQueryEmbedding))
                .thenReturn(List.of());
        when(approvedKnowledgeSearch.retrieveRelevant(
                eq("Pytorch là gì?"), eq("PFP191"), eq("PFP191-01"), same(sharedQueryEmbedding)))
                .thenReturn(List.of(approved));

        List<RetrievedCourseChunk> result = service.merge(
                query,
                "PFP191",
                "PFP191-01",
                false,
                List.of(),
                List.of(primaryOne, primaryTwo),
                sharedQueryEmbedding
        );

        assertThat(result).containsExactly(approved, primaryOne, primaryTwo);
        verify(approvedKnowledgeSearch).retrieveRelevant(
                eq("Pytorch là gì?"), eq("PFP191"), eq("PFP191-01"), same(sharedQueryEmbedding));
        ArgumentCaptor<List<RetrievedCourseChunk>> budgetCaptor = ArgumentCaptor.forClass(List.class);
        verify(contextLimit).applyBudget(budgetCaptor.capture());
        assertThat(budgetCaptor.getValue()).startsWith(approved);
    }

    @Test
    void normalRagKeepsPrimaryMaterialWhenApprovedKnowledgeIsUnrelated() {
        CourseRetrievalQuery query = new CourseRetrievalQuery("Servlet lifecycle", "Servlet lifecycle");
        RetrievedCourseChunk primary = chunk(
                "servlet-pdf",
                "The servlet lifecycle contains init, service, and destroy.",
                "PDF"
        );
        when(candidateService.retrieveTeachingNotes(query, "PRJ301", null, null))
                .thenReturn(List.of());
        when(approvedKnowledgeSearch.retrieveRelevant(
                eq("Servlet lifecycle"), eq("PRJ301"), isNull(), isNull()))
                .thenReturn(List.of());

        List<RetrievedCourseChunk> result = service.merge(
                query,
                "PRJ301",
                null,
                false,
                List.of(),
                List.of(primary),
                null
        );

        assertThat(result).containsExactly(primary);
    }

    @Test
    void textbookOnlyStillSkipsAllSupplementalKnowledge() {
        CourseRetrievalQuery query = new CourseRetrievalQuery("Pytorch là gì?", "Pytorch là gì?");
        RetrievedCourseChunk primary = chunk("python-pdf", "Python course material", "PDF");

        List<RetrievedCourseChunk> result = service.merge(
                query,
                "PFP191",
                "PFP191-01",
                true,
                List.of(),
                List.of(primary),
                null
        );

        assertThat(result).containsExactly(primary);
        verifyNoInteractions(approvedKnowledgeSearch, candidateService);
        verify(contextLimit).applyBudget(List.of(primary));
    }

    private RetrievedCourseChunk chunk(String materialId, String content, String sourceType) {
        return new RetrievedCourseChunk(
                content,
                0.90,
                materialId,
                "PFP191",
                null,
                "teacher-1",
                "COURSE_SHARED",
                sourceType
        );
    }
}
