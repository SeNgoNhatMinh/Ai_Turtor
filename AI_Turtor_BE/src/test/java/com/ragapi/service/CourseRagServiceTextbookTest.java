package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.CourseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseRagServiceTextbookTest {

    @Mock ElasticVectorService vectorService;
    @Mock CourseMaterialFallbackSearchService fallbackSearchService;
    @Mock RerankService rerankService;
    @Mock OpenRouterChatService chatService;
    @Mock RetrievalQueryTranslationService retrievalQueryTranslationService;
    @Mock CourseMaterialRepository materialRepository;
    @Mock CourseRepository courseRepository;
    @Mock CanonicalTutorAnswerCacheService answerCacheService;
    @Mock TutorCacheHitAuditService cacheHitAuditService;
    @Mock RagContextBudgetService contextBudgetService;
    @Mock ApprovedKnowledgeRetrievalService approvedKnowledgeRetrievalService;

    private CourseRagService service;

    @BeforeEach
    void setUp() {
        service = new CourseRagService(
                vectorService,
                fallbackSearchService,
                rerankService,
                chatService,
                retrievalQueryTranslationService,
                materialRepository,
                courseRepository,
                answerCacheService,
                cacheHitAuditService,
                contextBudgetService,
                approvedKnowledgeRetrievalService
        );
    }

    @Test
    void textbookExamSkipsCacheAndLearnedKnowledge() throws Exception {
        ElasticVectorService.SearchChunk textbookChunk = new ElasticVectorService.SearchChunk(
                "PRO là hệ điều hành thời gian thực dùng trong giáo trình.",
                0.95,
                "material-1",
                "PRJ301",
                null,
                "teacher-1",
                "COURSE_SHARED"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("PRJ301"), any(Boolean.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("PRJ301"), isNull()))
                .thenReturn(List.of(textbookChunk));
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());
        when(courseRepository.findByCourseId("PRJ301")).thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq("PRO là gì?")))
                .thenReturn("Theo giáo trình, PRO là hệ điều hành thời gian thực.");

        CourseRagAnswer answer = service.askWithConfidenceFromTextbook("PRO là gì?", "PRJ301", null);

        assertEquals("Theo giáo trình, PRO là hệ điều hành thời gian thực.", answer.getAnswer());
        assertFalse(answer.getEscalationRecommended());
        verify(vectorService).searchTextbookWithScores(anyString(), eq("PRJ301"), isNull());
        verify(vectorService, never()).searchWithScores(anyString(), anyString(), any());
        verifyNoInteractions(answerCacheService, cacheHitAuditService, approvedKnowledgeRetrievalService);
        verify(fallbackSearchService, never()).search(anyString(), anyString(), any(), any(Integer.class));
    }
}
