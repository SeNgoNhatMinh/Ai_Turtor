package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.entity.CanonicalTutorAnswer;
import com.ragapi.repository.CanonicalTutorAnswerRepository;
import com.ragapi.util.EmbeddingSimilarityUtil;
import dev.langchain4j.data.embedding.Embedding;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SemanticTutorAnswerCacheServiceTest {

    @Mock
    private CanonicalTutorAnswerRepository repository;

    @Mock
    private EmbeddingService embeddingService;

    @InjectMocks
    private CanonicalTutorAnswerCacheService cacheService;

    private List<Float> servletEmbedding;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(cacheService, "enabled", true);
        ReflectionTestUtils.setField(cacheService, "semanticEnabled", true);
        ReflectionTestUtils.setField(cacheService, "semanticMinSimilarity", 0.90);
        ReflectionTestUtils.setField(cacheService, "semanticMinKeywordOverlap", 0.45);
        ReflectionTestUtils.setField(cacheService, "semanticMinSourceOverlap", 0.20);
        ReflectionTestUtils.setField(cacheService, "semanticMaxCandidates", 100);
        servletEmbedding = List.of(1.0f, 0.0f, 0.0f);
    }

    @Test
    void lookupRagAnswer_usesSemanticHitWhenAcademicGatesPass() {
        CanonicalTutorAnswer cached = CanonicalTutorAnswer.builder()
                .id("cached-id")
                .courseId("CEA201")
                .classId("")
                .mode("RAG")
                .question("Servlet là gì?")
                .answer("Servlet là thành phần xử lý request trên server.")
                .confidence(0.82)
                .sources(List.of("mat-servlet-1"))
                .groundingType("COURSE_MATERIAL")
                .questionEmbedding(servletEmbedding)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build();

        when(repository.findById(anyString())).thenReturn(Optional.empty());
        when(repository.findByCourseIdAndClassIdAndModeAndExpiresAtAfterOrderByCreatedAtDesc(
                eq("CEA201"), eq(""), eq("RAG"), any(LocalDateTime.class))).thenReturn(List.of(cached));
        when(embeddingService.generateQueryEmbedding("Giải thích servlet là gì?"))
                .thenReturn(new Embedding(new float[]{0.99f, 0.01f, 0.0f}));

        Optional<CourseRagAnswer> hit = cacheService.lookupRagAnswer(
                "CEA201",
                null,
                "Giải thích servlet là gì?",
                0.75,
                List.of("mat-servlet-1", "mat-servlet-2")
        );

        assertThat(hit).isPresent();
        assertThat(hit.get().getAnswer()).contains("Servlet");
    }

    @Test
    void lookupRagAnswer_rejectsSemanticHitWhenSourcesDoNotOverlap() {
        CanonicalTutorAnswer cached = CanonicalTutorAnswer.builder()
                .id("cached-id")
                .courseId("CEA201")
                .classId("")
                .mode("RAG")
                .question("Servlet là gì?")
                .answer("Servlet là thành phần xử lý request trên server.")
                .confidence(0.82)
                .sources(List.of("mat-servlet-1"))
                .groundingType("COURSE_MATERIAL")
                .questionEmbedding(servletEmbedding)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build();

        when(repository.findById(anyString())).thenReturn(Optional.empty());
        when(repository.findByCourseIdAndClassIdAndModeAndExpiresAtAfterOrderByCreatedAtDesc(
                eq("CEA201"), eq(""), eq("RAG"), any(LocalDateTime.class))).thenReturn(List.of(cached));
        when(embeddingService.generateQueryEmbedding("Giải thích servlet là gì?"))
                .thenReturn(new Embedding(new float[]{0.99f, 0.01f, 0.0f}));

        Optional<CourseRagAnswer> hit = cacheService.lookupRagAnswer(
                "CEA201",
                null,
                "Giải thích servlet là gì?",
                0.75,
                List.of("mat-jsp-1")
        );

        assertThat(hit).isEmpty();
    }

    @Test
    void storeRagAnswer_skipsLowConfidenceAnswers() {
        CourseRagAnswer answer = CourseRagAnswer.builder()
                .answer("Câu trả lời")
                .confidence(0.4)
                .sources(List.of("mat-1"))
                .groundingType("COURSE_MATERIAL")
                .build();

        cacheService.storeRagAnswer("CEA201", null, "Servlet là gì?", answer);

        verify(repository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void embeddingSimilarityTreatsNearIdenticalVectorsAsHighScore() {
        double score = EmbeddingSimilarityUtil.cosineSimilarity(
                List.of(1.0f, 0.0f),
                List.of(0.99f, 0.01f)
        );
        assertThat(score).isGreaterThan(0.99);
    }
}
