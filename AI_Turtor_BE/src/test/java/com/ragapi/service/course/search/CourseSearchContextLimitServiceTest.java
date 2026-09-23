package com.ragapi.service.course.search;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseSearchContextLimitServiceTest {

    @Mock
    private OpenRouterChatService chatService;

    @Test
    void applyBudget_keepsHighestPriorityChunksWithinLimit() {
        when(chatService.isOllamaOnlyActive()).thenReturn(false);
        CourseSearchContextLimitService service = new CourseSearchContextLimitService(chatService);
        ReflectionTestUtils.setField(service, "maxContextChars", 1000);
        ReflectionTestUtils.setField(service, "ollamaMaxContextChars", 600);
        List<RetrievedCourseChunk> chunks = List.of(
                chunk("a".repeat(600), 0.9),
                chunk("b".repeat(600), 0.8),
                chunk("c".repeat(600), 0.7)
        );

        List<RetrievedCourseChunk> selected = service.applyBudget(chunks);

        assertThat(selected).hasSize(2);
        assertThat(selected.get(0).content()).hasSize(600);
        assertThat(selected.get(1).content()).hasSize(400);
    }

    @Test
    void applyBudget_usesTighterLimitWhenOllamaOnly() {
        when(chatService.isOllamaOnlyActive()).thenReturn(true);
        CourseSearchContextLimitService service = new CourseSearchContextLimitService(chatService);
        ReflectionTestUtils.setField(service, "maxContextChars", 12000);
        ReflectionTestUtils.setField(service, "ollamaMaxContextChars", 1000);
        List<RetrievedCourseChunk> chunks = List.of(
                chunk("a".repeat(700), 0.9),
                chunk("b".repeat(800), 0.8)
        );

        List<RetrievedCourseChunk> selected = service.applyBudget(chunks);

        assertThat(selected).hasSize(2);
        assertThat(selected.get(0).content()).hasSize(700);
        assertThat(selected.get(1).content()).hasSize(300);
    }

    @Test
    void applyBudget_doesNotCreateMeaninglessTailEvidence() {
        when(chatService.isOllamaOnlyActive()).thenReturn(false);
        CourseSearchContextLimitService service = new CourseSearchContextLimitService(chatService);
        ReflectionTestUtils.setField(service, "maxContextChars", 1000);
        ReflectionTestUtils.setField(service, "ollamaMaxContextChars", 600);
        List<RetrievedCourseChunk> chunks = List.of(
                chunk("a".repeat(996), 0.9),
                chunk("meaningful source excerpt that must not become four characters", 0.8)
        );

        List<RetrievedCourseChunk> selected = service.applyBudget(chunks);

        assertThat(selected).hasSize(1);
        assertThat(selected.get(0).content()).hasSize(996);
    }

    @Test
    void applyBudget_preservesHierarchyMetadataWhenChunkIsTrimmed() {
        when(chatService.isOllamaOnlyActive()).thenReturn(false);
        CourseSearchContextLimitService service = new CourseSearchContextLimitService(chatService);
        ReflectionTestUtils.setField(service, "maxContextChars", 1000);
        ReflectionTestUtils.setField(service, "ollamaMaxContextChars", 600);
        RetrievedCourseChunk chunk = new RetrievedCourseChunk(
                "x".repeat(1400),
                0.9,
                "mat-1",
                "PRJ301",
                "SE1840",
                "teacher-1",
                "COURSE_SHARED",
                "PDF",
                "doc-1",
                "chapter-3",
                "Chapter 3: Writing Your First Servlet",
                "section-4",
                "Understanding doGet(), doPost(), and Other Methods",
                "chunk-1",
                1,
                "SECTION"
        );

        List<RetrievedCourseChunk> selected = service.applyBudget(List.of(chunk));

        assertThat(selected).hasSize(1);
        assertThat(selected.get(0).content()).hasSize(1000);
        assertThat(selected.get(0).chapterTitle()).isEqualTo("Chapter 3: Writing Your First Servlet");
        assertThat(selected.get(0).sectionTitle()).isEqualTo("Understanding doGet(), doPost(), and Other Methods");
        assertThat(selected.get(0).nodeType()).isEqualTo("SECTION");
    }

    private RetrievedCourseChunk chunk(String content, double score) {
        return new RetrievedCourseChunk(content, score, "mat-1", "CEA201", "CEA201-01", "teacher-1", "COURSE");
    }
}
