package com.ragapi.harness.curriculum;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.MaterialTocEntry;
import com.ragapi.harness.entity.CourseChapterOutline;
import com.ragapi.harness.util.ChapterKeyUtils;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.service.course.CourseMaterialChunkingService;
import com.ragapi.service.pdf.PdfExtractionService;
import com.ragapi.service.pdf.PdfStorageService;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.stereotype.Component;

/** Reads a course file into chapter titles and the text of one section. */
@Slf4j
@Component
@RequiredArgsConstructor
class ChapterOutlineReader {

    private final CourseMaterialRepository materialRepository;
    private final CourseMaterialChunkingService chunkingService;
    private final PdfExtractionService pdfExtractionService;
    private final PdfStorageService pdfStorageService;

    private static final Pattern HTML_SECTION_SPLIT = Pattern.compile("\\n\\n---+\\n\\n");
    private static final Pattern HTML_PAGE_TITLE = Pattern.compile("(?im)^Page title:\\s*(.+)$");
    private static final Pattern HTML_SOURCE_URL = Pattern.compile("(?im)^Source URL:\\s*(.+)$");
    /** "Chapter 3. Basic Logic" / "Chương 2: Hàm" / running header "Chapter 3 - Basic Logic Page 21". */
    private static final Pattern TEXT_CHAPTER_HEADING = Pattern.compile(
            "(?im)^[ \\t]*(chapter|chương|chuong)[ \\t]+(\\d{1,3})[ \\t]*[.:\\-–—][ \\t]*(\\p{L}[^\\n]{0,110}?)[ \\t]*$"
    );
    private static final Pattern TRAILING_PAGE_LABEL = Pattern.compile(
            "(?i)(?:[\\s.…]+(?:page|trang)?\\s*\\d{1,4})$"
    );
    static final int MIN_TEXT_HEADINGS = 2;

    /** A chapter heading found in extracted text; offset is its first occurrence. */
    record TextHeading(int number, String title, int offset) {
    }

    void ensureTableOfContents(CourseMaterial material) {
        if (material.getTableOfContents() != null && !material.getTableOfContents().isEmpty()) {
            return;
        }
        if (material.getPdfFileId() == null || material.getPdfFileId().isBlank()) {
            return;
        }
        try {
            GridFsResource resource = pdfStorageService.loadByFileId(material.getPdfFileId());
            byte[] pdfBytes = resource.getInputStream().readAllBytes();
            List<MaterialTocEntry> toc = pdfExtractionService.extractTableOfContents(pdfBytes);
            if (toc.isEmpty()) {
                return;
            }
            material.setTableOfContents(toc);
            if (material.getPageCount() == null || material.getPageCount() <= 0) {
                material.setPageCount(pdfExtractionService.extract(pdfBytes, material.getSourceFileName()).pageCount());
            }
            materialRepository.save(material);
            log.info("Backfilled {} PDF bookmark entries for material {}", toc.size(), material.getId());
        } catch (IOException e) {
            log.warn("Could not backfill PDF bookmarks for material {}: {}", material.getId(), e.getMessage());
        }
    }

    void ingestMaterial(CourseMaterial material, Map<String, AggregatedChapter> aggregated) {
        String content = material.getContent();
        if (content == null || content.isBlank()) {
            return;
        }

        if (isHtmlUrlMaterial(material) && hasHtmlSectionMarkers(content)) {
            ingestHtmlSections(material, aggregated, content);
            return;
        }

        List<MaterialTocEntry> toc = material.getTableOfContents();
        if (toc != null && !toc.isEmpty()) {
            ingestMaterialFromBookmarks(material, aggregated, toc, content);
            return;
        }

        // PDFs without bookmarks: use "Chapter N. Title" lines from the text itself.
        List<TextHeading> headings = textChapterHeadings(content);
        if (headings.size() >= MIN_TEXT_HEADINGS) {
            ingestMaterialFromTextHeadings(material, aggregated, headings, content);
            return;
        }

        String title = firstNonBlank(material.getTitle(), material.getCategory(), "General");
        int chunks = chunkingService.chunk(content).size();
        mergeChapter(aggregated, title, ChapterOutlineService.DETECTED_FROM_MATERIAL, material.getId(), chunks, content.length(), null, null, null);
    }

