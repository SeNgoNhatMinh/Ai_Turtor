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

    @Test
    void exampleFollowUpFocusRanksServletSpecAheadOfJspxExamplePage() {
        SearchChunk jspx = chunk(
                "JSP Document (JSPX) example table comparing <%@ page %> with <jsp:directive.page />.",
                0.96,
                "jspx"
        );
        SearchChunk spec = chunk(
                "Servlet Specification is part of the Java EE specification and defines servlet lifecycle.",
                0.61,
                "spec"
        );
        String focus = "Servlet Specification giúp mình hiểu khái niệm của phần này với? có ví dụ ko?";

        List<SearchChunk> ranked = TextbookChunkAlignment.rank(focus, List.of(jspx, spec));

        assertThat(ranked.get(0).materialId()).isEqualTo("spec");
    }

    @Test
    void exactLifecycleMethodsBeatSubstringMatchesFromSpringConfiguration() {
        SearchChunk spring = chunk(
                "InitializingBean and PreDestroy offer lifecycle control. A Servlet init parameter configures services.",
                0.96,
                "spring"
        );
        SearchChunk servlet = chunk(
                "The container calls init() once, service() for requests, and destroy() before removing the Servlet.",
                0.62,
                "servlet"
        );

        List<SearchChunk> ranked = TextbookChunkAlignment.rank(
                "Explain the Servlet lifecycle, especially init, service, and destroy, using only course material.",
                List.of(spring, servlet)
        );

        assertThat(ranked.get(0).materialId()).isEqualTo("servlet");
    }

    @Test
    void optionalSourceRequiresMultipleDistinctiveTopicTerms() {
        String question = "Explain servlet lifecycle init service destroy";
        SearchChunk unrelatedJspx = chunk(
                "JSPX is an XML document used by a Java web application.", 0.99, "jspx-note");
        SearchChunk lifecycleNote = chunk(
                "A servlet lifecycle calls init, service, and destroy.", 0.70, "servlet-note");

        assertThat(TextbookChunkAlignment.hasDistinctiveOverlap(question, unrelatedJspx, 2)).isFalse();
        assertThat(TextbookChunkAlignment.hasDistinctiveOverlap(question, lifecycleNote, 2)).isTrue();
    }

    @Test
    void diversifyByCoveragePromotesMissingLifecycleMethodSection() {
        SearchChunk initDestroy = chunk(
                "Servlet init() prepares resources and destroy() releases resources.", 0.91, "init-destroy");
        SearchChunk config = chunk(
                "Servlet deployment descriptors and init-param configuration.", 0.89, "config");
        SearchChunk service = chunk(
                "The Servlet service() method services incoming requests before doGet or doPost handles HTTP.",
                0.60,
                "service"
        );

        List<SearchChunk> diversified = TextbookChunkAlignment.diversifyByCoverage(
                "When loaded, explain Servlet init service destroy order.",
                List.of(initDestroy, config, service),
                3
        );

        assertThat(diversified.subList(0, 2))
                .extracting(SearchChunk::materialId)
                .contains("init-destroy", "service");
    }

    @Test
    void bm25ScaleDoesNotLetNavigationBeatLifecycleEvidence() {
        SearchChunk contents = new SearchChunk(
                "Contents Chapter 3 Writing Your First Servlet Creating a Servlet Class Using init and destroy service method 41 42 43",
                22.0,
                "contents",
                "PRJ301",
                null,
                "t1",
                "COURSE_SHARED",
                "PDF",
                "doc",
                "chapter-contents",
                "Contents",
                "contents-section",
                "Contents",
                "chunk-contents",
                1,
                "SECTION"
        );
        SearchChunk lifecycle = chunk(
                "The container calls init() once, then service() handles each request, and destroy() releases resources.",
                0.62,
                "lifecycle"
        );

        List<SearchChunk> ranked = TextbookChunkAlignment.merge(
                "Explain Servlet init service destroy order.",
                List.of(contents, lifecycle)
        );

        assertThat(ranked).extracting(SearchChunk::materialId).containsExactly("lifecycle");
    }

    private SearchChunk chunk(String content, double score, String materialId) {
        return new SearchChunk(content, score, materialId, "PRJ301", null, "t1", "COURSE_SHARED", "PDF");
    }
}
