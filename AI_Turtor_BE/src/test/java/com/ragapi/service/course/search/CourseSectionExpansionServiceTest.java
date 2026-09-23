package com.ragapi.service.course.search;

import com.ragapi.service.course.model.RetrievedCourseChunk;
import com.ragapi.service.*;
import com.ragapi.entity.CourseMaterial;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CourseSectionExpansionServiceTest {

    private final CourseMaterialChunkingService chunking = new CourseMaterialChunkingService();
    private final CourseSectionExpansionService service = new CourseSectionExpansionService(chunking);

    @Test
    void expandsMatchedChildToItsSectionWithoutReadingOtherChapter() {
        String lifecycle = "1.1 Servlet lifecycle\n" + "Background detail. ".repeat(90)
                + "init starts the servlet, service handles requests, and destroy releases resources.\n";
        String content = "Chapter 1 Servlets\nOverview.\n" + lifecycle
                + "Chapter 2 JSP\nJSP is a view technology.";
        CourseMaterial material = new CourseMaterial();
        material.setId("m1");
        material.setContent(content);
        material.setSourceType("PDF");

        CourseMaterialChunkingService.HierarchicalChunk child = chunking.chunkHierarchically("m1", content).stream()
                .filter(chunk -> chunk.content().contains("destroy releases"))
                .findFirst().orElseThrow();
        RetrievedCourseChunk hit = new RetrievedCourseChunk(
                child.content(), 0.94, "m1", "PRJ301", null, null, "COURSE_SHARED", "PDF",
                child.documentId(), child.chapterId(), child.chapterTitle(), child.sectionId(),
                child.sectionTitle(), child.chunkId(), child.chunkIndex(), "CHUNK");

        List<RetrievedCourseChunk> expanded = service.expand(List.of(hit), Map.of("m1", material));

        assertEquals(1, expanded.size());
        assertEquals("SECTION", expanded.get(0).nodeType());
        assertTrue(expanded.get(0).content().contains("init starts the servlet"));
        assertTrue(!expanded.get(0).content().contains("JSP is a view technology"));
    }
}
