package com.ragapi.service;

import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.dto.cotraining.ConfirmChaptersRequest;
import com.ragapi.entity.CourseChapterOutline;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.MaterialTocEntry;
import com.ragapi.repository.CourseChapterOutlineRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.GoldQaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.atLeast;

@ExtendWith(MockitoExtension.class)
class ChapterOutlineServiceTest {

    @Mock CourseMaterialRepository materialRepository;
    @Mock CourseChapterOutlineRepository outlineRepository;
    @Mock CourseMaterialChunkingService chunkingService;
    @Mock GoldQaRepository goldQaRepository;
    @Mock PdfExtractionService pdfExtractionService;
    @Mock PdfStorageService pdfStorageService;

    ChapterOutlineService service;

    @BeforeEach
    void setUp() {
        service = new ChapterOutlineService(
                materialRepository,
                outlineRepository,
                chunkingService,
                goldQaRepository,
                pdfExtractionService,
                pdfStorageService,
                new HtmlSectionMediaService());
    }

    @Test
    void previewChapterReturnsFullBookmarkSectionWhenExpanded() throws Exception {
        String sectionBody = "Operating system section content. ".repeat(900);
        CourseChapterOutline outline = CourseChapterOutline.builder()
                .courseId("OSG203")
                .chapterKey("what-is-an-operating-system")
                .title("1.1 WHAT IS AN OPERATING SYSTEM?")
                .detectedFrom("PDF_BOOKMARK")
                .sourceMaterialIds(List.of("M1"))
                .pageStart(3)
                .pageEnd(8)
                .chunkCount(9)
                .approxChars(4500L)
                .build();
        CourseMaterial material = new CourseMaterial();
        material.setId("M1");
        material.setTitle("Modern Operating Systems 4th Edition");
        material.setPdfFileId("pdf1");
        material.setContent("1.1 WHAT IS AN OPERATING SYSTEM?\n" + sectionBody + "\nChapter 2 Next");
        material.setIndexingStatus("INDEXED");

        when(outlineRepository.findByCourseIdAndChapterKey("OSG203", "what-is-an-operating-system"))
                .thenReturn(Optional.of(outline));
        when(materialRepository.findById("M1")).thenReturn(Optional.of(material));
        when(materialRepository.countByCourseIdAndIndexingStatus("OSG203", "INDEXED")).thenReturn(1L);

        ChapterPreviewView preview = service.previewChapter("OSG203", "what-is-an-operating-system", true);

        assertTrue(preview.getExcerpt().contains("Operating system section content."));
        assertFalse(preview.getExcerpt().contains("Chapter 2 Next"));
        verify(pdfStorageService, never()).loadByFileId(anyString());
    }

