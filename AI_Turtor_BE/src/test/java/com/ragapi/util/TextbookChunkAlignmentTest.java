package com.ragapi.util;

import com.ragapi.service.ElasticVectorService.SearchChunk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TextbookChunkAlignmentTest {

    @Test
    void ranksJspDefinitionAheadOfTagHandlerPage() {
        SearchChunk tagHandler = chunk(
                "Creating a More Useful Date Formatting Tag Handler for JSP custom tags.",
                0.92,
                "tag"
        );
        SearchChunk intro = chunk(
                "JSP (JavaServer Pages) is a technology that lets you mix HTML with Java.",
                0.61,
                "intro"
        );

        List<SearchChunk> ranked = TextbookChunkAlignment.rank("jsp là gì ?", List.of(tagHandler, intro));

        assertThat(ranked.get(0).materialId()).isEqualTo("intro");
    }

    @Test
    void ranksJspxDefinitionAheadOfGenericJspLifecycleContent() {
        SearchChunk lifecycle = chunk(
                "A JSP page is translated into a servlet class and processed by the web container.",
                0.94,
                "lifecycle"
        );
        SearchChunk jspx = chunk(
                "JSP Documents, which end in the .jspx extension, are XML documents that support the same features as standard JSPs using XML syntax.",
                0.62,
                "jspx"
        );

        List<SearchChunk> ranked = TextbookChunkAlignment.rank(
                "JSP Documents (JSPX) là gì?",
                List.of(lifecycle, jspx)
        );

        assertThat(ranked.get(0).materialId()).isEqualTo("jspx");
    }

    @Test
    void definitionCoverageRequiresTheQuestionTerm() {
        SearchChunk unrelated = chunk("Loops and arrays in Java programming.", 0.88, "loops");
        assertThat(TextbookChunkAlignment.topChunksCoverQuestion("jsp là gì", List.of(unrelated), 3)).isFalse();
        SearchChunk jsp = chunk("A JSP page is compiled into a servlet.", 0.4, "jsp");
        assertThat(TextbookChunkAlignment.topChunksCoverQuestion("jsp là gì", List.of(jsp), 3)).isTrue();
    }

    @Test
    void tagHandlerPageDoesNotCountAsDefinitionCoverage() {
        SearchChunk tagHandler = chunk(
                "Creating a More Useful Date Formatting Tag Handler for JSP custom tags.",
                0.92,
                "tag"
        );
        assertThat(TextbookChunkAlignment.topChunksCoverQuestion("jsp là gì", List.of(tagHandler), 3)).isFalse();
    }

    @Test
    void ranksServletDefinitionAheadOfFormSubmissionPage() {
        SearchChunk formPage = chunk(
                "Using Parameters and Accepting Form Submissions. The servlet reads request parameters from an HTML form.",
                0.94,
                "form"
        );
        SearchChunk intro = chunk(
                "A servlet is a Java EE component. Servlets typically extend HttpServlet and implement init, service and destroy.",
                0.57,
                "intro"
        );

        List<SearchChunk> ranked = TextbookChunkAlignment.rank("Servlet là gì ?", List.of(formPage, intro));

        assertThat(ranked.get(0).materialId()).isEqualTo("intro");
    }

    @Test
    void formSubmissionPageDoesNotCountAsServletDefinitionCoverage() {
        SearchChunk formPage = chunk(
                "Using Parameters and Accepting Form Submissions. The servlet reads request parameters from an HTML form.",
                0.94,
                "form"
        );
        assertThat(TextbookChunkAlignment.topChunksCoverQuestion("Servlet là gì", List.of(formPage), 3)).isFalse();
    }

    @Test
    void jspCompilationAsideDoesNotCountAsServletDefinitionCoverage() {
        SearchChunk jspCompile = chunk(
                "When a JSP file is compiled, the compiler creates a Java class that implements Servlet.",
                0.88,
                "jsp-compile"
        );
        assertThat(TextbookChunkAlignment.topChunksCoverQuestion("Servlet là gì", List.of(jspCompile), 3)).isFalse();
    }

    private SearchChunk chunk(String content, double score, String materialId) {
        return new SearchChunk(content, score, materialId, "PRJ301", null, "t1", "COURSE_SHARED", "PDF");
    }
}
