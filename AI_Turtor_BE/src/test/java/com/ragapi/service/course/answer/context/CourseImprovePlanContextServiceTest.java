package com.ragapi.service.course.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.service.CourseMaterialChunkingService;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.service.course.model.RetrievedCourseChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
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
}