    @Test
    void ignoreChapterHidesOutlineFromSuggestedList() {
        CourseChapterOutline outline = CourseChapterOutline.builder()
                .id("O1")
                .courseId("PRJ301")
                .chapterKey("jspx-note")
                .title("A Note about JSP Documents (JSPX)")
                .status("SUGGESTED")
                .build();
        when(outlineRepository.findByCourseIdAndChapterKey("PRJ301", "jspx-note"))
                .thenReturn(Optional.of(outline));
        when(outlineRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(goldQaRepository.findByCourseIdOrderByCreatedAtDesc("PRJ301")).thenReturn(List.of());
        when(materialRepository.countByCourseIdAndIndexingStatus("PRJ301", "INDEXED")).thenReturn(1L);

        var hidden = service.ignoreChapter("PRJ301", "jspx-note");

        assertEquals("IGNORED", outline.getStatus());
        assertEquals("IGNORED", hidden.getStatus());
    }

    @Test
    void refreshOutlinesUsesPdfBookmarksWhenAvailable() {
        String filler = "Computer science fundamentals and architecture. ".repeat(120);
        CourseMaterial material = new CourseMaterial();
        material.setId("M1");
        material.setCourseId("CS101");
        material.setTitle("Foundations of Computer Science");
        material.setIndexingStatus("INDEXED");
        material.setPageCount(300);
        material.setContent(filler);
        material.setTableOfContents(List.of(
                MaterialTocEntry.builder().title("Chapter 1: Introduction").level(0).pageStart(10).pageEnd(39).build(),
                MaterialTocEntry.builder().title("1.1 Turing Model").level(1).pageStart(12).pageEnd(39).build(),
                MaterialTocEntry.builder().title("Chapter 2: Number Systems").level(0).pageStart(40).pageEnd(300).build()
        ));

        when(materialRepository.findByCourseId("CS101")).thenReturn(List.of(material));
        when(chunkingService.chunk(anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0);
            int parts = Math.max(1, text.length() / 500);
            return java.util.stream.IntStream.range(0, parts).mapToObj(i -> "chunk-" + i).toList();
        });
        when(outlineRepository.findByCourseIdAndChapterKey(eq("CS101"), anyString()))
                .thenReturn(Optional.empty());
        when(outlineRepository.findByCourseIdOrderByTitleAsc("CS101")).thenReturn(List.of());
        when(outlineRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshOutlinesForCourse("CS101");

        ArgumentCaptor<CourseChapterOutline> saved = ArgumentCaptor.forClass(CourseChapterOutline.class);
        verify(outlineRepository, times(3)).save(saved.capture());
        assertTrue(saved.getAllValues().stream().anyMatch(o ->
                "Chapter 1: Introduction".equals(o.getTitle())
                        && "PDF_BOOKMARK".equals(o.getDetectedFrom())
                        && o.getPageStart() == 10));
        assertTrue(saved.getAllValues().stream().anyMatch(o ->
                "1.1 Turing Model".equals(o.getTitle()) && o.getTocLevel() == 1));
    }

    @Test
    void refreshOutlinesFallsBackToMaterialTitleWithoutBookmarks() {
        String filler = "Servlet is a Java web component with request and response lifecycle. ".repeat(80);
        CourseMaterial material = new CourseMaterial();
        material.setId("M1");
        material.setCourseId("PRJ301");
        material.setTitle("Web Programming");
        material.setIndexingStatus("INDEXED");
        material.setContent(filler);
        when(materialRepository.findByCourseId("PRJ301")).thenReturn(List.of(material));
        when(chunkingService.chunk(anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0);
            int parts = Math.max(1, text.length() / 500);
            return java.util.stream.IntStream.range(0, parts).mapToObj(i -> "chunk-" + i).toList();
        });
        when(outlineRepository.findByCourseIdAndChapterKey(eq("PRJ301"), anyString()))
                .thenReturn(Optional.empty());
        when(outlineRepository.findByCourseIdOrderByTitleAsc("PRJ301")).thenReturn(List.of());
        when(outlineRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshOutlinesForCourse("PRJ301");

        ArgumentCaptor<CourseChapterOutline> saved = ArgumentCaptor.forClass(CourseChapterOutline.class);
        verify(outlineRepository, times(1)).save(saved.capture());
        CourseChapterOutline outline = saved.getValue();
        assertEquals("Web Programming", outline.getTitle());
        assertEquals("MATERIAL_TITLE", outline.getDetectedFrom());
    }

    @Test
    void extractSectionByTitleReturnsSectionBody() {
        String content = """
                Chapter 1: Introduction
                Intro text here.

                1.1 Turing Model
                Turing details here.

                Chapter 2: Number Systems
                Numbers here.
                """;
        String section = ChapterOutlineService.extractSectionByTitle(content, "1.1 Turing Model");
        assertTrue(section.contains("Turing details"));
        assertFalse(section.contains("Chapter 2"));
    }

    @Test
    void confirmChaptersMarksSelectedAsConfirmed() {
        CourseChapterOutline a = CourseChapterOutline.builder()
                .id("O1").courseId("PRJ301").chapterKey("jsp").title("JSP").status("SUGGESTED").build();
        CourseChapterOutline b = CourseChapterOutline.builder()
                .id("O2").courseId("PRJ301").chapterKey("servlet").title("Servlet").status("CONFIRMED").build();
        when(materialRepository.findByCourseId("PRJ301")).thenReturn(List.of());
        when(outlineRepository.findByCourseIdOrderByTitleAsc("PRJ301")).thenReturn(List.of(a, b));
        when(outlineRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(outlineRepository.findByCourseIdAndStatusOrderByTitleAsc("PRJ301", "CONFIRMED"))
                .thenReturn(List.of(a));
        when(goldQaRepository.findByCourseIdOrderByCreatedAtDesc("PRJ301")).thenReturn(List.of());
        when(materialRepository.countByCourseIdAndIndexingStatus("PRJ301", "INDEXED")).thenReturn(0L);

        ConfirmChaptersRequest request = new ConfirmChaptersRequest();
        request.setCourseId("PRJ301");
        request.setChapterKeys(List.of("jsp"));
        request.setConfirmedBy("S1");

        var confirmed = service.confirmChapters(request);

        assertEquals(1, confirmed.size());
        assertEquals("CONFIRMED", a.getStatus());
        assertEquals("SUGGESTED", b.getStatus());
    }

    @Test
    void refreshOutlinesIgnoresLegacyHeadingOutlines() {
        String filler = "Processes, threads, scheduling and synchronization in operating systems. ".repeat(40);
        CourseMaterial material = new CourseMaterial();
        material.setId("M-OSG");
        material.setCourseId("OSG203");
        material.setTitle("Modern Operating Systems 4th Edition");
        material.setIndexingStatus("INDEXED");
        material.setContent(filler);
        CourseChapterOutline legacyHeading = CourseChapterOutline.builder()
                .id("OLD1")
                .courseId("OSG203")
                .chapterKey("process-management")
                .title("Process Management")
                .status("SUGGESTED")
                .detectedFrom("HEADING")
                .build();
        when(materialRepository.findByCourseId("OSG203")).thenReturn(List.of(material));
        when(chunkingService.chunk(anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0);
            int parts = Math.max(1, text.length() / 500);
            return java.util.stream.IntStream.range(0, parts).mapToObj(i -> "chunk-" + i).toList();
        });
        when(outlineRepository.findByCourseIdAndChapterKey(eq("OSG203"), anyString()))
                .thenReturn(Optional.empty());
        when(outlineRepository.findByCourseIdOrderByTitleAsc("OSG203")).thenReturn(List.of(legacyHeading));
        when(outlineRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshOutlinesForCourse("OSG203");

        assertEquals("IGNORED", legacyHeading.getStatus());
    }

    @Test
    void refreshOutlinesSplitsHtmlWebsiteSectionsIntoChapters() {
        String content = """
                Source URL: https://docs.example.com/pro/intro
                Page title: Introduction to PRO

                PRO intro body with enough text for indexing and training coverage.

                ---

                Source URL: https://docs.example.com/pro/ch1.html#sec-1.2
                Page title: Chapter 1. Introduction

                Loops and arrays body with enough text for indexing and training coverage.
                """;
        CourseMaterial material = new CourseMaterial();
        material.setId("M-HTML");
        material.setCourseId("PRO192");
        material.setTitle("PRF192");
        material.setSourceType("HTML_URL");
        material.setIndexingStatus("INDEXED");
        material.setImportedPageCount(2);
        material.setContent(content);

        when(materialRepository.findByCourseId("PRO192")).thenReturn(List.of(material));
        when(chunkingService.chunk(anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0);
            int parts = Math.max(1, text.length() / 40);
            return java.util.stream.IntStream.range(0, parts).mapToObj(i -> "chunk-" + i).toList();
        });
        when(outlineRepository.findByCourseIdAndChapterKey(eq("PRO192"), anyString()))
                .thenReturn(Optional.empty());
        when(outlineRepository.findByCourseIdOrderByTitleAsc("PRO192")).thenReturn(List.of());
        when(outlineRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.refreshOutlinesForCourse("PRO192");

        ArgumentCaptor<CourseChapterOutline> saved = ArgumentCaptor.forClass(CourseChapterOutline.class);
        verify(outlineRepository, atLeast(2)).save(saved.capture());
        assertTrue(saved.getAllValues().stream().anyMatch(o ->
                "Introduction to PRO".equals(o.getTitle())
                        && "HTML_SECTION".equals(o.getDetectedFrom())
                        && o.getChunkCount() > 0
                        && o.getPageStart() == null));
        assertTrue(saved.getAllValues().stream().anyMatch(o ->
                o.getTitle().startsWith("1.2")
                        && o.getTitle().contains("Chapter 1. Introduction")
                        && "HTML_SECTION".equals(o.getDetectedFrom())));
    }

    @Test
    void resolveHtmlSectionTitleUsesUrlFragmentWhenPageTitleRepeats() {
        assertEquals(
                "1.2 · Chapter 1. Introduction",
                ChapterOutlineService.resolveHtmlSectionTitle(
                        "Chapter 1. Introduction",
                        "https://docs.example.com/ch1.html#jvms-1.2",
                        1
                )
        );
        assertEquals(
                "Preface to the Java SE 8 Edition",
                ChapterOutlineService.resolveHtmlSectionTitle(
                        "Preface to the Java SE 8 Edition",
                        "https://docs.example.com/preface.html",
                        1
                )
        );
    }

    @Test
    void extractHtmlSectionByTitleReturnsSelectedWebsitePage() {
        String content = """
                Source URL: https://docs.example.com/a
                Page title: Alpha Topic

                Alpha body.

                ---

                Source URL: https://docs.example.com/b
                Page title: Beta Topic

                Beta body.
                """;
        String section = ChapterOutlineService.extractHtmlSectionByTitle(content, "Beta Topic");
        assertTrue(section.contains("Beta body."));
        assertFalse(section.contains("Alpha body."));
    }

    @Test
    void suggestChaptersReadsPersistedOutlinesWithoutRebuilding() {
        CourseChapterOutline outline = CourseChapterOutline.builder()
                .id("O1")
                .courseId("PRJ301")
                .chapterKey("jsp")
                .title("JSP")
                .status("SUGGESTED")
                .chunkCount(4)
                .approxChars(2000L)
                .build();
        when(outlineRepository.findByCourseIdOrderByTitleAsc("PRJ301")).thenReturn(List.of(outline));
        when(goldQaRepository.findByCourseIdOrderByCreatedAtDesc("PRJ301")).thenReturn(List.of());
        when(materialRepository.countByCourseIdAndIndexingStatus("PRJ301", "INDEXED")).thenReturn(1L);

        var chapters = service.suggestChapters("PRJ301");

        assertEquals(1, chapters.size());
        assertEquals("JSP", chapters.get(0).getTitle());
        verify(chunkingService, never()).chunk(anyString());
        verify(outlineRepository, never()).save(any());
    }
}