    private static boolean isHtmlUrlMaterial(CourseMaterial material) {
        String sourceType = material.getSourceType() == null ? "" : material.getSourceType().trim().toUpperCase();
        return "HTML_URL".equals(sourceType) || sourceType.contains("HTML");
    }

    static boolean hasHtmlSectionMarkers(String content) {
        return content != null
                && content.contains("Source URL:")
                && content.contains("Page title:");
    }

    private void ingestHtmlSections(
            CourseMaterial material,
            Map<String, AggregatedChapter> aggregated,
            String content
    ) {
        String[] parts = HTML_SECTION_SPLIT.split(content);
        int created = 0;
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            String section = part.trim();
            String pageTitle = matchFirstGroup(HTML_PAGE_TITLE, section);
            String sourceUrl = matchFirstGroup(HTML_SOURCE_URL, section);
            String title = resolveHtmlSectionTitle(pageTitle, sourceUrl, created + 1);
            int chunks = Math.max(1, chunkingService.chunk(section).size());
            mergeChapter(
                    aggregated,
                    title,
                    ChapterOutlineService.DETECTED_FROM_HTML_SECTION,
                    material.getId(),
                    chunks,
                    section.length(),
                    0,
                    null,
                    null
            );
            created += 1;
        }
        if (created == 0) {
            String title = firstNonBlank(material.getTitle(), material.getCategory(), "General");
            int chunks = chunkingService.chunk(content).size();
            mergeChapter(aggregated, title, ChapterOutlineService.DETECTED_FROM_MATERIAL, material.getId(), chunks, content.length(), null, null, null);
        }
    }

    static String resolveHtmlSectionTitle(String pageTitle, String sourceUrl, int index) {
        String fragment = extractUrlFragment(sourceUrl);
        String sectionLabel = humanizeHtmlFragment(fragment);
        if (sectionLabel != null && !sectionLabel.isBlank()) {
            if (pageTitle != null && !pageTitle.isBlank()
                    && !pageTitle.equalsIgnoreCase(sectionLabel)
                    && !pageTitle.toLowerCase().contains(sectionLabel.toLowerCase())) {
                return sectionLabel + " · " + pageTitle.trim();
            }
            return sectionLabel;
        }
        if (pageTitle != null && !pageTitle.isBlank()) {
            return pageTitle.trim();
        }
        if (sourceUrl != null && !sourceUrl.isBlank()) {
            return sourceUrl.trim();
        }
        return "HTML section " + index;
    }

    static String extractUrlFragment(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            return null;
        }
        int hash = sourceUrl.indexOf('#');
        if (hash < 0 || hash >= sourceUrl.length() - 1) {
            return null;
        }
        return sourceUrl.substring(hash + 1).trim();
    }

    static String humanizeHtmlFragment(String fragment) {
        if (fragment == null || fragment.isBlank()) {
            return null;
        }
        String cleaned = fragment.trim();
        // docs.oracle.com style: jvms-1.2.3 / jls-8.4.1
        cleaned = cleaned.replaceFirst("(?i)^[a-z]{2,10}-", "");
        cleaned = cleaned.replace('-', ' ').trim();
        return cleaned.isBlank() ? fragment.trim() : cleaned;
    }

    private static String matchFirstGroup(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value == null ? null : value.trim();
    }

    /**
     * Chapter headings written in the text, one per chapter number, in document order.
     * Running page headers repeat a chapter, so only its first occurrence counts.
     */
    static List<TextHeading> textChapterHeadings(String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }
        Map<Integer, TextHeading> byNumber = new java.util.LinkedHashMap<>();
        Matcher matcher = TEXT_CHAPTER_HEADING.matcher(content);
        while (matcher.find()) {
            int number = Integer.parseInt(matcher.group(2));
            if (byNumber.containsKey(number)) {
                continue;
            }
            String name = TRAILING_PAGE_LABEL.matcher(matcher.group(3).trim()).replaceFirst("").trim();
            if (name.isBlank() || name.codePoints().filter(Character::isLetter).count() < 3) {
                continue;
            }
            String word = Character.toUpperCase(matcher.group(1).charAt(0))
                    + matcher.group(1).substring(1).toLowerCase(java.util.Locale.ROOT);
            byNumber.put(number, new TextHeading(number, word + " " + number + ". " + name, matcher.start()));
        }
        List<TextHeading> headings = new ArrayList<>(byNumber.values());
        headings.sort(java.util.Comparator.comparingInt(TextHeading::offset));
        return List.copyOf(headings);
    }

    /** Text of one chapter: from its heading to the next detected chapter heading. */
    static String extractTextHeadingSection(String content, String title) {
        if (content == null || title == null || title.isBlank()) {
            return "";
        }
        String key = ChapterKeyUtils.toChapterKey(title);
        List<TextHeading> headings = textChapterHeadings(content);
        for (int i = 0; i < headings.size(); i++) {
            TextHeading heading = headings.get(i);
            if (!ChapterKeyUtils.toChapterKey(heading.title()).equals(key)) {
                continue;
            }
            int end = i + 1 < headings.size() ? headings.get(i + 1).offset() : content.length();
            return content.substring(heading.offset(), Math.max(heading.offset(), end)).trim();
        }
        return "";
    }

    private void ingestMaterialFromTextHeadings(
            CourseMaterial material,
            Map<String, AggregatedChapter> aggregated,
            List<TextHeading> headings,
            String content
    ) {
        int totalPages = material.getPageCount() != null && material.getPageCount() > 0
                ? material.getPageCount()
                : 0;
        for (int i = 0; i < headings.size(); i++) {
            TextHeading heading = headings.get(i);
            int end = i + 1 < headings.size() ? headings.get(i + 1).offset() : content.length();
            String section = content.substring(heading.offset(), Math.max(heading.offset(), end));
            // Estimated page from the text position keeps document order next to other materials.
            Integer pageStart = totalPages > 0
                    ? Math.max(1, (int) ((long) heading.offset() * totalPages / content.length()) + 1)
                    : null;
            Integer pageEnd = totalPages > 0
                    ? Math.max(pageStart, (int) ((long) end * totalPages / content.length()))
                    : null;
            mergeChapter(
                    aggregated,
                    heading.title(),
                    ChapterOutlineService.DETECTED_FROM_TEXT_HEADING,
                    material.getId(),
                    Math.max(1, chunkingService.chunk(section).size()),
                    section.length(),
                    0,
                    pageStart,
                    pageEnd
            );
        }
    }

    private void ingestMaterialFromBookmarks(
            CourseMaterial material,
            Map<String, AggregatedChapter> aggregated,
            List<MaterialTocEntry> toc,
            String content
    ) {
        int totalPages = material.getPageCount() != null && material.getPageCount() > 0
                ? material.getPageCount()
                : 1;
        int totalChunks = chunkingService.chunk(content).size();

        for (MaterialTocEntry entry : toc) {
            int pageStart = entry.getPageStart() > 0 ? entry.getPageStart() : 1;
            int pageEnd = entry.getPageEnd() != null && entry.getPageEnd() > 0 ? entry.getPageEnd() : totalPages;
            int pageSpan = Math.max(1, pageEnd - pageStart + 1);
            long approxChars = Math.max(1L, (long) content.length() * pageSpan / totalPages);
            int chunkCount = Math.max(1, totalChunks * pageSpan / totalPages);
            mergeChapter(
                    aggregated,
                    entry.getTitle(),
                    ChapterOutlineService.DETECTED_FROM_BOOKMARK,
                    material.getId(),
                    chunkCount,
                    (int) Math.min(Integer.MAX_VALUE, approxChars),
                    entry.getLevel(),
                    pageStart,
                    pageEnd
            );
        }
    }

    private void mergeChapter(
            Map<String, AggregatedChapter> aggregated,
            String title,
            String detectedFrom,
            String materialId,
            int chunkCount,
            int approxChars,
            Integer tocLevel,
            Integer pageStart,
            Integer pageEnd
    ) {
        String cleanedTitle = title == null ? "General" : title.trim();
        final String resolvedTitle = cleanedTitle.isBlank() ? "General" : cleanedTitle;
        String key = ChapterKeyUtils.toChapterKey(resolvedTitle);
        AggregatedChapter chapter = aggregated.computeIfAbsent(
                key,
                ignored -> new AggregatedChapter(key, resolvedTitle, detectedFrom, tocLevel, pageStart, pageEnd)
        );
        chapter.materialIds.add(materialId);
        chapter.chunkCount += chunkCount;
        chapter.approxChars += approxChars;
    }

    void appendExcerptForOutline(
            CourseChapterOutline outline,
            CourseMaterial material,
            StringBuilder excerpt,
            int excerptLimit,
            boolean fullSectionRequested
    ) {
        if (material.getContent() == null || material.getContent().isBlank()) {
            return;
        }
        if (!fullSectionRequested && excerpt.length() >= excerptLimit) {
            return;
        }

        if (outline.getSourceMaterialIds() != null
                && !outline.getSourceMaterialIds().isEmpty()
                && !outline.getSourceMaterialIds().contains(material.getId())) {
            return;
        }

        if (ChapterOutlineService.DETECTED_FROM_TEXT_HEADING.equalsIgnoreCase(outline.getDetectedFrom())) {
            String sectionText = extractTextHeadingSection(material.getContent(), outline.getTitle());
            if (!sectionText.isBlank()) {
                appendExcerptText(excerpt, sectionText, excerptLimit, fullSectionRequested);
                return;
            }
        }

        if (ChapterOutlineService.DETECTED_FROM_BOOKMARK.equalsIgnoreCase(outline.getDetectedFrom())
                || ChapterOutlineService.DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(outline.getDetectedFrom())) {
            String sectionText = ChapterOutlineService.DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(outline.getDetectedFrom())
                    ? extractHtmlSectionByTitle(material.getContent(), outline.getTitle())
                    : resolveBookmarkSectionText(outline, material);
            if (!sectionText.isBlank()) {
                appendExcerptText(excerpt, sectionText, excerptLimit, fullSectionRequested);
                return;
            }
        }

        String targetKey = outline.getChapterKey();
        String materialTitle = firstNonBlank(material.getTitle(), material.getCategory(), "General");
        if (!ChapterKeyUtils.toChapterKey(materialTitle).equals(targetKey)
                && (outline.getSourceMaterialIds() == null || !outline.getSourceMaterialIds().contains(material.getId()))) {
            return;
        }

        String sectionText = extractSectionByTitle(material.getContent(), outline.getTitle());
        appendExcerptText(
                excerpt,
                sectionText.isBlank() ? material.getContent() : sectionText,
                excerptLimit,
                fullSectionRequested
        );
    }

    private String resolveBookmarkSectionText(CourseChapterOutline outline, CourseMaterial material) {
        return extractSectionByTitle(material.getContent(), outline.getTitle());
    }

    static String extractHtmlSectionByTitle(String content, String title) {
        if (content == null || content.isBlank() || title == null || title.isBlank()) {
            return "";
        }
        String[] parts = HTML_SECTION_SPLIT.split(content);
        String needle = title.trim();
        String fragmentHint = null;
        int sep = needle.indexOf(" · ");
        if (sep > 0) {
            fragmentHint = needle.substring(0, sep).trim();
        }
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            String pageTitle = matchFirstGroup(HTML_PAGE_TITLE, part);
            String sourceUrl = matchFirstGroup(HTML_SOURCE_URL, part);
            if (pageTitle != null && pageTitle.equalsIgnoreCase(needle)) {
                return part.trim();
            }
            if (fragmentHint != null && sourceUrl != null) {
                String fragment = extractUrlFragment(sourceUrl);
                String humanized = humanizeHtmlFragment(fragment);
                if (fragmentHint.equalsIgnoreCase(humanized)
                        || (fragment != null && (fragment.equalsIgnoreCase(fragmentHint)
                        || fragment.endsWith("-" + fragmentHint)
                        || fragment.endsWith(fragmentHint)))) {
                    return part.trim();
                }
            }
            if (indexOfIgnoreCase(part, needle) >= 0) {
                return part.trim();
            }
        }
        return extractSectionByTitle(content, title);
    }

    static String extractSectionByTitle(String content, String title) {
        if (content == null || content.isBlank() || title == null || title.isBlank()) {
            return "";
        }
        List<TitleHit> hits = locateTitleHits(content, title.trim());
        if (hits.isEmpty()) {
            return "";
        }
        TitleHit best = hits.get(0);
        int bestScore = Integer.MIN_VALUE;
        for (TitleHit hit : hits) {
            int score = scoreTitleHit(content, hit);
            if (score > bestScore) {
                bestScore = score;
                best = hit;
            }
        }
        boolean numberedSection = sectionNumber(title) != null;
        int nextHeading = findNextSectionStart(
                content,
                best.end(),
                numberedSection,
                chapterNumberBefore(content, best.start()),
                sectionNumber(title)
        );
        String section = nextHeading > best.start()
                ? content.substring(best.start(), nextHeading).trim()
                : content.substring(best.start()).trim();
        if (section.length() > ChapterOutlineService.MENTOR_EXCERPT_LIMIT) {
            return section.substring(0, ChapterOutlineService.MENTOR_EXCERPT_LIMIT).trim();
        }
        return section;
    }

    private record TitleHit(int start, int end) {
    }

    private static List<TitleHit> locateTitleHits(String content, String title) {
        StringBuilder normalized = new StringBuilder(content.length());
        int[] origin = new int[content.length() + 1];
        boolean pendingSpace = false;
        for (int index = 0; index < content.length(); index++) {
            char character = content.charAt(index);
            if (Character.isWhitespace(character)) {
                pendingSpace = !normalized.isEmpty();
                continue;
            }
            if (pendingSpace) {
                origin[normalized.length()] = index;
                normalized.append(' ');
                pendingSpace = false;
            }
            origin[normalized.length()] = index;
            normalized.append(Character.toLowerCase(character));
        }
        String haystack = normalized.toString();
        String needle = title.toLowerCase(java.util.Locale.ROOT).replaceAll("\\s+", " ").trim();
        if (needle.isEmpty()) {
            return List.of();
        }
        List<TitleHit> hits = new ArrayList<>();
        int from = 0;
        while (from <= haystack.length() - needle.length()) {
            int found = haystack.indexOf(needle, from);
            if (found < 0) {
                break;
            }
            int last = found + needle.length() - 1;
            hits.add(new TitleHit(origin[found], origin[last] + 1));
            from = found + needle.length();
        }
        return hits;
    }

    private static int scoreTitleHit(String content, TitleHit hit) {
        int lineStart = content.lastIndexOf('\n', Math.max(0, hit.start() - 1)) + 1;
        String beforeOnLine = content.substring(lineStart, hit.start());
        String lookback = content.substring(Math.max(0, hit.start() - 80), hit.start())
                .replaceAll("\\s+", " ")
                .toLowerCase(java.util.Locale.ROOT);
        int score = 0;
        if (lookback.matches(".*chapter\\s+\\d+\\s*")) {
            score += 300;
        }
        if (beforeOnLine.isBlank() || beforeOnLine.matches("(?i)[\\d\\s.:-]*")) {
            score += 80;
        }
        if (hit.start() > 0 && Character.isLetter(content.charAt(hit.start() - 1))) {
            score -= 150;
        }
        if (trailingPageNumber(content, hit)) {
            score -= 50;
        }
        return score;
    }

    private static boolean trailingPageNumber(String content, TitleHit hit) {
        int lineEnd = content.indexOf('\n', hit.start());
        if (lineEnd < 0) {
            lineEnd = content.length();
        }
        if (hit.end() > lineEnd) {
            return false;
        }
        String after = content.substring(hit.end(), lineEnd).trim();
        return after.matches("[.|\\u2026\\s]*\\d{1,4}");
    }

    private static Integer chapterNumberBefore(String content, int index) {
        String lookback = content.substring(Math.max(0, index - 120), Math.min(content.length(), index));
        Matcher matcher = Pattern.compile("(?i)chapter\\s+(\\d+)\\b").matcher(lookback);
        Integer number = null;
        while (matcher.find()) {
            number = Integer.parseInt(matcher.group(1));
        }
        return number;
    }

    private static int indexOfIgnoreCase(String content, String title) {
        String lowerContent = content.toLowerCase();
        String lowerTitle = title.toLowerCase();
        return lowerContent.indexOf(lowerTitle);
    }

    private static String sectionNumber(String title) {
        if (title == null) {
            return null;
        }
        Matcher matcher = Pattern.compile("^(\\d+(?:\\.\\d+)*)\\b").matcher(title.trim());
        return matcher.find() ? matcher.group(1) : null;
    }

    private static boolean isDescendantSection(String parentNumber, String childNumber) {
        return parentNumber != null
                && childNumber != null
                && childNumber.startsWith(parentNumber + ".");
    }

    private static int findNextSectionStart(
            String content,
            int fromIndex,
            boolean stopAtSubsections,
            Integer currentChapter,
            String sectionNumber
    ) {
        if (fromIndex >= content.length()) {
            return content.length();
        }
        String tail = content.substring(fromIndex);
        Matcher chapter = Pattern
                .compile("(?im)^[ \\t]*(?:\\d{1,4}[ \\t]+)?chapter[ \\t]+(\\d+)\\b")
                .matcher(tail);
        int chapterEnd = content.length();
        while (chapter.find()) {
            int number = Integer.parseInt(chapter.group(1));
            if (currentChapter != null && number == currentChapter) {
                continue;
            }
            chapterEnd = fromIndex + chapter.start();
            break;
        }
        if (!stopAtSubsections) {
            return chapterEnd;
        }
        Matcher subsection = Pattern
                .compile("(?m)^[ \\t]*(\\d+(?:\\.\\d+)+)[ \\t]+\\p{L}")
                .matcher(tail);
        while (subsection.find()) {
            if (isDescendantSection(sectionNumber, subsection.group(1))) {
                continue;
            }
            return Math.min(chapterEnd, fromIndex + subsection.start());
        }
        return chapterEnd;
    }

    private void appendExcerptText(StringBuilder excerpt, String text, int excerptLimit, boolean fullSectionRequested) {
        if (text == null || text.isBlank()) {
            return;
        }
        if (!fullSectionRequested && excerpt.length() >= excerptLimit) {
            return;
        }
        if (!excerpt.isEmpty()) {
            excerpt.append("\n\n");
        }
        if (fullSectionRequested) {
            excerpt.append(text.trim());
            return;
        }
        int remaining = excerptLimit - excerpt.length();
        if (remaining <= 0) {
            return;
        }
        String trimmed = text.trim();
        if (trimmed.length() <= remaining) {
            excerpt.append(trimmed);
        } else {
            excerpt.append(trimmed, 0, remaining);
        }
    }

    String trimExcerpt(String excerpt, int limit) {
        if (excerpt == null || excerpt.isBlank()) {
            return "";
        }
        if (excerpt.length() <= limit) {
            return excerpt;
        }
        return excerpt.substring(0, limit).trim() + "...";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "General";
    }

    static final class AggregatedChapter {
        final String chapterKey;
        final String title;
        final String detectedFrom;
        final Integer tocLevel;
        final Integer pageStart;
        final Integer pageEnd;
        final Set<String> materialIds = new LinkedHashSet<>();
        int chunkCount;
        long approxChars;

        private AggregatedChapter(
                String chapterKey,
                String title,
                String detectedFrom,
                Integer tocLevel,
                Integer pageStart,
                Integer pageEnd
        ) {
            this.chapterKey = chapterKey;
            this.title = title;
            this.detectedFrom = detectedFrom;
            this.tocLevel = tocLevel;
            this.pageStart = pageStart;
            this.pageEnd = pageEnd;
        }
    }
}
