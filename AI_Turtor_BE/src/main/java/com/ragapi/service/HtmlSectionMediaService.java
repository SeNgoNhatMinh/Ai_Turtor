package com.ragapi.service;

import lombok.extern.slf4j.Slf4j;
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
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves website-section media (source page + figures) for Senior/Teacher chapter preview.
 * HTML imports historically stored text only; this re-reads the live Source URL when needed.
 */
@Slf4j
@Service
public class HtmlSectionMediaService {

    private static final int CONNECT_TIMEOUT_MS = (int) Duration.ofSeconds(12).toMillis();
    private static final int MAX_IMAGES = 16;
    private static final Pattern SOURCE_URL = Pattern.compile("(?im)^Source URL:\\s*(.+)$");
    private static final Pattern STORED_FIGURE = Pattern.compile(
            "(?im)^(?:Figure|Image):\\s*(https?://\\S+)$");

    public record SectionMedia(String sourcePageUrl, List<String> imageUrls) {
    }

    public SectionMedia resolveFromStoredSection(String sectionText) {
        String sourceUrl = firstMatch(SOURCE_URL, sectionText);
        List<String> stored = extractStoredFigures(sectionText);
        if (!stored.isEmpty()) {
            return new SectionMedia(sourceUrl, stored);
        }
        if (sourceUrl == null || sourceUrl.isBlank()) {
            return new SectionMedia(null, List.of());
        }
        try {
            return new SectionMedia(sourceUrl, fetchImageUrls(sourceUrl));
        } catch (Exception e) {
            log.warn("Could not load figures for HTML section {}: {}", sourceUrl, e.getMessage());
            return new SectionMedia(sourceUrl, List.of());
        }
    }

    public List<String> fetchImageUrls(String pageUrl) throws IOException, URISyntaxException {
        URI uri = new URI(pageUrl.trim());
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return List.of();
        }
        Document doc = Jsoup.connect(stripFragment(uri).toString())
                .userAgent("AI-Tutor-Platform/1.0 (+chapter-preview-images)")
                .timeout(CONNECT_TIMEOUT_MS)
                .followRedirects(true)
                .get();
        doc.select("script, style, noscript, nav, header, footer, .navheader, .navfooter, .toc, .breadcrumbs").remove();
        Element scope = resolveSectionScope(doc, uri.getFragment());
        if (scope == null) {
            return List.of();
        }
        Set<String> urls = new LinkedHashSet<>();
        for (Element img : scope.select("img[src]")) {
            String abs = img.absUrl("src");
            if (isUsableImageUrl(abs)) {
                urls.add(abs);
            }
            if (urls.size() >= MAX_IMAGES) {
                break;
            }
        }
        return new ArrayList<>(urls);
    }

    public static String formatFiguresBlock(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder("\n\n");
        for (String url : imageUrls) {
            out.append("Figure: ").append(url).append('\n');
        }
        return out.toString();
    }

    private Element resolveSectionScope(Document doc, String fragment) {
        Element content = firstNonNull(
                doc.selectFirst(".theme-doc-markdown"),
                doc.selectFirst("main article"),
                doc.selectFirst("article"),
                doc.selectFirst(".chapter"),
                doc.selectFirst(".section"),
                doc.selectFirst("main"),
                doc.body()
        );
        if (fragment == null || fragment.isBlank()) {
            return content;
        }
        Element anchor = doc.getElementById(fragment);
        if (anchor == null) {
            anchor = doc.selectFirst("a[name=" + cssEscape(fragment) + "]");
        }
        if (anchor == null) {
            return content;
        }
        Element section = anchor.closest(".section, section");
        if (section != null) {
            return section;
        }
        Element heading = anchor;
        while (heading != null && !isHeading(heading)) {
            heading = heading.parent();
        }
        if (heading == null) {
            return content;
        }
        Element wrapper = doc.createElement("div");
        wrapper.appendChild(heading.clone());
        Element sibling = heading.nextElementSibling();
        int level = headingLevel(heading);
        while (sibling != null) {
            int siblingLevel = headingLevel(sibling);
            if (siblingLevel > 0 && level > 0 && siblingLevel <= level) {
                break;
            }
            wrapper.appendChild(sibling.clone());
            sibling = sibling.nextElementSibling();
        }
        return wrapper;
    }

    private static List<String> extractStoredFigures(String sectionText) {
        if (sectionText == null || sectionText.isBlank()) {
            return List.of();
        }
        List<String> urls = new ArrayList<>();
        Matcher matcher = STORED_FIGURE.matcher(sectionText);
        while (matcher.find() && urls.size() < MAX_IMAGES) {
            String url = matcher.group(1).trim();
            if (isUsableImageUrl(url)) {
                urls.add(url);
            }
        }
        return urls;
    }

    private static boolean isUsableImageUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (!(lower.startsWith("http://") || lower.startsWith("https://"))) {
            return false;
        }
        if (lower.contains("1x1") || lower.contains("pixel") || lower.contains("spacer")) {
            return false;
        }
        if (lower.contains("logo") || lower.contains("favicon") || lower.contains("icon")
                || lower.contains("avatar") || lower.contains("sprite")) {
            return false;
        }
        return lower.contains(".png")
                || lower.contains(".jpg")
                || lower.contains(".jpeg")
                || lower.contains(".gif")
                || lower.contains(".webp")
                || lower.contains(".svg")
                || lower.contains("/image")
                || lower.contains("/img")
                || lower.contains("figures");
    }

    private static String firstMatch(Pattern pattern, String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value == null ? null : value.trim();
    }

    private static URI stripFragment(URI uri) throws URISyntaxException {
        return new URI(uri.getScheme(), uri.getAuthority(), uri.getPath(), uri.getQuery(), null);
    }

    private static boolean isHeading(Element element) {
        if (element == null) {
            return false;
        }
        String tag = element.normalName();
        return tag.length() == 2 && tag.charAt(0) == 'h' && Character.isDigit(tag.charAt(1));
    }

    private static int headingLevel(Element element) {
        if (!isHeading(element)) {
            return 0;
        }
        return Character.digit(element.normalName().charAt(1), 10);
    }

    private static String cssEscape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
