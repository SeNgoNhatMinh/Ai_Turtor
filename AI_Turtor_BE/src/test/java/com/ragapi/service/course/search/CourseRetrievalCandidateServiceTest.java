package com.ragapi.service.course.search;

import com.ragapi.service.course.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.service.course.model.CourseRetrievalQuery;
import dev.langchain4j.data.embedding.Embedding;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseRetrievalCandidateServiceTest {

    @Test
    void preparesOneEmbeddingAndReusesItForVectorRetrieval() throws Exception {
        CourseKnowledgeSearchGateway gateway = mock(CourseKnowledgeSearchGateway.class);
        CourseMaterialTextSearchService lexical = mock(CourseMaterialTextSearchService.class);
        Embedding shared = new Embedding(new float[]{0.2f, 0.8f});
        when(gateway.supportsPreparedQueryEmbedding()).thenReturn(true);
        when(gateway.prepareQueryEmbedding("Spring Boot dependency injection là gì?"))
                .thenReturn(shared);
        when(gateway.searchTextbookWithScores(
                "Spring Boot dependency injection là gì?", "course-1", null, shared))
                .thenReturn(List.of());
        when(gateway.searchTextbookKeywordWithScores(any(), eq("course-1"), eq(null), anyInt()))
                .thenReturn(List.of());
        when(lexical.searchTextbook(any(), eq("course-1"), eq(null), anyInt()))
                .thenReturn(List.of());
        CourseRetrievalCandidateService service = new CourseRetrievalCandidateService(gateway, lexical);
        CourseRetrievalQuery query = new CourseRetrievalQuery(
                "Spring Boot dependency injection là gì?",
                "Spring Boot dependency injection là gì?",
                "mixed",
                List.of("Spring Boot", "Dependency Injection"),
                "Spring Boot Dependency Injection");

        var result = service.retrievePrimary(query, "course-1", null, List.of());

        assertThat(result.queryEmbedding()).isSameAs(shared);
        verify(gateway, times(1)).prepareQueryEmbedding(query.expandedQuestion());
        verify(gateway, times(1)).searchTextbookWithScores(
                query.expandedQuestion(), "course-1", null, shared);
    }

    @Test
    void embeddingFailureDoesNotTriggerASecondLegacyEmbeddingAttempt() throws Exception {
        CourseKnowledgeSearchGateway gateway = mock(CourseKnowledgeSearchGateway.class);
        CourseMaterialTextSearchService lexical = mock(CourseMaterialTextSearchService.class);
        when(gateway.supportsPreparedQueryEmbedding()).thenReturn(true);
        when(gateway.prepareQueryEmbedding("question")).thenThrow(new RuntimeException("provider down"));
        when(gateway.searchTextbookKeywordWithScores(any(), eq("course-1"), eq(null), anyInt()))
                .thenReturn(List.of());
        when(lexical.searchTextbook(any(), eq("course-1"), eq(null), anyInt()))
                .thenReturn(List.of());
        CourseRetrievalCandidateService service = new CourseRetrievalCandidateService(gateway, lexical);

        var result = service.retrievePrimary(
                new CourseRetrievalQuery("question", "question"), "course-1", null, List.of());

        assertThat(result.queryEmbedding()).isNull();
        verify(gateway, times(1)).prepareQueryEmbedding("question");
        verify(gateway, never()).searchTextbookWithScores("question", "course-1", null);
        verify(gateway, never()).searchTextbookWithScores(
                eq("question"), eq("course-1"), eq(null), any(Embedding.class));
    }
}
