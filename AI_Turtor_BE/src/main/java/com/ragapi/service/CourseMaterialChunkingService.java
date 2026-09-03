package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.MaterialTocEntry;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CourseMaterialChunkingService {
    private static final int DEFAULT_CHUNK_SIZE = 1000;
    private static final Pattern HEADING_PATTERN = Pattern.compile(
            "(?im)^\\s*((?:chapter|section|unit|lesson|module|part|slide)\\s+\\d+.*|\\d+(?:\\.\\d+)*\\s+\\S.*)$");
    private static final Pattern HEADING_LINE = Pattern.compile(
            "(?i)^\\s*((?:chapter|unit|module|part|section|lesson|slide)\\s+\\d+[\\w.-]*|\\d+(?:\\.\\d+)*)\\s+(.+?)\\s*$");
    private static final Pattern PAGE_HEADER_WITH_CHAPTER = Pattern.compile(
            "(?i)^\\s*\\d+\\s+[^\\p{L}\\p{N}]*\\s*(?:chapter|unit|module|part)\\s+\\d+.*$");

    public List<String> chunk(String text) { return chunk(text, DEFAULT_CHUNK_SIZE); }

    public List<String> chunk(String text, int maxChunkSize) {
        if (text == null || text.isBlank()) return List.of();
        List<String> sections = splitByHeadings(text.trim());
        if (sections.size() > 1) return fitChunkSize(sections, maxChunkSize);
        List<String> paragraphs = splitByParagraphs(text.trim());
        if (paragraphs.size() > 1) return fitChunkSize(paragraphs, maxChunkSize);
        return splitByLength(text.trim(), maxChunkSize);
    }

    public List<HierarchicalChunk> chunkHierarchically(CourseMaterial material) {
        if (material == null) return List.of();
        return chunkHierarchically(material.getId(), material.getContent(), material.getTableOfContents(),
                material.getPageCount(), DEFAULT_CHUNK_SIZE);
    }

    /** Uses PDF bookmark page ranges, avoiding unreliable OCR heading matching. */
    public List<HierarchicalChunk> chunkPdfPages(CourseMaterial material, List<String> pages) {
        if (material == null || pages == null || pages.isEmpty()) return List.of();
        List<MaterialTocEntry> toc = material.getTableOfContents() == null
                ? List.of() : material.getTableOfContents();
        if (toc.isEmpty()) return chunkHierarchically(material);

        List<HierarchySection> sections = new ArrayList<>();
        PageHierarchy current = null;
        StringBuilder content = new StringBuilder();
        for (int index = 0; index < pages.size(); index++) {
            int pageNumber = index + 1;
            PageHierarchy pageHierarchy = hierarchyForPage(toc, pageNumber);
            if (current != null && !current.identity().equals(pageHierarchy.identity())) {
                addPageSection(sections, current, content);
                content.setLength(0);
            }
            current = pageHierarchy;
            String pageText = pages.get(index);
            if (pageText != null && !pageText.isBlank()) {
                if (!content.isEmpty()) content.append('\n');
                content.append(pageText.trim());
            }
        }
        addPageSection(sections, current, content);
        return buildHierarchicalChunks(material.getId(), sections, DEFAULT_CHUNK_SIZE);
    }

    private PageHierarchy hierarchyForPage(List<MaterialTocEntry> toc, int pageNumber) {
        int chapterIndex = 1;
        String chapterTitle = "Document";
        MaterialTocEntry bestSection = null;
        int countedChapters = 0;
        for (MaterialTocEntry entry : toc) {
            if (entry == null || entry.getPageStart() <= 0) continue;
            if (entry.getPageStart() <= pageNumber && isChapterTocEntry(entry)) {
                countedChapters++;
                chapterIndex = countedChapters;
                chapterTitle = entry.getTitle();
            }
            int end = entry.getPageEnd() == null ? entry.getPageStart() : entry.getPageEnd();
            if (entry.getPageStart() <= pageNumber && pageNumber <= end
                    && (bestSection == null
                    || entry.getPageStart() > bestSection.getPageStart()
                    || (entry.getPageStart() == bestSection.getPageStart()
                    && entry.getLevel() >= bestSection.getLevel()))) {
                bestSection = entry;
            }
        }
        String sectionTitle = bestSection == null || bestSection.getTitle() == null
                ? chapterTitle : bestSection.getTitle();
        return new PageHierarchy(chapterIndex, chapterTitle, sectionTitle);
    }

    private void addPageSection(
            List<HierarchySection> sections, PageHierarchy hierarchy, StringBuilder content) {
        if (hierarchy == null || content.isEmpty()) return;
        sections.add(new HierarchySection(
                hierarchy.chapterIndex(), hierarchy.chapterTitle(), hierarchy.sectionTitle(), content.toString()));
    }

    public List<HierarchicalChunk> chunkHierarchically(String documentId, String text) {
        return chunkHierarchically(documentId, text, List.of(), DEFAULT_CHUNK_SIZE);
    }

    public List<HierarchicalChunk> chunkHierarchically(String documentId, String text, int maxChunkSize) {
        return chunkHierarchically(documentId, text, List.of(), maxChunkSize);
    }

    public List<HierarchicalChunk> chunkHierarchically(
            String documentId, String text, List<MaterialTocEntry> toc, int maxChunkSize) {
        return chunkHierarchically(documentId, text, toc, null, maxChunkSize);
    }

    private List<HierarchicalChunk> chunkHierarchically(
            String documentId, String text, List<MaterialTocEntry> toc, Integer pageCount, int maxChunkSize) {
        if (text == null || text.isBlank()) return List.of();
        String id = documentId == null || documentId.isBlank() ? "document" : documentId.trim();
        String cleanText = text.trim();
        List<HierarchySection> hierarchy = splitByTableOfContents(cleanText, toc, pageCount);
        if (hierarchy.isEmpty()) hierarchy = inferHierarchy(cleanText);
        return buildHierarchicalChunks(id, hierarchy, maxChunkSize);
    }

    private List<HierarchySection> inferHierarchy(String text) {
        List<String> sections = splitByHeadings(text);
        if (sections.isEmpty()) sections = List.of(text);
        List<HierarchySection> result = new ArrayList<>();
        String chapterTitle = "Document";
        int chapterIndex = 0;
        for (String section : sections) {
            String heading = firstLine(section);
            HeadingKind kind = headingKind(heading);
            if (kind == HeadingKind.CHAPTER) {
                chapterTitle = heading;
                chapterIndex++;
            }
            result.add(new HierarchySection(Math.max(1, chapterIndex), chapterTitle,
                    kind == HeadingKind.SECTION ? heading : chapterTitle, section));
        }
        return result;
    }

    private List<HierarchySection> splitByTableOfContents(
            String text, List<MaterialTocEntry> toc, Integer pageCount) {
        if (toc == null || toc.isEmpty()) return List.of();
        String lower = text.toLowerCase(Locale.ROOT);
        List<TocPosition> found = new ArrayList<>();
        int cursor = 0;
        for (MaterialTocEntry entry : toc) {
            if (entry == null || entry.getTitle() == null || entry.getTitle().isBlank()) continue;
            String title = entry.getTitle().trim();
            int position = locateTocTitle(lower, title.toLowerCase(Locale.ROOT), entry, pageCount, cursor);
            if (position < 0 || containsPosition(found, position)) continue;
            found.add(new TocPosition(entry, position));
            cursor = position + title.length();
        }
        found.sort(Comparator.comparingInt(TocPosition::position));
        if (found.size() < 2) return List.of();
        List<HierarchySection> result = new ArrayList<>();
        int chapterIndex = 0;
        String chapterTitle = "Document";
        for (int i = 0; i < found.size(); i++) {
            TocPosition current = found.get(i);
            if (isChapterTocEntry(current.entry()) || chapterIndex == 0) {
                chapterIndex++;
                chapterTitle = current.entry().getTitle().trim();
            }
            int end = i + 1 < found.size() ? found.get(i + 1).position() : text.length();
            String content = text.substring(current.position(), end).trim();
            if (!content.isBlank()) result.add(new HierarchySection(
                    chapterIndex, chapterTitle, current.entry().getTitle().trim(), content));
        }
        return result;
    }

    private int locateTocTitle(
            String lowerText,
            String lowerTitle,
            MaterialTocEntry entry,
            Integer pageCount,
            int cursor
    ) {
        if (pageCount == null || pageCount <= 0 || entry.getPageStart() <= 0) {
            return lowerText.indexOf(lowerTitle, cursor);
        }
        double pageRatio = Math.max(0.0, Math.min(1.0,
                (entry.getPageStart() - 1.0) / Math.max(1.0, pageCount - 1.0)));
        int expected = (int) Math.round(pageRatio * lowerText.length());
        int best = -1;
        int bestDistance = Integer.MAX_VALUE;
        int occurrence = lowerText.indexOf(lowerTitle);
        while (occurrence >= 0) {
            if (occurrence >= cursor) {
                int distance = Math.abs(occurrence - expected);
                if (distance < bestDistance) {
                    best = occurrence;
                    bestDistance = distance;
                }
            }
            occurrence = lowerText.indexOf(lowerTitle, occurrence + Math.max(1, lowerTitle.length()));
        }
        return best;
    }

    private boolean isChapterTocEntry(MaterialTocEntry entry) {
        if (entry.getLevel() == 0) return true;
        String title = entry.getTitle() == null ? "" : entry.getTitle().trim();
        return title.matches("(?i)^(?:chapter|part|unit|module)\\s+[0-9ivxlcdm]+(?:\\s*[:.-].*|\\s+.*)?$");
    }

    private boolean containsPosition(List<TocPosition> positions, int target) {
        for (TocPosition position : positions) {
            if (position.position() == target) return true;
        }
        return false;
    }

    private List<HierarchicalChunk> buildHierarchicalChunks(
            String documentId, List<HierarchySection> sections, int maxChunkSize) {
        List<HierarchicalChunk> result = new ArrayList<>();
        int previousChapter = -1;
        int sectionIndex = 0;
        for (HierarchySection section : sections) {
            if (previousChapter != section.chapterIndex()) {
                previousChapter = section.chapterIndex();
                sectionIndex = 0;
            }
            sectionIndex++;
            String chapterId = documentId + ":chapter:" + section.chapterIndex();
            String sectionId = chapterId + ":section:" + sectionIndex;
            List<String> children = splitByLengthAtBoundary(section.content(), maxChunkSize);
            for (int childIndex = 0; childIndex < children.size(); childIndex++) {
                result.add(new HierarchicalChunk(documentId, chapterId, section.chapterTitle(), sectionId,
                        section.sectionTitle(), section.content(), sectionId + ":chunk:" + childIndex,
                        childIndex, children.get(childIndex)));
            }
        }
        return result;
    }

    private List<String> splitByHeadings(String text) {
        List<String> sections = new ArrayList<>();
        Matcher matcher = HEADING_PATTERN.matcher(text);
        int lastStart = 0;
        while (matcher.find()) {
            if (PAGE_HEADER_WITH_CHAPTER.matcher(matcher.group(1)).matches()) continue;
            if (matcher.start() > lastStart) sections.add(text.substring(lastStart, matcher.start()).trim());
            lastStart = matcher.start();
        }
        if (lastStart < text.length()) sections.add(text.substring(lastStart).trim());
        return sections.stream().filter(section -> !section.isBlank()).toList();
    }

    private String firstLine(String text) {
        int newline = text.indexOf('\n');
        return (newline < 0 ? text : text.substring(0, newline)).trim();
    }

    private HeadingKind headingKind(String heading) {
        Matcher matcher = HEADING_LINE.matcher(heading == null ? "" : heading);
        if (!matcher.matches() || PAGE_HEADER_WITH_CHAPTER.matcher(heading).matches()) return HeadingKind.NONE;
        String prefix = matcher.group(1).toLowerCase(Locale.ROOT);
        if (prefix.startsWith("chapter") || prefix.startsWith("unit")
                || prefix.startsWith("module") || prefix.startsWith("part")) return HeadingKind.CHAPTER;
        if (prefix.startsWith("section") || prefix.startsWith("lesson") || prefix.startsWith("slide")) return HeadingKind.SECTION;
        return prefix.contains(".") ? HeadingKind.SECTION : HeadingKind.CHAPTER;
    }

    private List<String> splitByLengthAtBoundary(String text, int maxChunkSize) {
        if (text.length() <= maxChunkSize) return List.of(text.trim());
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < text.length()) {
            int hardEnd = Math.min(start + maxChunkSize, text.length());
            int end = hardEnd;
            if (hardEnd < text.length()) {
                int sentence = Math.max(text.lastIndexOf(". ", hardEnd), text.lastIndexOf('\n', hardEnd));
                int space = text.lastIndexOf(' ', hardEnd);
                int boundary = sentence >= start + maxChunkSize / 2 ? sentence + 1 : space;
                if (boundary > start) end = boundary;
            }
            String child = text.substring(start, end).trim();
            if (!child.isBlank()) chunks.add(child);
            start = end;
            while (start < text.length() && Character.isWhitespace(text.charAt(start))) start++;
        }
        return chunks;
    }

    private List<String> splitByParagraphs(String text) {
        return List.of(text.split("\\R{2,}")).stream().map(String::trim)
                .filter(paragraph -> !paragraph.isBlank()).toList();
    }

    private List<String> fitChunkSize(List<String> sections, int maxChunkSize) {
        List<String> chunks = new ArrayList<>();
        StringBuilder buffer = new StringBuilder();
        for (String section : sections) {
            if (section.length() > maxChunkSize) {
                flushBuffer(chunks, buffer);
                chunks.addAll(splitByLength(section, maxChunkSize));
                continue;
            }
            if (buffer.length() + section.length() + 2 > maxChunkSize) flushBuffer(chunks, buffer);
            if (!buffer.isEmpty()) buffer.append("\n\n");
            buffer.append(section);
        }
        flushBuffer(chunks, buffer);
        return chunks;
    }

    private void flushBuffer(List<String> chunks, StringBuilder buffer) {
        if (!buffer.isEmpty()) {
            chunks.add(buffer.toString().trim());
            buffer.setLength(0);
        }
    }

    private List<String> splitByLength(String text, int maxChunkSize) {
        List<String> chunks = new ArrayList<>();
        for (int i = 0; i < text.length(); i += maxChunkSize) {
            chunks.add(text.substring(i, Math.min(i + maxChunkSize, text.length())).trim());
        }
        return chunks.stream().filter(chunk -> !chunk.isBlank()).toList();
    }

    private enum HeadingKind { CHAPTER, SECTION, NONE }
    private record HierarchySection(int chapterIndex, String chapterTitle, String sectionTitle, String content) {}
    private record TocPosition(MaterialTocEntry entry, int position) {}
    private record PageHierarchy(int chapterIndex, String chapterTitle, String sectionTitle) {
        String identity() { return chapterIndex + "|" + sectionTitle; }
    }
    public record HierarchicalChunk(String documentId, String chapterId, String chapterTitle,
                                    String sectionId, String sectionTitle, String parentContent,
                                    String chunkId, int chunkIndex, String content) {}
}
