package com.ragapi.service.course.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.CourseMaterialChunkingService;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseImprovePlanContextServiceTest {

    @Test
    void staleMaterialProvenanceDefersToCourseWideRetrieval() {
        CourseMaterialStoreGateway materialStore = mock(CourseMaterialStoreGateway.class);
        CourseImprovePlanContextService service = new CourseImprovePlanContextService(
                materialStore,
                new CourseMaterialChunkingService()
        );
        RagQueryIntent intent = RagQueryIntent.builder()
                .retrievalQuery("Thực hành các idiom như t.append(x) và t = t[:]")
                .retrievalTerms(List.of("t.append(x)", "t[:]"))
                .sourceTerms(List.of("t.append(x)", "t[:]"))
                .sourceMaterialIds(List.of("deleted-material"))
                .sourceChunkIds(List.of("deleted-material:chunk:1"))
                .build();
        when(materialStore.findAllById(List.of("deleted-material"))).thenReturn(List.of());

        List<RetrievedCourseChunk> chunks = service.retrieve(intent, "PFP191", "PFP191-01");

        assertTrue(chunks.isEmpty());
        verify(materialStore).findAllById(anyCollection());
    }

    @Test
    void largeSourceMaterialReturnsTheMatchingExcerptQuickly() {
        CourseMaterial material = new CourseMaterial();
        material.setId("servlet-book");
        material.setCourseId("PRJ301");
        material.setMaterialScope("COURSE_SHARED");
        material.setSourceType("MARKDOWN");
        String lesson = "Khi override doPost va doPut thi servlet tranh HTTP 405 Method Not Allowed.";
        material.setContent("Chuong lap lai khong lien quan. ".repeat(30_000) + lesson);

        CourseMaterialStoreGateway materialStore = mock(CourseMaterialStoreGateway.class);
        when(materialStore.findAllById(anyCollection())).thenReturn(List.of(material));
        CourseImprovePlanContextService service = new CourseImprovePlanContextService(
                materialStore,
                new CourseMaterialChunkingService()
        );
        RagQueryIntent intent = RagQueryIntent.builder()
                .retrievalQuery("Khi nào nên override doPost doPut để tránh 405")
                .retrievalTerms(List.of("doPost", "doPut", "405"))
                .sourceMaterialIds(List.of("servlet-book"))
                .sourceChunkIds(List.of())
                .build();

        long started = System.nanoTime();
        List<RetrievedCourseChunk> chunks = service.retrieve(intent, "PRJ301", "PRJ301-01");
        long elapsedMs = (System.nanoTime() - started) / 1_000_000;

        assertTrue(elapsedMs < 2_000, "large material scan took " + elapsedMs + "ms");
        assertFalse(chunks.isEmpty());
        assertTrue(chunks.stream().allMatch(chunk -> chunk.content().contains("doPost")));
        assertTrue(chunks.stream().allMatch(chunk -> chunk.content().length() < 5_000));
    }
}
