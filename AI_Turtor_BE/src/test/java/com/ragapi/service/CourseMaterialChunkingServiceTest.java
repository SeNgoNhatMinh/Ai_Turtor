package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.MaterialTocEntry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CourseMaterialChunkingServiceTest {

    private final CourseMaterialChunkingService service = new CourseMaterialChunkingService();

    @Test
    void createsDocumentChapterSectionChunkHierarchy() {
        String text = """
                Chapter 1 Servlet Fundamentals
                Chapter introduction.
                1.1 Servlet lifecycle
                init starts the servlet. service handles requests. destroy releases resources.
                1.2 Request handling
                The container dispatches HTTP requests.
                Chapter 2 JSP
                JSP content.
                """;

        List<CourseMaterialChunkingService.HierarchicalChunk> chunks =
                service.chunkHierarchically("material-1", text, 120);

        CourseMaterialChunkingService.HierarchicalChunk lifecycle = chunks.stream()
                .filter(chunk -> chunk.content().contains("init starts"))
                .findFirst().orElseThrow();
        CourseMaterialChunkingService.HierarchicalChunk request = chunks.stream()
                .filter(chunk -> chunk.content().contains("dispatches HTTP"))
                .findFirst().orElseThrow();
        CourseMaterialChunkingService.HierarchicalChunk jsp = chunks.stream()
                .filter(chunk -> chunk.content().contains("JSP content"))
                .findFirst().orElseThrow();

        assertEquals("material-1", lifecycle.documentId());
        assertEquals("Chapter 1 Servlet Fundamentals", lifecycle.chapterTitle());
        assertEquals("1.1 Servlet lifecycle", lifecycle.sectionTitle());
        assertEquals(lifecycle.chapterId(), request.chapterId());
        assertTrue(!lifecycle.sectionId().equals(request.sectionId()));
        assertTrue(!lifecycle.chapterId().equals(jsp.chapterId()));
    }

    @Test
    void prefersPdfTocAndDoesNotTreatPageHeaderAsChapter() {
        String text = "Chapter 1 Servlets\nOverview.\n1.1 Lifecycle\nLifecycle details.\n"
                + "456 - CHAPTER 1 Servlets\ncontinued details.\nChapter 2 JSP\nJSP details.";
        List<MaterialTocEntry> toc = List.of(
                MaterialTocEntry.builder().title("Chapter 1 Servlets").level(0).build(),
                MaterialTocEntry.builder().title("1.1 Lifecycle").level(1).build(),
                // Some PDFs nest real chapters below a top-level Contents bookmark.
                MaterialTocEntry.builder().title("Chapter 2 JSP").level(1).build()
        );

        List<CourseMaterialChunkingService.HierarchicalChunk> chunks =
                service.chunkHierarchically("material-1", text, toc, 1000);

        assertEquals(2, chunks.stream().map(CourseMaterialChunkingService.HierarchicalChunk::chapterId).distinct().count());
        assertEquals("Chapter 1 Servlets", chunks.get(1).chapterTitle());
        assertEquals("1.1 Lifecycle", chunks.get(1).sectionTitle());
        assertTrue(chunks.stream().noneMatch(chunk -> chunk.chapterTitle().startsWith("456")));
    }

    @Test
    void usesPdfPagePositionToDisambiguateRepeatedSectionTitles() {
        String text = "Contents\nSummary\nChapter 1\n" + "preface ".repeat(80)
                + "Chapter 1 Servlets\nbody\nSummary\ncorrect servlet summary\n";
        CourseMaterial material = new CourseMaterial();
        material.setId("material-1");
        material.setContent(text);
        material.setPageCount(10);
        material.setTableOfContents(List.of(
                MaterialTocEntry.builder().title("Chapter 1 Servlets").level(0).pageStart(8).build(),
                MaterialTocEntry.builder().title("Summary").level(1).pageStart(9).build()
        ));

        List<CourseMaterialChunkingService.HierarchicalChunk> chunks = service.chunkHierarchically(material);

        CourseMaterialChunkingService.HierarchicalChunk summary = chunks.stream()
                .filter(chunk -> "Summary".equals(chunk.sectionTitle())).findFirst().orElseThrow();
        assertTrue(summary.content().contains("correct servlet summary"));
        assertTrue(!summary.content().contains("Contents"));
    }

    @Test
    void assignsExtractedPdfPagesByBookmarkRangeWithoutOcrTitleMatching() {
        CourseMaterial material = new CourseMaterial();
        material.setId("pdf-1");
        material.setContent("OCR text does not preserve headings exactly");
        material.setTableOfContents(List.of(
                MaterialTocEntry.builder().title("Chapter 3: Servlets").level(0).pageStart(2).pageEnd(4).build(),
                MaterialTocEntry.builder().title("Using init and destroy").level(1).pageStart(3).pageEnd(3).build()
        ));

        List<CourseMaterialChunkingService.HierarchicalChunk> chunks = service.chunkPdfPages(
                material,
                List.of("front matter", "servlet overview", "init service destroy details", "servlet summary")
        );

        CourseMaterialChunkingService.HierarchicalChunk lifecycle = chunks.stream()
                .filter(chunk -> chunk.content().contains("init service destroy")).findFirst().orElseThrow();
        assertEquals("Chapter 3: Servlets", lifecycle.chapterTitle());
        assertEquals("Using init and destroy", lifecycle.sectionTitle());
        assertTrue(lifecycle.parentContent().contains("init service destroy details"));
    }

    @Test
    void newerPageSectionWinsOverOlderDeeperBookmark() {
        CourseMaterial material = new CourseMaterial();
        material.setId("pdf-1");
        material.setContent("fallback");
        material.setTableOfContents(List.of(
                MaterialTocEntry.builder().title("Conventions").level(2).pageStart(1).pageEnd(10).build(),
                MaterialTocEntry.builder().title("Chapter 3: Servlets").level(0).pageStart(3).pageEnd(10).build(),
                MaterialTocEntry.builder().title("Creating a Servlet Class").level(1).pageStart(4).pageEnd(6).build()
        ));

        List<CourseMaterialChunkingService.HierarchicalChunk> chunks = service.chunkPdfPages(
                material,
                List.of("front", "preface", "chapter", "servlet lifecycle", "init service destroy")
        );

        CourseMaterialChunkingService.HierarchicalChunk lifecycle = chunks.stream()
                .filter(chunk -> chunk.content().contains("init service destroy")).findFirst().orElseThrow();
        assertEquals("Chapter 3: Servlets", lifecycle.chapterTitle());
        assertEquals("Creating a Servlet Class", lifecycle.sectionTitle());
    }
}
