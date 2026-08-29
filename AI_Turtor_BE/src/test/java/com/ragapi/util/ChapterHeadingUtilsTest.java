package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChapterHeadingUtilsTest {

    @Test
    void acceptsRealChapterTitles() {
        assertTrue(ChapterHeadingUtils.isPlausibleChapterTitle("Chapter 1 Servlet Basics"));
        assertTrue(ChapterHeadingUtils.isPlausibleChapterTitle("1 Process Management"));
        assertTrue(ChapterHeadingUtils.isPlausibleChapterTitle("2.3 Memory Allocation"));
    }

    @Test
    void rejectsPdfNoiseHeadings() {
        assertFalse(ChapterHeadingUtils.isPlausibleChapterTitle("0 1 0 2 0 0 0 0 1 1 0 0 0"));
        assertFalse(ChapterHeadingUtils.isPlausibleChapterTitle("0 1 0 2 0 0 1"));
        assertFalse(ChapterHeadingUtils.isPlausibleChapterTitle("0 1 2"));
        assertFalse(ChapterHeadingUtils.isPlausibleChapterTitle("0 1 2 1 3 0"));
        assertFalse(ChapterHeadingUtils.isPlausibleChapterTitle("0 2 Read only 1 0 1"));
        assertFalse(ChapterHeadingUtils.isPlausibleChapterTitle("11 Free blocks 0 0 1 0 1 0 0 0 0 1 1 0 0 0 11 Free blocks"));
    }

    @Test
    void studySuggestionsSkipPublisherFrontMatter() {
        assertTrue(ChapterHeadingUtils.isBookFrontMatterTitle("About the Author"));
        assertTrue(ChapterHeadingUtils.isBookFrontMatterTitle("About the Technical Editors"));
        assertTrue(ChapterHeadingUtils.isBookFrontMatterTitle("A Timeline of Java Platforms"));
        assertTrue(ChapterHeadingUtils.isBookFrontMatterTitle("Mục lục"));
        assertFalse(ChapterHeadingUtils.isBookFrontMatterTitle("A Note about JSP Documents (JSPX)"));
        assertTrue(ChapterHeadingUtils.isStudySuggestionTitle("A Note about JSP Documents (JSPX)"));
        assertFalse(ChapterHeadingUtils.isStudySuggestionTitle("About the Author"));
        assertTrue(ChapterHeadingUtils.isSentenceLikeHeading("A string is a sequence"));
        assertFalse(ChapterHeadingUtils.isStudyUnitTitle("A string is a sequence"));
        assertTrue(ChapterHeadingUtils.isStudyUnitTitle("Alternative execution"));
        assertTrue(ChapterHeadingUtils.isStudyUnitTitle("Chapter 1 Servlet Basics"));
    }
}
