package com.ragapi.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TutorStudySuggestionUtilsTest {

    @Test
    void skipsBookFrontMatterAndPrefersNumberedChapters() {
        List<String> picked = TutorStudySuggestionUtils.pickChapterSuggestions(List.of(
                new TutorStudySuggestionUtils.RankedTitle("About the Author", 1, 1),
                new TutorStudySuggestionUtils.RankedTitle("About the Technical Editors", 2, 1),
                new TutorStudySuggestionUtils.RankedTitle("A Timeline of Java Platforms", 3, 1),
                new TutorStudySuggestionUtils.RankedTitle("A Note about JSP Documents (JSPX)", 40, 2),
                new TutorStudySuggestionUtils.RankedTitle("Chapter 1 Servlet Basics", 12, 1),
                new TutorStudySuggestionUtils.RankedTitle("Chapter 2 JSP Overview", 28, 1)
        ), 4);

        assertEquals(List.of(
                "Chapter 1 Servlet Basics",
                "Chapter 2 JSP Overview"
        ), picked);
        assertFalse(picked.stream().anyMatch(title -> title.toLowerCase().contains("author")));
    }

    @Test
    void prefersChapterUnitsOverDefinitionSentences() {
        List<String> picked = TutorStudySuggestionUtils.pickChapterSuggestions(List.of(
                new TutorStudySuggestionUtils.RankedTitle("A string is a sequence", 80, 2),
                new TutorStudySuggestionUtils.RankedTitle("Adding new functions", 40, 2),
                new TutorStudySuggestionUtils.RankedTitle("Chapter 3 Functions", 30, 1),
                new TutorStudySuggestionUtils.RankedTitle("Chapter 5 Conditionals", 50, 1),
                new TutorStudySuggestionUtils.RankedTitle("Alternative execution", 55, 2)
        ), 4);

        assertEquals(List.of("Chapter 3 Functions", "Chapter 5 Conditionals"), picked);
        assertFalse(picked.contains("A string is a sequence"));
    }

    @Test
    void newCourseFallsBackToAStartableCourseUnit() {
        List<String> suggestions = TutorStudySuggestionUtils.openingSuggestions(
                "PFP191",
                List.of(),
                List.of(
                        new TutorStudySuggestionUtils.RankedTitle("About the Author", 1, 1),
                        new TutorStudySuggestionUtils.RankedTitle("Mục lục", 2, 1)
                ));
        assertEquals(TutorStudySuggestionUtils.courseStarters("PFP191"), suggestions);
    }

    @Test
    void openingUsesStudyUnitsNotOverviewQuestions() {
        List<String> suggestions = TutorStudySuggestionUtils.openingSuggestions(
                "PRJ301",
                List.of(),
                List.of(new TutorStudySuggestionUtils.RankedTitle("Chapter 1 Servlet Basics", 12, 1)));
        assertEquals(List.of("Chapter 1 Servlet Basics"), suggestions);
        assertFalse(suggestions.get(0).toLowerCase().contains("gồm những nội dung"));
    }

    @Test
    void refreshesFrontMatterChipsButKeepsLessonPath() {
        assertTrue(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of(
                "About the Author", "A Timeline of Java Platforms")));
        assertFalse(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of(
                "Bài 1: Servlet", "Bài 2: Filter")));
        assertTrue(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of()));
        assertTrue(TutorStudySuggestionUtils.needsSuggestionRefresh(
                TutorStudySuggestionUtils.NEW_COURSE_STARTERS));
        assertTrue(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of(
                "A string is a sequence", "Adding new functions")));
        assertTrue(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of(
                "Môn PFP191 gồm những nội dung nào?")));
        assertTrue(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of(
                "Adding new functions", "Boolean expressions")));
        assertFalse(TutorStudySuggestionUtils.needsSuggestionRefresh(List.of(
                "Nền tảng cú pháp", "Cấu trúc điều khiển")));
    }
}
