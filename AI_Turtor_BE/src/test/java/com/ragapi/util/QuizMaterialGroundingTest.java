package com.ragapi.util;

import com.ragapi.util.QuizMaterialGrounding.QuizPassage;
import com.ragapi.util.QuizMaterialGrounding.SourceChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QuizMaterialGroundingTest {

    private static final String JDBC_BODY = """
            JDBC is a standard API for connecting Java applications to a relational database using drivers.
            A connection is opened before a statement can run.
            """;

    @Test
    void retrievalQueryUsesTheStudentWordsOnce() {
        assertEquals("JDBC", QuizMaterialGrounding.retrievalQuery("JDBC", "JDBC"));
        assertEquals("JDBC", QuizMaterialGrounding.retrievalQuery(" JDBC ", null));
        assertEquals(
                "Servlet trọng tâm JSP",
                QuizMaterialGrounding.retrievalQuery("Servlet", "trọng tâm JSP")
        );
        assertFalse(QuizMaterialGrounding.retrievalQuery("JDBC", null).contains("Kien thuc"));
    }

    @Test
    void keepsOnlyThePassageThatContainsTheStudentsTerm() {
        List<QuizPassage> passages = QuizMaterialGrounding.toPassages("JDBC", List.of(
                new SourceChunk(JDBC_BODY, "jdbc-material", "What Is Data Persistence?", 0.4),
                new SourceChunk(
                        "JavaServer Pages render HTML from a servlet container.",
                        "jsp-material",
                        "JavaServer Pages",
                        0.9
                )
        ));

        assertEquals(1, passages.size());
        assertEquals("P1", passages.get(0).id());
        assertEquals("jdbc-material", passages.get(0).materialId());
        assertTrue(passages.get(0).text().contains("relational database"));
    }

    @Test
    void vietnameseTopicDoesNotSelectAnUnrelatedEnglishChapter() {
        assertFalse(QuizMaterialGrounding.chunkMatchesTopic(
                "kết nối cơ sở dữ liệu",
                "JavaServer Pages",
                "JavaServer Pages render HTML from a servlet container."
        ));
        assertTrue(QuizMaterialGrounding.chunkMatchesTopic(
                "kế thừa",
                "Chương 2",
                "Lớp con kế thừa thuộc tính của lớp cha."
        ));
    }

    @Test
    void javaDoesNotMatchJavascript() {
        assertFalse(QuizMaterialGrounding.chunkMatchesTopic(
                "Java",
                "Scripts",
                "A javascript function validates the form before submit."
        ));
        assertTrue(QuizMaterialGrounding.chunkMatchesTopic(
                "Java",
                "Overview",
                "A Java application starts in a class with a main method."
        ));
    }

    @Test
    void verbatimQuoteIsAcceptedAndAParaphraseIsRejected() {
        assertTrue(QuizMaterialGrounding.quoteMatches(
                "JDBC is a standard API for connecting Java applications to a relational database",
                JDBC_BODY
        ));
        assertFalse(QuizMaterialGrounding.quoteMatches(
                "Spring Security authenticates users before they access a protected resource",
                JDBC_BODY
        ));
        assertFalse(QuizMaterialGrounding.quoteMatches("JDBC connects applications", JDBC_BODY));
    }

    @Test
    void quoteSelectsThePassageThatActuallyContainsIt() {
        List<QuizPassage> passages = List.of(
                new QuizPassage("P1", "jsp", "JavaServer Pages", "JavaServer Pages render HTML from a servlet container."),
                new QuizPassage("P2", "jdbc", "Persistence", JDBC_BODY)
        );

        QuizPassage support = QuizMaterialGrounding.supportingPassage(
                "JDBC is a standard API for connecting Java applications to a relational database",
                "P1",
                passages
        );

        assertEquals("P2", support.id());
        assertEquals("jdbc", support.materialId());
    }

    @Test
    void letterAndTrueFalseAnswersMapOntoTheVisibleOption() {
        List<String> choices = List.of("Kết nối cơ sở dữ liệu", "Vẽ giao diện", "Biên dịch mã");
        assertEquals("Kết nối cơ sở dữ liệu", QuizMaterialGrounding.matchOption("A", choices));
        assertEquals("Vẽ giao diện", QuizMaterialGrounding.matchOption("Đáp án B", choices));
        assertEquals("Kết nối cơ sở dữ liệu", QuizMaterialGrounding.matchOption("A. Kết nối cơ sở dữ liệu", choices));
        assertNull(QuizMaterialGrounding.matchOption("E", choices));

        List<String> trueFalse = List.of("Đúng", "Sai");
        assertEquals("Đúng", QuizMaterialGrounding.matchOption("True", trueFalse));
        assertEquals("Sai", QuizMaterialGrounding.matchOption("false", trueFalse));
    }
}
