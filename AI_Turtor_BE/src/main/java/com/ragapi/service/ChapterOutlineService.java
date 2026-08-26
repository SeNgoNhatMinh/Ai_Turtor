package com.ragapi.service;

import com.ragapi.dto.cotraining.ChapterOutlineView;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.dto.cotraining.ChapterSourceMaterialView;
import com.ragapi.dto.cotraining.ConfirmChaptersRequest;
import com.ragapi.dto.cotraining.ManualChapterRequest;
import com.ragapi.entity.CourseChapterOutline;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.entity.GoldQa;
import com.ragapi.entity.MaterialTocEntry;
import com.ragapi.repository.CourseChapterOutlineRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.repository.GoldQaRepository;
import com.ragapi.util.ChapterHeadingUtils;
import com.ragapi.util.ChapterKeyUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.ragapi.util.ValidationUtils.requireText;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChapterOutlineService {

    static final int MIN_CHUNKS_OK = 3;
    static final long MIN_CHARS_OK = 1500L;
    static final int PREVIEW_EXCERPT_LIMIT = 2500;
    static final int MENTOR_EXCERPT_LIMIT = 12000;
    static final int FULL_SECTION_EXCERPT_LIMIT = 250_000;
    static final String DETECTED_FROM_MATERIAL = "MATERIAL_TITLE";
    static final String DETECTED_FROM_BOOKMARK = "PDF_BOOKMARK";
    static final String DETECTED_FROM_HTML_SECTION = "HTML_SECTION";
    static final String DETECTED_FROM_MANUAL = "MANUAL";
    private static final Pattern HTML_SECTION_SPLIT = Pattern.compile("\\n\\n---+\\n\\n");
    private static final Pattern HTML_PAGE_TITLE = Pattern.compile("(?im)^Page title:\\s*(.+)$");
    private static final Pattern HTML_SOURCE_URL = Pattern.compile("(?im)^Source URL:\\s*(.+)$");

    private final CourseMaterialRepository materialRepository;
    private final CourseChapterOutlineRepository outlineRepository;
    private final CourseMaterialChunkingService chunkingService;
    private final GoldQaRepository goldQaRepository;
    private final PdfExtractionService pdfExtractionService;
    private final PdfStorageService pdfStorageService;
    private final HtmlSectionMediaService htmlSectionMediaService;

    public List<ChapterOutlineView> suggestChapters(String courseId) {
        String safeCourseId = requireText(courseId, "courseId");
        List<CourseChapterOutline> outlines = outlineRepository.findByCourseIdOrderByTitleAsc(safeCourseId);
        List<CourseChapterOutline> visible = outlines.stream()
                .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                .toList();
        // Rebuild when empty, noise-ignored, or HTML website import still collapsed to one title chapter.
        if (outlines.isEmpty() || visible.isEmpty() || needsHtmlSectionRebuild(safeCourseId, outlines)) {
            refreshOutlinesForCourse(safeCourseId);
            outlines = outlineRepository.findByCourseIdOrderByTitleAsc(safeCourseId);
            visible = outlines.stream()
                    .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                    .toList();
        }
        return toViews(safeCourseId, visible);
    }

    /** Force rebuild chapter outlines from indexed materials (PDF bookmarks + HTML URL sections). */
    public List<ChapterOutlineView> refreshChapters(String courseId) {
        String safeCourseId = requireText(courseId, "courseId");
        refreshOutlinesForCourse(safeCourseId);
        List<CourseChapterOutline> visible = outlineRepository.findByCourseIdOrderByTitleAsc(safeCourseId).stream()
                .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                .toList();
        return toViews(safeCourseId, visible);
    }

    /**
     * Rebuild outlines for every course that has indexed HTML_URL materials.
     * Used after website-import TOC fixes so Senior Mục lục catches up without re-upload.
     */
    public Map<String, Object> refreshAllHtmlCourseChapters() {
        Set<String> courseIds = new LinkedHashSet<>();
        for (CourseMaterial material : materialRepository.findBySourceType("HTML_URL")) {
            if (!"INDEXED".equalsIgnoreCase(material.getIndexingStatus())) {
                continue;
            }
            if (material.getCourseId() == null || material.getCourseId().isBlank()) {
                continue;
            }
            if (!hasHtmlSectionMarkers(material.getContent())) {
                continue;
            }
            courseIds.add(material.getCourseId().trim());
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (String courseId : courseIds) {
            List<ChapterOutlineView> chapters = refreshChapters(courseId);
            long htmlSections = chapters.stream()
                    .filter(c -> DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(c.getDetectedFrom()))
                    .count();
            results.add(Map.of(
                    "courseId", courseId,
                    "chapterCount", chapters.size(),
                    "htmlSectionCount", htmlSections
            ));
        }
        return Map.of(
                "courseCount", courseIds.size(),
                "courses", results
        );
    }

    private boolean needsHtmlSectionRebuild(String courseId, List<CourseChapterOutline> outlines) {
        List<CourseMaterial> htmlMaterials = materialRepository.findByCourseId(courseId).stream()
                .filter(m -> "INDEXED".equalsIgnoreCase(m.getIndexingStatus()))
                .filter(m -> isHtmlUrlMaterial(m) && hasHtmlSectionMarkers(m.getContent()))
                .toList();
        if (htmlMaterials.isEmpty()) {
            return false;
        }
        long sectionOutlines = outlines.stream()
                .filter(o -> DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(o.getDetectedFrom()))
                .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                .count();
        if (sectionOutlines == 0) {
            return true;
        }
        int importedPages = htmlMaterials.stream()
                .mapToInt(m -> m.getImportedPageCount() == null ? 0 : Math.max(0, m.getImportedPageCount()))
                .sum();
        // Oracle-style docs reuse the chapter H1 for every subsection; under-split until we
        // expand titles with URL fragments.
        return importedPages > 1 && importedPages > sectionOutlines * 2;
    }

    public List<ChapterOutlineView> confirmChapters(ConfirmChaptersRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String courseId = requireText(request.getCourseId(), "courseId");
        Set<String> selected = request.getChapterKeys() == null
                ? Set.of()
                : request.getChapterKeys().stream()
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .filter(key -> !key.isBlank())
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        refreshOutlinesForCourse(courseId);
        LocalDateTime now = LocalDateTime.now();
        for (CourseChapterOutline outline : outlineRepository.findByCourseIdOrderByTitleAsc(courseId)) {
            if (selected.contains(outline.getChapterKey())) {
                outline.setStatus("CONFIRMED");
                outline.setConfirmedBy(request.getConfirmedBy());
                outline.setConfirmedAt(now);
            } else if ("CONFIRMED".equalsIgnoreCase(outline.getStatus())) {
                outline.setStatus("SUGGESTED");
                outline.setConfirmedBy(null);
                outline.setConfirmedAt(null);
            }
            outline.setUpdatedAt(now);
            outlineRepository.save(outline);
        }
        return toViews(courseId, outlineRepository.findByCourseIdAndStatusOrderByTitleAsc(courseId, "CONFIRMED"));
    }

    public ChapterOutlineView addManualChapter(ManualChapterRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String courseId = requireText(request.getCourseId(), "courseId");
        String title = requireText(request.getTitle(), "title");
        String key = ChapterKeyUtils.toChapterKey(title);
        LocalDateTime now = LocalDateTime.now();
        boolean confirm = request.getConfirmImmediately() == null || request.getConfirmImmediately();
        CourseChapterOutline outline = outlineRepository.findByCourseIdAndChapterKey(courseId, key).orElse(null);
        if (outline == null) {
            outline = CourseChapterOutline.builder()
                    .courseId(courseId)
                    .chapterKey(key)
                    .title(title.trim())
                    .status(confirm ? "CONFIRMED" : "SUGGESTED")
                    .detectedFrom(DETECTED_FROM_MANUAL)
                    .sourceMaterialIds(new ArrayList<>())
                    .chunkCount(0)
                    .approxChars(0L)
                    .updatedAt(now)
                    .build();
        } else {
            outline.setTitle(title.trim());
            outline.setDetectedFrom(DETECTED_FROM_MANUAL);
            if (confirm) {
                outline.setStatus("CONFIRMED");
            }
            outline.setUpdatedAt(now);
        }
        if (confirm) {
            outline.setConfirmedBy(request.getCreatedBy());
            outline.setConfirmedAt(now);
        }
        outlineRepository.save(outline);
        return toView(outline);
    }

    public ChapterOutlineView ignoreChapter(String courseId, String chapterKey) {
        String safeCourseId = requireText(courseId, "courseId");
        String safeKey = requireText(chapterKey, "chapterKey");
        CourseChapterOutline outline = outlineRepository.findByCourseIdAndChapterKey(safeCourseId, safeKey)
                .orElseThrow(() -> new IllegalArgumentException("Chapter outline not found"));
        outline.setStatus("IGNORED");
        outline.setUpdatedAt(LocalDateTime.now());
        outlineRepository.save(outline);
        return toView(outline);
    }

    public ChapterPreviewView previewChapter(String courseId, String chapterKey) {
        return previewChapter(courseId, chapterKey, false);
    }

    public ChapterPreviewView previewChapterByTitle(String courseId, String chapterTitle, boolean expanded) {
        String safeCourseId = requireText(courseId, "courseId");
        String safeTitle = requireText(chapterTitle, "chapter");
        CourseChapterOutline outline = findOutlineByTitle(safeCourseId, safeTitle);
        if (outline == null) {
            refreshOutlinesForCourse(safeCourseId);
            outline = findOutlineByTitle(safeCourseId, safeTitle);
        }
        if (outline == null) {
            return ChapterPreviewView.builder()
                    .courseId(safeCourseId)
                    .chapterKey(ChapterKeyUtils.toChapterKey(safeTitle))
                    .title(safeTitle.trim())
                    .detectedFrom("UNKNOWN")
                    .materialHealth("NO_MATERIAL")
                    .hasMaterialContent(false)
                    .excerpt("")
                    .sourceMaterials(List.of())
                    .build();
        }
        return previewChapter(safeCourseId, outline.getChapterKey(), expanded);
    }

    public ChapterPreviewView previewChapter(String courseId, String chapterKey, boolean expanded) {
        String safeCourseId = requireText(courseId, "courseId");
        String safeKey = requireText(chapterKey, "chapterKey");
        CourseChapterOutline found = outlineRepository.findByCourseIdAndChapterKey(safeCourseId, safeKey)
                .orElse(null);
        if (found == null) {
            refreshOutlinesForCourse(safeCourseId);
            found = outlineRepository.findByCourseIdAndChapterKey(safeCourseId, safeKey)
                    .orElseThrow(() -> new IllegalArgumentException("Chapter outline not found"));
        }
        final CourseChapterOutline outline = found;

        int indexedCount = (int) materialRepository.countByCourseIdAndIndexingStatus(safeCourseId, "INDEXED");

        List<ChapterSourceMaterialView> sources = new ArrayList<>();
        StringBuilder excerpt = new StringBuilder();
        boolean fullSectionRequested = expanded;
        int excerptLimit = fullSectionRequested ? MENTOR_EXCERPT_LIMIT : PREVIEW_EXCERPT_LIMIT;
        List<String> materialIds = outline.getSourceMaterialIds() == null ? List.of() : outline.getSourceMaterialIds();

        for (String materialId : materialIds) {
            materialRepository.findById(materialId).ifPresent(material -> {
                sources.add(ChapterSourceMaterialView.builder()
                        .id(material.getId())
                        .title(material.getTitle())
                        .sourceType(material.getSourceType())
                        .indexingStatus(material.getIndexingStatus())
                        .build());
                appendExcerptForOutline(outline, material, excerpt, excerptLimit, fullSectionRequested);
            });
        }

        if (excerpt.isEmpty() && materialIds.isEmpty()) {
            materialRepository.findByCourseId(safeCourseId).stream()
                    .filter(m -> "INDEXED".equalsIgnoreCase(m.getIndexingStatus()))
                    .filter(m -> m.getContent() != null && !m.getContent().isBlank())
                    .forEach(material -> appendExcerptForOutline(outline, material, excerpt, excerptLimit, fullSectionRequested));
        }

        String rawExcerpt = excerpt.toString().trim();
        String excerptText = fullSectionRequested ? rawExcerpt : trimExcerpt(rawExcerpt, excerptLimit);
        boolean excerptTruncated = !fullSectionRequested && rawExcerpt.length() > excerptText.length();
        boolean fromMaterial = isIndexedMaterialSource(outline.getDetectedFrom());
        String primarySourceMaterialId = resolvePrimarySourceMaterialId(materialIds, sources);

        String sourcePageUrl = null;
        List<String> imageUrls = List.of();
        if (DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(outline.getDetectedFrom())
                || sources.stream().anyMatch(s -> s.getSourceType() != null
                && s.getSourceType().toUpperCase().contains("HTML"))) {
            HtmlSectionMediaService.SectionMedia media = htmlSectionMediaService.resolveFromStoredSection(rawExcerpt);
            sourcePageUrl = media.sourcePageUrl();
            imageUrls = media.imageUrls();
        }

        int pageStart = outline.getPageStart() == null ? 0 : outline.getPageStart();
        int pageEnd = outline.getPageEnd() == null ? 0 : outline.getPageEnd();
        if (pageStart <= 0) {
            int[] pdfPages = resolveDefaultPdfPreviewPages(materialIds);
            pageStart = pdfPages[0];
            pageEnd = pdfPages[1];
        }

        return ChapterPreviewView.builder()
                .courseId(safeCourseId)
                .chapterKey(outline.getChapterKey())
                .title(outline.getTitle())
                .status(outline.getStatus())
                .detectedFrom(outline.getDetectedFrom())
                .materialHealth(materialHealth(outline, indexedCount))
                .chunkCount(outline.getChunkCount() == null ? 0 : outline.getChunkCount())
                .approxChars(outline.getApproxChars() == null ? 0L : outline.getApproxChars())
                .excerpt(excerptText)
                .excerptTruncated(excerptTruncated)
                .excerptTotalChars(rawExcerpt.length())
                .hasMaterialContent(fromMaterial && !excerptText.isBlank())
                .pageStart(pageStart)
                .pageEnd(pageEnd)
                .primarySourceMaterialId(primarySourceMaterialId)
                .sourcePageUrl(sourcePageUrl)
                .imageUrls(imageUrls)
                .sourceMaterials(sources)
                .build();
    }

    private int[] resolveDefaultPdfPreviewPages(List<String> materialIds) {
        if (materialIds == null) {
            return new int[]{0, 0};
        }
        for (String materialId : materialIds) {
            if (materialId == null || materialId.isBlank()) {
                continue;
            }
            CourseMaterial material = materialRepository.findById(materialId.trim()).orElse(null);
            if (material == null || material.getPdfFileId() == null || material.getPdfFileId().isBlank()) {
                continue;
            }
            int total = material.getPageCount() == null ? 0 : material.getPageCount();
            if (total <= 0) {
                total = 5;
            }
            return new int[]{1, Math.min(5, total)};
        }
        return new int[]{0, 0};
    }

    private static String resolvePrimarySourceMaterialId(List<String> materialIds, List<ChapterSourceMaterialView> sources) {
        if (materialIds != null) {
            for (String materialId : materialIds) {
                if (materialId != null && !materialId.isBlank()) {
                    return materialId.trim();
                }
            }
        }
        if (sources == null || sources.isEmpty()) {
            return "";
        }
        return sources.get(0).getId() == null ? "" : sources.get(0).getId();
    }

    public List<String> resolveChapterTitlesForAnalysis(String courseId, List<String> explicitChapters) {
        if (explicitChapters != null && !explicitChapters.isEmpty()) {
            return explicitChapters.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(v -> !v.isBlank())
                    .distinct()
                    .toList();
        }
        refreshOutlinesForCourse(courseId);
        List<CourseChapterOutline> confirmed = outlineRepository.findByCourseIdAndStatusOrderByTitleAsc(courseId, "CONFIRMED");
        if (!confirmed.isEmpty()) {
            return confirmed.stream().map(CourseChapterOutline::getTitle).toList();
        }
        return outlineRepository.findByCourseIdOrderByTitleAsc(courseId).stream()
                .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                .map(CourseChapterOutline::getTitle)
                .distinct()
                .toList();
    }

    public CourseChapterOutline findOutlineByTitle(String courseId, String chapterTitle) {
        if (chapterTitle == null || chapterTitle.isBlank()) {
            return null;
        }
        String key = ChapterKeyUtils.toChapterKey(chapterTitle);
        return outlineRepository.findByCourseIdAndChapterKey(courseId, key).orElse(null);
    }

    public String materialHealth(CourseChapterOutline outline, int courseIndexedMaterialCount) {
        if (courseIndexedMaterialCount <= 0 || outline == null) {
            return "NO_MATERIAL";
        }
        int chunks = outline.getChunkCount() == null ? 0 : outline.getChunkCount();
        long chars = outline.getApproxChars() == null ? 0L : outline.getApproxChars();
        if (chunks <= 0 && chars <= 0) {
            return "NO_MATERIAL";
        }
        if (chunks < MIN_CHUNKS_OK || chars < MIN_CHARS_OK) {
            return "MATERIAL_THIN";
        }
        return "MATERIAL_OK";
    }

    public void refreshOutlinesForCourse(String courseId) {
        List<CourseMaterial> indexed = materialRepository.findByCourseId(courseId).stream()
                .filter(m -> "INDEXED".equalsIgnoreCase(m.getIndexingStatus()))
                .filter(m -> m.getContent() != null && !m.getContent().isBlank())
                .toList();

        Map<String, AggregatedChapter> aggregated = new LinkedHashMap<>();
        for (CourseMaterial material : indexed) {
            ensureTableOfContents(material);
            ingestMaterial(material, aggregated);
        }

        LocalDateTime now = LocalDateTime.now();
        for (AggregatedChapter chapter : aggregated.values()) {
            CourseChapterOutline existing = outlineRepository
                    .findByCourseIdAndChapterKey(courseId, chapter.chapterKey)
                    .orElse(null);

            if (existing == null) {
                outlineRepository.save(CourseChapterOutline.builder()
                        .courseId(courseId)
                        .chapterKey(chapter.chapterKey)
                        .title(chapter.title)
                        .status("SUGGESTED")
                        .detectedFrom(chapter.detectedFrom)
                        .sourceMaterialIds(new ArrayList<>(chapter.materialIds))
                        .tocLevel(chapter.tocLevel)
                        .pageStart(chapter.pageStart)
                        .pageEnd(chapter.pageEnd)
                        .chunkCount(chapter.chunkCount)
                        .approxChars(chapter.approxChars)
                        .updatedAt(now)
                        .build());
                continue;
            }

            if ("IGNORED".equalsIgnoreCase(existing.getStatus())) {
                continue;
            }

            if (!"CONFIRMED".equalsIgnoreCase(existing.getStatus())) {
                existing.setTitle(chapter.title);
                existing.setDetectedFrom(chapter.detectedFrom);
            }
            existing.setSourceMaterialIds(new ArrayList<>(chapter.materialIds));
            existing.setTocLevel(chapter.tocLevel);
            existing.setPageStart(chapter.pageStart);
            existing.setPageEnd(chapter.pageEnd);
            existing.setChunkCount(chapter.chunkCount);
            existing.setApproxChars(chapter.approxChars);
            existing.setUpdatedAt(now);
            outlineRepository.save(existing);
        }

        markNoiseAndStaleOutlinesIgnored(courseId, aggregated.keySet(), now);
    }

    private void ensureTableOfContents(CourseMaterial material) {
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

    private void markNoiseAndStaleOutlinesIgnored(String courseId, Set<String> activeKeys, LocalDateTime now) {
        for (CourseChapterOutline existing : outlineRepository.findByCourseIdOrderByTitleAsc(courseId)) {
            if ("CONFIRMED".equalsIgnoreCase(existing.getStatus())
                    || DETECTED_FROM_MANUAL.equalsIgnoreCase(existing.getDetectedFrom())) {
                continue;
            }
            boolean stale = !activeKeys.contains(existing.getChapterKey());
            boolean legacyHeading = "HEADING".equalsIgnoreCase(existing.getDetectedFrom());
            boolean skipNoiseFilter = DETECTED_FROM_MATERIAL.equalsIgnoreCase(existing.getDetectedFrom())
                    || DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(existing.getDetectedFrom())
                    || DETECTED_FROM_BOOKMARK.equalsIgnoreCase(existing.getDetectedFrom());
            boolean noise = legacyHeading
                    || (!skipNoiseFilter && !ChapterHeadingUtils.isPlausibleChapterTitle(existing.getTitle()));
            if (stale || noise) {
                existing.setStatus("IGNORED");
                existing.setUpdatedAt(now);
                outlineRepository.save(existing);
            }
        }
    }

    private void ingestMaterial(CourseMaterial material, Map<String, AggregatedChapter> aggregated) {
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

        String title = firstNonBlank(material.getTitle(), material.getCategory(), "General");
        int chunks = chunkingService.chunk(content).size();
        mergeChapter(aggregated, title, DETECTED_FROM_MATERIAL, material.getId(), chunks, content.length(), null, null, null);
    }

    private static boolean isHtmlUrlMaterial(CourseMaterial material) {
        String sourceType = material.getSourceType() == null ? "" : material.getSourceType().trim().toUpperCase();
        return "HTML_URL".equals(sourceType) || sourceType.contains("HTML");
    }

    private static boolean hasHtmlSectionMarkers(String content) {
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
                    DETECTED_FROM_HTML_SECTION,
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
            mergeChapter(aggregated, title, DETECTED_FROM_MATERIAL, material.getId(), chunks, content.length(), null, null, null);
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
                    DETECTED_FROM_BOOKMARK,
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

    private void appendExcerptForOutline(
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

        if (DETECTED_FROM_BOOKMARK.equalsIgnoreCase(outline.getDetectedFrom())
                || DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(outline.getDetectedFrom())) {
            String sectionText = DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(outline.getDetectedFrom())
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
        int index = indexOfIgnoreCase(content, title);
        if (index < 0) {
            return "";
        }
        int start = Math.max(0, index);
        int nextHeading = findNextSectionStart(content, start + title.length());
        if (nextHeading > start) {
            return content.substring(start, nextHeading).trim();
        }
        return content.substring(start).trim();
    }

    private static int indexOfIgnoreCase(String content, String title) {
        String lowerContent = content.toLowerCase();
        String lowerTitle = title.toLowerCase();
        return lowerContent.indexOf(lowerTitle);
    }

    private static int findNextSectionStart(String content, int fromIndex) {
        if (fromIndex >= content.length()) {
            return content.length();
        }
        String tail = content.substring(fromIndex);
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("(?m)^(?:Chapter\\s+\\d+|\\d+(?:\\.\\d+)+\\s+\\p{L}).{0,80}$")
                .matcher(tail);
        if (matcher.find()) {
            return fromIndex + matcher.start();
        }
        return content.length();
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

    private String trimExcerpt(String excerpt, int limit) {
        if (excerpt == null || excerpt.isBlank()) {
            return "";
        }
        if (excerpt.length() <= limit) {
            return excerpt;
        }
        return excerpt.substring(0, limit).trim() + "...";
    }

    private List<ChapterOutlineView> toViews(String courseId, List<CourseChapterOutline> outlines) {
        int indexedCount = (int) materialRepository.countByCourseIdAndIndexingStatus(courseId, "INDEXED");
        Map<String, int[]> goldCounts = goldCountsByChapter(courseId);
        return outlines.stream()
                .map(outline -> toView(outline, indexedCount, goldCounts))
                .toList();
    }

    private Map<String, int[]> goldCountsByChapter(String courseId) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        for (GoldQa gold : goldQaRepository.findByCourseIdOrderByCreatedAtDesc(courseId)) {
            if (gold.getChapter() == null || gold.getChapter().isBlank()) {
                continue;
            }
            int[] pair = counts.computeIfAbsent(gold.getChapter(), ignored -> new int[2]);
            if ("EVALUATION".equalsIgnoreCase(gold.getUsage())) {
                pair[1]++;
            } else if ("TRAINING".equalsIgnoreCase(gold.getUsage())) {
                pair[0]++;
            }
        }
        return counts;
    }

    private ChapterOutlineView toView(CourseChapterOutline outline) {
        int indexedCount = (int) materialRepository.countByCourseIdAndIndexingStatus(outline.getCourseId(), "INDEXED");
        return toView(outline, indexedCount, goldCountsByChapter(outline.getCourseId()));
    }

    private ChapterOutlineView toView(
            CourseChapterOutline outline,
            int indexedCount,
            Map<String, int[]> goldCounts
    ) {
        int[] pair = goldCounts.getOrDefault(outline.getTitle(), new int[2]);
        return ChapterOutlineView.builder()
                .id(outline.getId())
                .courseId(outline.getCourseId())
                .chapterKey(outline.getChapterKey())
                .title(outline.getTitle())
                .status(outline.getStatus())
                .detectedFrom(outline.getDetectedFrom())
                .sourceMaterialIds(outline.getSourceMaterialIds() == null ? List.of() : outline.getSourceMaterialIds())
                .chunkCount(outline.getChunkCount() == null ? 0 : outline.getChunkCount())
                .approxChars(outline.getApproxChars() == null ? 0L : outline.getApproxChars())
                .materialHealth(materialHealth(outline, indexedCount))
                .trainingGoldCount(pair[0])
                .evaluationGoldCount(pair[1])
                .tocLevel(outline.getTocLevel() == null ? 0 : outline.getTocLevel())
                .pageStart(outline.getPageStart() == null ? 0 : outline.getPageStart())
                .pageEnd(outline.getPageEnd() == null ? 0 : outline.getPageEnd())
                .primarySourceMaterialId(resolvePrimarySourceMaterialId(
                        outline.getSourceMaterialIds() == null ? List.of() : outline.getSourceMaterialIds(),
                        List.of()))
                .build();
    }

    private static boolean isIndexedMaterialSource(String detectedFrom) {
        return DETECTED_FROM_MATERIAL.equalsIgnoreCase(detectedFrom)
                || DETECTED_FROM_BOOKMARK.equalsIgnoreCase(detectedFrom)
                || DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(detectedFrom);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "General";
    }

    private static final class AggregatedChapter {
        private final String chapterKey;
        private final String title;
        private final String detectedFrom;
        private final Integer tocLevel;
        private final Integer pageStart;
        private final Integer pageEnd;
        private final Set<String> materialIds = new LinkedHashSet<>();
        private int chunkCount;
        private long approxChars;

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
