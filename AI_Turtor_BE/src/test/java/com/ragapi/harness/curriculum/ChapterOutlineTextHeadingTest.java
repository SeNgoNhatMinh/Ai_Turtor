package com.ragapi.harness.curriculum;

import com.ragapi.harness.util.ChapterHeadingUtils;
import com.ragapi.harness.util.StudyLessonTitles;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** PDFs without bookmarks (e.g. PRF192 course notes) still yield chapters from their text. */
class ChapterOutlineTextHeadingTest {

    private static final String CONTENT = String.join("\n",
            "Foundations of Programming Using C",
            " Table of Contents",
            " 1. Introduction....................................3",
            " 2. Basic Computations..............................9",
            " Chapter 1. Introduction",
            "What is programming?",
            "Chapter 1 - Introduction Page 3",
            "Computer architecture text.",
            " Chapter 2. Basic Computations",
            "A first C program.",
            "Chapter 2 - Basic Computations Page 9",
            "Variables and printf.",
            "Chapter 1 - Introduction Page 4",
            " Chapter 3. Basic Logic",
            "if and while.");

    @Test
    void detectsOneHeadingPerChapterInDocumentOrder() {
        List<ChapterOutlineReader.TextHeading> headings = ChapterOutlineReader.textChapterHeadings(CONTENT);

        assertEquals(List.of("Chapter 1. Introduction", "Chapter 2. Basic Computations", "Chapter 3. Basic Logic"),
                headings.stream().map(ChapterOutlineReader.TextHeading::title).toList());
    }

    @Test
    void runningHeaderWithPageLabelIsNormalized() {
        List<ChapterOutlineReader.TextHeading> headings =
                ChapterOutlineReader.textChapterHeadings("Chapter 4 - Modularity Page 41\nbody\nChapter 5 - Arrays Page 50\n");

        assertEquals(List.of("Chapter 4. Modularity", "Chapter 5. Arrays"),
                headings.stream().map(ChapterOutlineReader.TextHeading::title).toList());
    }

    @Test
    void sectionRunsUntilNextChapterHeading() {
        String section = ChapterOutlineReader.extractTextHeadingSection(CONTENT, "Chapter 2. Basic Computations");

        assertTrue(section.startsWith("Chapter 2. Basic Computations"));
        assertTrue(section.contains("Variables and printf."));
        assertFalse(section.contains("if and while."));
    }

    @Test
    void detectedTitlesSurviveWelcomeStudyFilters() {
        List<String> titles = ChapterOutlineReader.textChapterHeadings(CONTENT).stream()
                .map(ChapterOutlineReader.TextHeading::title)
                .filter(ChapterHeadingUtils::isStudyUnitTitle)
                .toList();

        assertEquals(3, StudyLessonTitles.welcomeLines(titles).size());
    }

    @Test
    void proseWithoutChapterHeadingsYieldsNothing() {
        assertTrue(ChapterOutlineReader.textChapterHeadings("Just text.\nNo chapters here.").isEmpty());
    }
}
