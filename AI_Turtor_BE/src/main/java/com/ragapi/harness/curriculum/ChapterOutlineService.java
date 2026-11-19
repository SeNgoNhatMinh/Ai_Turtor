package com.ragapi.harness.curriculum;
import static com.ragapi.util.ValidationUtils.requireText;
import com.ragapi.service.course.HtmlSectionMediaService;

import com.ragapi.dto.cotraining.ChapterOutlineView;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.dto.cotraining.ChapterSourceMaterialView;
import com.ragapi.dto.cotraining.ConfirmChaptersRequest;
import com.ragapi.dto.cotraining.ManualChapterRequest;
import com.ragapi.harness.entity.CourseChapterOutline;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.harness.entity.GoldQa;
import com.ragapi.harness.repository.CourseChapterOutlineRepository;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.harness.repository.GoldQaRepository;
import com.ragapi.harness.util.ChapterHeadingUtils;
import com.ragapi.harness.util.ChapterKeyUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;


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

    private final CourseMaterialRepository materialRepository;
    private final CourseChapterOutlineRepository outlineRepository;
    private final GoldQaRepository goldQaRepository;
    private final HtmlSectionMediaService htmlSectionMediaService;
    private final ChapterOutlineReader outlineReader;
    private final CourseChapterExcerptCache chapterExcerptCache;

    /**
     * Read persisted chapter outlines for chat-time grounding.
     *
     * Rebuilding outlines may scan every indexed material and extract PDF bookmarks.
     * Keep that work in the indexing/explicit-refresh flows, not on every chat turn.
     * If there are no visible outlines, callers can fall back to indexed retrieval.
     */
    public List<ChapterOutlineView> suggestChapters(String courseId) {
        String safeCourseId = requireText(courseId, "courseId");
        List<CourseChapterOutline> outlines = outlineRepository.findByCourseIdOrderByTitleAsc(safeCourseId);
        List<CourseChapterOutline> visible = outlines.stream()
                .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                .sorted(DOCUMENT_ORDER)
                .toList();
        return toViews(safeCourseId, visible);
    }

    /** Force rebuild chapter outlines from indexed materials (PDF bookmarks + HTML URL sections). */
    public List<ChapterOutlineView> refreshChapters(String courseId) {
        String safeCourseId = requireText(courseId, "courseId");
        refreshOutlinesForCourse(safeCourseId);
        List<CourseChapterOutline> visible = outlineRepository.findByCourseIdOrderByTitleAsc(safeCourseId).stream()
                .filter(o -> !"IGNORED".equalsIgnoreCase(o.getStatus()))
                .sorted(DOCUMENT_ORDER)
                .toList();
        return toViews(safeCourseId, visible);
    }

    /** Document order: page → TOC level → natural chapter title (Chapter 2 before Chapter 10). */
    private static final Comparator<CourseChapterOutline> DOCUMENT_ORDER = Comparator
            .comparingInt(ChapterOutlineService::orderPage)
            .thenComparingInt(ChapterOutlineService::orderTocLevel)
            .thenComparing(outline -> outline.getTitle() == null ? "" : outline.getTitle(),
                    ChapterOutlineService::compareNaturalTitle);

    private static int orderPage(CourseChapterOutline outline) {
        Integer page = outline.getPageStart();
        return page == null || page <= 0 ? Integer.MAX_VALUE : page;
    }

    private static int orderTocLevel(CourseChapterOutline outline) {
        Integer level = outline.getTocLevel();
        return level == null || level < 0 ? 0 : level;
    }

    static int compareNaturalTitle(String left, String right) {
        String a = left == null ? "" : left;
        String b = right == null ? "" : right;
        int i = 0;
        int j = 0;
        while (i < a.length() && j < b.length()) {
            char ca = a.charAt(i);
            char cb = b.charAt(j);
            if (Character.isDigit(ca) && Character.isDigit(cb)) {
                int startA = i;
                int startB = j;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                String numA = a.substring(startA, i).replaceFirst("^0+(?!$)", "");
                String numB = b.substring(startB, j).replaceFirst("^0+(?!$)", "");
                int lenCmp = Integer.compare(numA.length(), numB.length());
                if (lenCmp != 0) return lenCmp;
                int numCmp = numA.compareTo(numB);
                if (numCmp != 0) return numCmp;
                continue;
            }
            int charCmp = Character.compare(
                    Character.toLowerCase(ca),
                    Character.toLowerCase(cb));
            if (charCmp != 0) return charCmp;
            i++;
            j++;
        }
        return Integer.compare(a.length() - i, b.length() - j);
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
            if (!ChapterOutlineReader.hasHtmlSectionMarkers(material.getContent())) {
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
        if (found == null && expanded) {
            CourseChapterExcerptCache.ChapterExcerpt cached = chapterExcerptCache.find(safeCourseId, safeKey).orElse(null);
            if (cached != null && cached.text() != null && !cached.text().isBlank()) {
                CourseChapterOutline synthetic = CourseChapterOutline.builder()
                        .courseId(safeCourseId)
                        .chapterKey(cached.chapterKey())
                        .title(cached.title())
                        .detectedFrom(DETECTED_FROM_MATERIAL)
                        .sourceMaterialIds(cached.materialId() == null || cached.materialId().isBlank()
                                ? List.of()
                                : List.of(cached.materialId()))
                        .build();
                return previewFromStoredExcerpt(synthetic, cached.text(), 1);
            }
        }
        if (found == null) {
            refreshOutlinesForCourse(safeCourseId);
            found = outlineRepository.findByCourseIdAndChapterKey(safeCourseId, safeKey)
                    .orElseThrow(() -> new IllegalArgumentException("Chapter outline not found"));
        }
        final CourseChapterOutline outline = found;

        int indexedCount = (int) materialRepository.countByCourseIdAndIndexingStatus(safeCourseId, "INDEXED");
        if (expanded && chapterExcerptCache.isLoaded(safeCourseId)) {
            String cachedExcerpt = chapterExcerptCache.excerpt(safeCourseId, safeKey).orElse(null);
            if (cachedExcerpt != null) {
                return previewFromStoredExcerpt(outline, cachedExcerpt, indexedCount);
            }
            return ChapterPreviewView.builder()
                    .courseId(safeCourseId)
                    .chapterKey(outline.getChapterKey())
                    .title(outline.getTitle())
                    .status(outline.getStatus())
                    .detectedFrom(outline.getDetectedFrom())
                    .excerpt("")
                    .hasMaterialContent(false)
                    .sourceMaterials(List.of())
                    .imageUrls(List.of())
                    .build();
        }
        if (expanded && outline.getMentorExcerpt() != null && !outline.getMentorExcerpt().isBlank()) {
            return previewFromStoredExcerpt(outline, outline.getMentorExcerpt(), indexedCount);
        }

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
                outlineReader.appendExcerptForOutline(outline, material, excerpt, excerptLimit, fullSectionRequested);
            });
        }

        if (excerpt.isEmpty() && materialIds.isEmpty()) {
            materialRepository.findByCourseId(safeCourseId).stream()
                    .filter(m -> "INDEXED".equalsIgnoreCase(m.getIndexingStatus()))
                    .filter(m -> m.getContent() != null && !m.getContent().isBlank())
                    .forEach(material -> outlineReader.appendExcerptForOutline(outline, material, excerpt, excerptLimit, fullSectionRequested));
        }

        String rawExcerpt = excerpt.toString().trim();
        String excerptText = fullSectionRequested ? rawExcerpt : outlineReader.trimExcerpt(rawExcerpt, excerptLimit);
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

        if (expanded && !excerptText.isBlank()) {
            String stored = excerptText.length() > MENTOR_EXCERPT_LIMIT
                    ? excerptText.substring(0, MENTOR_EXCERPT_LIMIT).trim()
                    : excerptText;
            outline.setMentorExcerpt(stored);
            outlineRepository.save(outline);
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

    private ChapterPreviewView previewFromStoredExcerpt(
            CourseChapterOutline outline,
            String excerptText,
            int indexedCount
    ) {
        List<String> materialIds = outline.getSourceMaterialIds() == null ? List.of() : outline.getSourceMaterialIds();
        List<ChapterSourceMaterialView> sources = new ArrayList<>();
        for (String materialId : materialIds) {
            materialRepository.findOneByIdWithoutContent(materialId).ifPresent(material -> sources.add(
                    ChapterSourceMaterialView.builder()
                            .id(material.getId())
                            .title(material.getTitle())
                            .sourceType(material.getSourceType())
                            .indexingStatus(material.getIndexingStatus())
                            .build()));
        }
        excerptText = excerptText == null ? "" : excerptText.trim();
        boolean fromMaterial = isIndexedMaterialSource(outline.getDetectedFrom());
        String primarySourceMaterialId = resolvePrimarySourceMaterialId(materialIds, sources);
        String sourcePageUrl = null;
        List<String> imageUrls = List.of();
        if (DETECTED_FROM_HTML_SECTION.equalsIgnoreCase(outline.getDetectedFrom())
                || sources.stream().anyMatch(source -> source.getSourceType() != null
                && source.getSourceType().toUpperCase().contains("HTML"))) {
            HtmlSectionMediaService.SectionMedia media = htmlSectionMediaService.resolveFromStoredSection(excerptText);
            sourcePageUrl = media.sourcePageUrl();
            imageUrls = media.imageUrls();
        }
        int pageStart = outline.getPageStart() == null ? 0 : outline.getPageStart();
        int pageEnd = outline.getPageEnd() == null ? 0 : outline.getPageEnd();
        return ChapterPreviewView.builder()
                .courseId(outline.getCourseId())
                .chapterKey(outline.getChapterKey())
                .title(outline.getTitle())
                .status(outline.getStatus())
                .detectedFrom(outline.getDetectedFrom())
                .materialHealth(materialHealth(outline, indexedCount))
                .chunkCount(outline.getChunkCount() == null ? 0 : outline.getChunkCount())
                .approxChars(outline.getApproxChars() == null ? 0L : outline.getApproxChars())
                .excerpt(excerptText)
                .excerptTruncated(false)
                .excerptTotalChars(excerptText.length())
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
        chapterExcerptCache.evictCourse(courseId);
        List<CourseMaterial> indexed = materialRepository.findByCourseId(courseId).stream()
                .filter(m -> "INDEXED".equalsIgnoreCase(m.getIndexingStatus()))
                .filter(m -> m.getContent() != null && !m.getContent().isBlank())
                .toList();

        Map<String, ChapterOutlineReader.AggregatedChapter> aggregated = new LinkedHashMap<>();
        for (CourseMaterial material : indexed) {
            outlineReader.ensureTableOfContents(material);
            outlineReader.ingestMaterial(material, aggregated);
        }

        LocalDateTime now = LocalDateTime.now();
        for (ChapterOutlineReader.AggregatedChapter chapter : aggregated.values()) {
            CourseChapterOutline existing = outlineRepository
                    .findByCourseIdAndChapterKey(courseId, chapter.chapterKey)
                    .orElse(null);

            if (existing == null) {
                CourseChapterOutline created = CourseChapterOutline.builder()
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
                        .build();
                created.setMentorExcerpt(excerptFor(created, indexed));
                outlineRepository.save(created);
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
            existing.setMentorExcerpt(excerptFor(existing, indexed));
            existing.setUpdatedAt(now);
            outlineRepository.save(existing);
        }

        markNoiseAndStaleOutlinesIgnored(courseId, aggregated.keySet(), now);
    }

    private String excerptFor(CourseChapterOutline outline, List<CourseMaterial> materials) {
        StringBuilder excerpt = new StringBuilder();
        for (CourseMaterial material : materials) {
            outlineReader.appendExcerptForOutline(outline, material, excerpt, MENTOR_EXCERPT_LIMIT, true);
        }
        if (excerpt.isEmpty()) {
            return null;
        }
        String text = excerpt.toString().trim();
        return text.length() > MENTOR_EXCERPT_LIMIT
                ? text.substring(0, MENTOR_EXCERPT_LIMIT).trim()
                : text;
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

    static String resolveHtmlSectionTitle(String pageTitle, String sourceUrl, int index) {
        return ChapterOutlineReader.resolveHtmlSectionTitle(pageTitle, sourceUrl, index);
    }

    static String extractHtmlSectionByTitle(String content, String title) {
        return ChapterOutlineReader.extractHtmlSectionByTitle(content, title);
    }

    static String extractSectionByTitle(String content, String title) {
        return ChapterOutlineReader.extractSectionByTitle(content, title);
    }
}
