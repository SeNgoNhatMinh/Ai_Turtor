package com.ragapi.service;

import com.ragapi.dto.ImportCourseMaterialUrlRequest;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CourseMaterialHtmlImportService {

    private static final int DEFAULT_MAX_PAGES = 1;
    private static final int CONNECT_TIMEOUT_MS = (int) Duration.ofSeconds(20).toMillis();
    private static final Pattern TOC_NUMBER_PATTERN = Pattern.compile("^(\\d+(?:\\.\\d+)*)\\.?.*");

    private final CourseMaterialIngestionService ingestionService;

    public TableOfContentsResult previewTableOfContents(String rawUrl) throws IOException {
        URI sourceUri = validateHttpUrl(rawUrl);
        Document doc = fetchDocument(sourceUri);
        String title = firstNonBlank(textOf(doc.selectFirst("h1")), doc.title(), sourceUri.toString());

        return new TableOfContentsResult(title, sourceUri.toString(), discoverTableOfContents(doc, sourceUri));
    }

    List<TableOfContentsItem> discoverTableOfContents(Document doc, URI sourceUri) {
        Element linkScope = firstNonNull(
                doc.selectFirst(".theme-doc-markdown"),
                doc.selectFirst("main article"),
                doc.selectFirst("article"),
                doc.selectFirst("main"),
                doc.body()
        );

        List<TableOfContentsItem> items = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        if (linkScope == null) {
            return items;
        }
        for (Element link : linkScope.select("a[href]")) {
            String label = normalizeLabel(link.text());
            if (!hasReadableTocLabel(label)) {
                continue;
            }
            String href = link.attr("abs:href");
            if (href == null || href.isBlank()) {
                continue;
            }
            try {
                URI itemUri = new URI(href);
                if (!isSameHost(itemUri, sourceUri.getHost())) {
                    continue;
                }
                if (!looksLikeTocItem(label) && !looksLikeDocumentationPage(link, itemUri, sourceUri)) {
                    continue;
                }
                String normalizedUrl = itemUri.toString();
                if (!seen.add(normalizedUrl)) {
                    continue;
                }
                items.add(new TableOfContentsItem(
                        label,
                        normalizedUrl,
                        tocLevel(label),
                        itemUri.getFragment()
                ));
            } catch (URISyntaxException ignored) {
                // Skip invalid links from external docs.
            }
        }
        return items;
    }

    public ImportResult importHtml(
            ImportCourseMaterialUrlRequest request,
            String courseId,
            String classId,
            String uploaderId,
            String materialScope,
            String uploaderRole
    ) throws IOException {
        URI startUri = validateHttpUrl(request.getUrl());
        List<URI> selectedUris = resolveSelectedUris(request.getSelectedUrls(), startUri);
        int maxPages = selectedUris.isEmpty()
                ? resolveMaxPages(request.getFollowNext(), request.getMaxPages())
                : selectedUris.size();

        List<String> importedUrls = new ArrayList<>();
        Set<String> visited = new LinkedHashSet<>();
        StringBuilder mergedContent = new StringBuilder();
        String resolvedTitle = request.getTitle();
        String sourceSection = startUri.getFragment();

        if (!selectedUris.isEmpty()) {
            Map<String, Document> documentCache = new HashMap<>();
            for (URI selectedUri : selectedUris) {
                appendImportedPage(selectedUri, mergedContent, importedUrls, documentCache);
                if (sourceSection == null || sourceSection.isBlank()) {
                    sourceSection = selectedUri.getFragment();
                }
            }
            if (resolvedTitle == null || resolvedTitle.isBlank()) {
                resolvedTitle = "Selected HTML documentation sections";
            }
        } else {
            URI current = startUri;
            while (current != null && importedUrls.size() < maxPages && visited.add(current.toString())) {
                ParsedHtmlPage page = fetchAndExtract(current);
                if (resolvedTitle == null || resolvedTitle.isBlank()) {
                    resolvedTitle = page.title();
                }
                appendPageText(current, page, mergedContent, importedUrls);

                current = Boolean.TRUE.equals(request.getFollowNext())
                        ? resolveNextUrl(current, page.document(), startUri.getHost())
                        : null;
            }
        }

        if (mergedContent.toString().isBlank()) {
            throw new IllegalArgumentException("HTML URL does not contain readable course material content");
        }

        String safeTitle = resolvedTitle == null || resolvedTitle.isBlank() ? startUri.toString() : resolvedTitle;
        var material = ingestionService.ingestExtractedMaterialAsync(
                safeTitle,
                "course-material",
                courseId,
                classId,
                uploaderId,
                materialScope,
                uploaderRole,
                mergedContent.toString(),
                "HTML_URL",
                startUri.toString(),
                startUri.getHost(),
                sourceSection,
                importedUrls.size()
        );

        return new ImportResult(material.getId(), material.getTitle(), importedUrls, material.getIndexingStatus());
    }

    List<URI> resolveSelectedUris(List<String> selectedUrls, URI startUri) {
        if (selectedUrls == null || selectedUrls.isEmpty()) {
            return List.of();
        }
        List<URI> uris = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String selectedUrl : selectedUrls) {
            URI selectedUri = validateHttpUrl(selectedUrl);
            if (!isSameHost(selectedUri, startUri.getHost())) {
                throw new IllegalArgumentException("selectedUrls must stay on the same domain as url");
            }
            if (seen.add(selectedUri.toString())) {
                uris.add(selectedUri);
            }
        }
        return uris;
    }

    private void appendImportedPage(
            URI uri,
            StringBuilder mergedContent,
            List<String> importedUrls,
            Map<String, Document> documentCache
    ) throws IOException {
        ParsedHtmlPage page = fetchAndExtract(uri, documentCache);
        appendPageText(uri, page, mergedContent, importedUrls);
    }

    private void appendPageText(URI uri, ParsedHtmlPage page, StringBuilder mergedContent, List<String> importedUrls) {
        if (!mergedContent.isEmpty()) {
            mergedContent.append("\n\n---\n\n");
        }
        mergedContent.append("Source URL: ").append(uri).append("\n");
        mergedContent.append("Page title: ").append(page.title()).append("\n\n");
        mergedContent.append(page.text());
        importedUrls.add(uri.toString());
    }

    private ParsedHtmlPage fetchAndExtract(URI uri) throws IOException {
        return extractPage(uri, fetchDocument(uri));
    }

    private ParsedHtmlPage fetchAndExtract(URI uri, Map<String, Document> documentCache) throws IOException {
        URI pageUri = stripFragment(uri);
        String cacheKey = pageUri.toString();
        Document cached = documentCache.get(cacheKey);
        if (cached == null) {
            cached = fetchDocument(pageUri);
            documentCache.put(cacheKey, cached);
        }
        return extractPage(uri, cached.clone());
    }

    private ParsedHtmlPage extractPage(URI uri, Document doc) {
        doc.select("script, style, noscript, nav, header, footer, .navheader, .navfooter, .toc, .breadcrumbs, " +
                ".theme-doc-breadcrumbs, .pagination-nav, .theme-doc-toc-mobile, .theme-doc-toc-desktop, " +
                "[class*=breadcrumbs], [class*=tableOfContents], [class*=tocCollapsible]").remove();
        Element content = firstNonNull(
                doc.selectFirst(".theme-doc-markdown"),
                doc.selectFirst("main article"),
                doc.selectFirst("article"),
                doc.selectFirst(".chapter"),
                doc.selectFirst(".section"),
                doc.selectFirst("main"),
                doc.body()
        );

        String title = firstNonBlank(
                textOf(doc.selectFirst("h1")),
                doc.title(),
                uri.toString()
        );
        String text = extractTextForFragment(doc, content, uri.getFragment());
        text = normalizeText(text);
        if (text.length() < 100) {
            throw new IllegalArgumentException("HTML URL has too little readable text to import: " + uri);
        }
        return new ParsedHtmlPage(doc, title, text);
    }

    private Document fetchDocument(URI uri) throws IOException {
        return Jsoup.connect(uri.toString())
                .userAgent("AI-Tutor-Platform/1.0 (+course-material-import)")
                .timeout(CONNECT_TIMEOUT_MS)
                .followRedirects(true)
                .get();
    }

    private String extractTextForFragment(Document doc, Element content, String fragment) {
        if (fragment == null || fragment.isBlank()) {
            return content == null ? "" : content.wholeText();
        }
        Element anchor = doc.getElementById(fragment);
        if (anchor == null) {
            anchor = doc.selectFirst("a[name=" + cssEscape(fragment) + "]");
        }
        if (anchor == null) {
            return content == null ? "" : content.wholeText();
        }

        Element section = anchor.closest(".section, section");
        if (section != null) {
            return section.wholeText();
        }

        Element heading = anchor;
        while (heading != null && !isHeading(heading)) {
            heading = heading.parent();
        }
        if (heading == null) {
            heading = anchor;
        }
        int headingLevel = headingLevel(heading);
        StringBuilder sectionText = new StringBuilder(heading.wholeText());
        Element sibling = heading.nextElementSibling();
        while (sibling != null) {
            int siblingLevel = headingLevel(sibling);
            if (siblingLevel > 0 && headingLevel > 0 && siblingLevel <= headingLevel) {
                break;
            }
            sectionText.append("\n\n").append(sibling.wholeText());
            sibling = sibling.nextElementSibling();
        }
        String result = sectionText.toString().trim();
        return result.isBlank() && content != null ? content.wholeText() : result;
    }

    private URI resolveNextUrl(URI current, Document doc, String allowedHost) {
        Element next = firstNonNull(
                doc.selectFirst("a[rel=next]"),
                doc.selectFirst("a[accesskey=n]"),
                doc.selectFirst("a[title~=(?i)^next]"),
                doc.selectFirst("a:matchesOwn((?i)^Next$)")
        );
        if (next == null) {
            return null;
        }
        String href = next.attr("abs:href");
        if (href == null || href.isBlank()) {
            return null;
        }
        try {
            URI nextUri = new URI(href);
            if (!isSameHost(nextUri, allowedHost)) {
                return null;
            }
            return stripFragment(nextUri);
        } catch (URISyntaxException e) {
            return null;
        }
    }

    private int resolveMaxPages(Boolean followNext, Integer requestedMaxPages) {
        if (!Boolean.TRUE.equals(followNext)) {
            return DEFAULT_MAX_PAGES;
        }
        int maxPages = requestedMaxPages == null ? 3 : requestedMaxPages;
        if (maxPages < 1) {
            throw new IllegalArgumentException("maxPages must be at least 1");
        }
        return maxPages;
    }

    private URI validateHttpUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalArgumentException("url is required");
        }
        try {
            URI uri = new URI(rawUrl.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!"http".equals(scheme) && !"https".equals(scheme)) {
                throw new IllegalArgumentException("url must start with http or https");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("url host is required");
            }
            return uri;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("url is invalid");
        }
    }

    private boolean looksLikeTocItem(String label) {
        String lower = label.toLowerCase(Locale.ROOT);
        return lower.startsWith("preface")
                || lower.startsWith("appendix")
                || TOC_NUMBER_PATTERN.matcher(label).matches();
    }

    private boolean hasReadableTocLabel(String label) {
        if (label == null || label.length() < 3 || label.length() > 180) {
            return false;
        }
        String lower = label.toLowerCase(Locale.ROOT);
        return !lower.equals("next")
                && !lower.equals("prev")
                && !lower.equals("previous")
                && !lower.equals("edit this page")
                && !lower.contains("legal notice");
    }

    private boolean looksLikeDocumentationPage(Element link, URI itemUri, URI sourceUri) {
        if (link.hasAttr("download")) {
            return false;
        }
        URI itemPage = stripFragment(itemUri);
        URI sourcePage = stripFragment(sourceUri);
        if (itemPage.equals(sourcePage)) {
            return false;
        }

        String path = itemPage.getPath() == null ? "" : itemPage.getPath().toLowerCase(Locale.ROOT);
        if (path.isBlank() || path.equals("/")
                || path.contains("/search")
                || path.contains("/login")
                || path.contains("/logout")
                || path.contains("/signup")
                || path.contains("/assets/")
                || path.contains("/static/")
                || path.contains("/images/")
                || path.contains("/img/")
                || path.contains("/api/")) {
            return false;
        }

        return !path.matches(".*\\.(?:pdf|zip|rar|7z|docx?|pptx?|xlsx?|txt|md|json|xml|css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|mp3|mp4|webm|woff2?|ttf|eot)$");
    }

    private int tocLevel(String label) {
        Matcher matcher = TOC_NUMBER_PATTERN.matcher(label);
        if (!matcher.matches()) {
            return 1;
        }
        return matcher.group(1).split("\\.").length;
    }

    private String normalizeLabel(String text) {
        return text == null ? "" : text.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }

    private boolean isHeading(Element element) {
        return headingLevel(element) > 0;
    }

    private int headingLevel(Element element) {
        if (element == null) {
            return 0;
        }
        String tag = element.tagName().toLowerCase(Locale.ROOT);
        if (tag.length() == 2 && tag.charAt(0) == 'h' && Character.isDigit(tag.charAt(1))) {
            return Character.digit(tag.charAt(1), 10);
        }
        return 0;
    }

    private String cssEscape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private boolean isSameHost(URI uri, String allowedHost) {
        return uri.getHost() != null && uri.getHost().equalsIgnoreCase(allowedHost);
    }

    private URI stripFragment(URI uri) {
        try {
            return new URI(uri.getScheme(), uri.getAuthority(), uri.getPath(), uri.getQuery(), null);
        } catch (URISyntaxException e) {
            return uri;
        }
    }

    private String normalizeText(String text) {
        return text == null ? "" : text
                .replace('\u00A0', ' ')
                .replaceAll("[ \t]{2,}", " ")
                .replaceAll("(?m)^\\s+", "")
                .replaceAll("\\R{3,}", "\n\n")
                .trim();
    }

    private String textOf(Element element) {
        return element == null ? null : element.text();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private record ParsedHtmlPage(Document document, String title, String text) {}

    public record TableOfContentsResult(String title, String sourceUrl, List<TableOfContentsItem> items) {}

    public record TableOfContentsItem(String title, String url, int level, String anchor) {}

    public record ImportResult(String materialId, String title, List<String> importedUrls, String indexingStatus) {}
}
