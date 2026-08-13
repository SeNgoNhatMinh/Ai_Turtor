package com.ragapi.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class CourseMaterialHtmlImportServiceTest {

    @Test
    void acceptsAllSelectedTableOfContentsItemsWithoutFixedLimit() {
        CourseMaterialHtmlImportService service = new CourseMaterialHtmlImportService(null);
        List<String> selectedUrls = new ArrayList<>();
        for (int index = 1; index <= 169; index++) {
            selectedUrls.add("https://docs.example.com/chapter.html#section-" + index);
        }

        List<URI> resolved = service.resolveSelectedUris(
                selectedUrls,
                URI.create("https://docs.example.com/index.html")
        );

        assertEquals(169, resolved.size());
    }

    @Test
    void stillDeduplicatesRepeatedSelectedUrls() {
        CourseMaterialHtmlImportService service = new CourseMaterialHtmlImportService(null);

        List<URI> resolved = service.resolveSelectedUris(
                List.of(
                        "https://docs.example.com/chapter.html#section-1",
                        "https://docs.example.com/chapter.html#section-1"
                ),
                URI.create("https://docs.example.com/index.html")
        );

        assertEquals(1, resolved.size());
    }

    @Test
    void discoversExtensionlessDocusaurusDocumentationPages() {
        CourseMaterialHtmlImportService service = new CourseMaterialHtmlImportService(null);
        String html = """
                <html><body>
                  <nav><a href='/login'>Login</a></nav>
                  <main><article><div class='theme-doc-markdown'>
                    <h1>Table of contents</h1>
                    <h2>Introduction</h2>
                    <ul>
                      <li><a href='/A-Introduction/computers'>Computers</a></li>
                      <li><a href='/A-Introduction/information'>Information</a></li>
                      <li><a href='/A-Introduction/compilers.html'>Compilers</a></li>
                    </ul>
                    <a href='/Introduction-to-C.pdf' download>Download Notes</a>
                    <a href='/assets/js/main.js'>Runtime</a>
                  </div></article></main>
                </body></html>
                """;
        URI sourceUri = URI.create("https://intro2c.sdds.ca/");
        Document document = Jsoup.parse(html, sourceUri.toString());

        List<CourseMaterialHtmlImportService.TableOfContentsItem> items =
                service.discoverTableOfContents(document, sourceUri);

        assertEquals(3, items.size());
        assertEquals("https://intro2c.sdds.ca/A-Introduction/computers", items.get(0).url());
        assertEquals("https://intro2c.sdds.ca/A-Introduction/compilers.html", items.get(2).url());
        assertFalse(items.stream().anyMatch(item -> item.url().endsWith(".pdf") || item.url().endsWith(".js")));
    }
}
