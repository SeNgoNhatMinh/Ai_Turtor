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
                "PRO la he dieu hanh thoi gian thuc dung trong giao trinh.",
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
        when(chatService.generate(anyString(), eq("PRO la gi?")))
                .thenReturn("Theo giao trinh, PRO la he dieu hanh thoi gian thuc.");

        CourseRagAnswer answer = service.askWithConfidenceFromTextbook("PRO la gi?", "PRJ301", null);

        assertEquals("Theo giao trinh, PRO la he dieu hanh thoi gian thuc.", answer.getAnswer());
        assertFalse(answer.getEscalationRecommended());
        verify(vectorService).searchTextbookWithScores(anyString(), eq("PRJ301"), isNull());
        verify(vectorService, never()).searchWithScores(anyString(), anyString(), any());
        verifyNoInteractions(answerCacheService, cacheHitAuditService, approvedKnowledgeRetrievalService);
        verify(fallbackSearchService, never()).search(anyString(), anyString(), any(), any(Integer.class));
    }

    @Test
    void studentAskRetrievesTextbooksFirstAndNeverUsesUnfilteredSearch() throws Exception {
        ElasticVectorService.SearchChunk textbookChunk = new ElasticVectorService.SearchChunk(
                "Java EE builds on Java SE and adds enterprise APIs.",
                0.91,
                "pdf-1",
                "PRJ301",
                null,
                "teacher-1",
                "COURSE_SHARED",
                "PDF"
        );
        when(retrievalQueryTranslationService.expandForRetrieval(anyString(), eq("PRJ301"), any(Boolean.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(vectorService.searchTextbookWithScores(anyString(), eq("PRJ301"), isNull()))
                .thenReturn(List.of(textbookChunk));
        when(vectorService.searchGoldQaTeachingNotesWithScores(anyString(), eq("PRJ301"), isNull(), eq(2)))
                .thenReturn(List.of());
        when(approvedKnowledgeRetrievalService.retrieveRelevant(anyString(), eq("PRJ301"), isNull()))
                .thenReturn(List.of());
        when(rerankService.rerank(anyString(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(contextBudgetService.applyBudget(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(materialRepository.findAllById(any())).thenReturn(List.of());
        when(courseRepository.findByCourseId("PRJ301")).thenReturn(Optional.empty());
        when(answerCacheService.lookupExactRagAnswer(eq("PRJ301"), isNull(), anyString())).thenReturn(Optional.empty());
        when(answerCacheService.lookupEarlySemanticRagAnswer(eq("PRJ301"), isNull(), anyString())).thenReturn(Optional.empty());
        when(answerCacheService.lookupSemanticRagAnswer(eq("PRJ301"), isNull(), anyString(), any(Double.class), any()))
                .thenReturn(Optional.empty());
        when(chatService.generate(anyString(), eq("Java EE vs Java SE")))
                .thenReturn("Theo giao trinh, Java EE xay tren Java SE.");

        CourseRagAnswer answer = service.askWithConfidence("Java EE vs Java SE", "PRJ301", null);

        assertEquals("Theo giao trinh, Java EE xay tren Java SE.", answer.getAnswer());
        verify(vectorService).searchTextbookWithScores(anyString(), eq("PRJ301"), isNull());
        verify(vectorService).searchGoldQaTeachingNotesWithScores(anyString(), eq("PRJ301"), isNull(), eq(2));
        verify(vectorService, never()).searchWithScores(anyString(), anyString(), any());
    }
}
