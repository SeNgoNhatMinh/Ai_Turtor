package com.ragapi.harness.answer.context;

import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.cotraining.ChapterPreviewView;
import com.ragapi.dto.cotraining.ChapterSourceMaterialView;
import com.ragapi.entity.CourseMaterial;
import com.ragapi.harness.curriculum.ChapterOutlineService;
import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.retrieval.CourseSearchContextLimitService;
import com.ragapi.service.course.CourseMaterialChunkingService;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import java.util.List;

/** Lesson preview, improve-plan excerpts, and the teaching note for one answer. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseLessonContextService {

    private final CourseMaterialStoreGateway materialRepository;
    private final ChapterOutlineService chapterOutlineService;
    private final CourseMaterialChunkingService chunkingService;
    private final CourseSearchContextLimitService contextLimitService;

    private static final Pattern NUMBERED_LESSON_TITLE = Pattern.compile(
            "(?iu)(?:bắt đầu\\s+|bat dau\\s+|đào sâu\\s+|dao sau\\s+)?(?:bài|bai)\\s+\\d+\\s*[:：.\\-–—]\\s*(.+)"
    );
    private static final int LARGE_MATERIAL_CHARS = 24_000;
    private static final int EXCERPT_RADIUS = 700;
    private static final int MAX_GROUNDED_CHARS = 2_000;
    private static final Set<String> STOP_WORDS = Set.of(
            "la", "gi", "gì", "cua", "của", "cho", "em", "anh", "chi", "chị",
            "the", "thế", "nao", "nào", "hay", "giai", "giải", "thich", "thích",
            "explain", "what", "is", "a", "an", "and", "or", "in", "on",
            "of", "to", "with", "about", "please", "help"
    );

    public List<RetrievedCourseChunk> retrieveImprovePlanChunks(
            RagQueryIntent ragQueryIntent,
            String courseId,
            String classId
    ) {
        return retrieve(ragQueryIntent, courseId, classId);
    }

    public ChapterPreviewView resolveLessonPreview(
            String question,
            String courseId,
            RagQueryIntent ragQueryIntent
    ) {
        return resolve(question, courseId, ragQueryIntent);
    }

    public boolean hasUsableLessonPreview(ChapterPreviewView preview) {
        return isUsable(preview);
    }

    public List<RetrievedCourseChunk> pinLessonPreviewChunk(
            ChapterPreviewView preview,
            List<RetrievedCourseChunk> ranked
    ) {
        // Retrieval applies its budget before lesson-specific preview pinning. Apply it
        // again afterwards so a full chapter preview cannot bypass the final prompt cap.
        return contextLimitService.applyBudget(pin(preview, ranked));
    }

    public String prependDraftTeachingNote(
            String context,
            String chapter,
            String teachingNote,
            String baselineDraftAnswer
    ) {
        StringBuilder prefix = new StringBuilder();
        if (teachingNote != null && !teachingNote.isBlank()) {
            prefix.append("""
                    Course-material teaching note (PREVIEW for Teacher exam — not indexed yet; textbook remains authoritative).
                    Chapter: %s
                    Student-facing key points summarized from course materials (checklist — cover every point that the textbook supports):
                    %s
                    """.formatted(
                    chapter == null ? "" : chapter.trim(),
                    teachingNote.trim()
            ));
        }
        if (baselineDraftAnswer != null && !baselineDraftAnswer.isBlank()) {
            if (!prefix.isEmpty()) {
                prefix.append('\n');
            }
            prefix.append("""
                    PRIOR DRAFT ANSWER (baseline exam — textbook/RAG only, before teaching-note checklist):
                    ---
                    %s
                    ---
                    SYNTHESIS TASK:
                    - Produce ONE improved final answer for the student.
                    - Keep useful accurate content from the prior draft.
                    - Add any checklist points from the teaching note that are supported by the textbook context but missing or weak in the prior draft.
                    - Do not become a thin paraphrase of only the teaching note; keep the fuller textbook-grounded explanation.
                    - If the teaching note conflicts with textbook excerpts, prefer the textbook and ignore the conflicting note.
                    """.formatted(baselineDraftAnswer.trim()));
        }
        if (prefix.isEmpty()) {
            return context == null ? "" : context;
        }
        if (context == null || context.isBlank()) {
            return prefix.toString();
        }
        return prefix + "\n\n" + context;
    }


    public ChapterPreviewView resolve(String question, String courseId) {
        return resolve(question, courseId, null);
    }

    public ChapterPreviewView resolve(String question, String courseId, RagQueryIntent intent) {
        ChapterPreviewView exactPreview = resolveExactChapter(courseId, intent);
        if (isUsable(exactPreview)) {
            return exactPreview;
        }
        String lessonTitle = extractLessonTitle(question);
        if (lessonTitle == null || lessonTitle.isBlank()) {
            return null;
        }
        try {
            ChapterPreviewView preview = chapterOutlineService.previewChapterByTitle(courseId, lessonTitle, true);
            if (isUsable(preview)) {
                log.info(
                        "Pinned chapter preview context for lesson title '{}' (courseId={}, chapterKey={}, chars={})",
                        lessonTitle,
                        courseId,
                        preview.getChapterKey(),
                        preview.getExcerpt() == null ? 0 : preview.getExcerpt().length()
                );
                return preview;
            }
        } catch (Exception exception) {
            log.debug("Could not resolve chapter preview for lesson '{}': {}", lessonTitle, exception.getMessage());
        }
        return null;
    }

    private ChapterPreviewView resolveExactChapter(String courseId, RagQueryIntent intent) {
        if (intent == null) {
            return null;
        }
        try {
            ChapterPreviewView preview = null;
            if (intent.getChapterKey() != null && !intent.getChapterKey().isBlank()) {
                preview = chapterOutlineService.previewChapter(courseId, intent.getChapterKey().trim(), true);
            } else if (intent.getChapterTitle() != null && !intent.getChapterTitle().isBlank()) {
                preview = chapterOutlineService.previewChapterByTitle(
                        courseId, intent.getChapterTitle().trim(), true);
            }
            if (isUsable(preview)) {
                log.info(
                        "Pinned exact guided-lesson chapter (courseId={}, chapterKey={}, title={}, chars={})",
                        courseId,
                        preview.getChapterKey(),
                        preview.getTitle(),
                        preview.getExcerpt() == null ? 0 : preview.getExcerpt().length()
                );
            }
            return preview;
        } catch (Exception exception) {
            log.warn(
                    "Could not resolve exact guided-lesson chapter (courseId={}, chapterKey={}, chapterTitle={}): {}",
                    courseId,
                    intent.getChapterKey(),
                    intent.getChapterTitle(),
                    exception.getMessage()
            );
            return null;
        }
    }

    public boolean isUsable(ChapterPreviewView preview) {
        return preview != null
                && preview.isHasMaterialContent()
                && preview.getExcerpt() != null
                && !preview.getExcerpt().isBlank();
    }

    public List<RetrievedCourseChunk> pin(
            ChapterPreviewView preview,
            List<RetrievedCourseChunk> ranked
    ) {
        if (!isUsable(preview)) {
            return ranked == null ? List.of() : ranked;
        }
        String materialId = resolvePreviewMaterialId(preview);
        if (materialId == null || materialId.isBlank()) {
            return ranked == null ? List.of() : ranked;
        }
        Optional<CourseMaterial> found = materialRepository.findMetadataById(materialId);
        CourseMaterial material = found == null ? null : found.orElse(null);
        if (material == null || material.getCourseId() == null
                || !material.getCourseId().equalsIgnoreCase(preview.getCourseId())) {
            return ranked == null ? List.of() : ranked;
        }
        RetrievedCourseChunk previewChunk = new RetrievedCourseChunk(
                "Chapter: " + preview.getTitle() + "\n" + preview.getExcerpt(),
                0.99,
                material.getId(),
                material.getCourseId(),
                material.getClassId(),
                material.getTeacherId(),
                material.getMaterialScope(),
                material.getSourceType(),
                material.getId(),
                preview.getChapterKey(),
                preview.getTitle(),
                preview.getChapterKey(),
                preview.getTitle(),
                preview.getChapterKey(),
                0,
                "SECTION"
        );

        LinkedHashMap<String, RetrievedCourseChunk> merged = new LinkedHashMap<>();
        merged.put(chunkIdentity(previewChunk), previewChunk);
        if (ranked != null) {
            for (RetrievedCourseChunk chunk : ranked) {
                merged.putIfAbsent(chunkIdentity(chunk), chunk);
            }
        }
        return new ArrayList<>(merged.values());
    }

    private String extractLessonTitle(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        Matcher matcher = NUMBERED_LESSON_TITLE.matcher(question.trim());
        if (!matcher.find()) {
            return null;
        }
        String title = matcher.group(1);
        if (title == null) {
            return null;
        }
        return title
                .replaceAll("[*_`]+", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String resolvePreviewMaterialId(ChapterPreviewView preview) {
        if (preview.getPrimarySourceMaterialId() != null && !preview.getPrimarySourceMaterialId().isBlank()) {
            return preview.getPrimarySourceMaterialId().trim();
        }
        List<ChapterSourceMaterialView> sources = preview.getSourceMaterials();
        if (sources == null || sources.isEmpty()) {
            return null;
        }
        return sources.stream()
                .filter(Objects::nonNull)
                .map(ChapterSourceMaterialView::getId)
                .filter(id -> id != null && !id.isBlank())
                .findFirst()
                .orElse(null);
    }

    private String chunkIdentity(RetrievedCourseChunk chunk) {
        return String.join(
                "|",
                Objects.toString(chunk.sourceType(), ""),
                Objects.toString(chunk.materialId(), ""),
                Objects.toString(chunk.content(), "").strip().replaceAll("\\s+", " ")
        );
    }


    public List<RetrievedCourseChunk> retrieve(
            RagQueryIntent ragQueryIntent,
            String courseId,
            String classId
    ) {
        if (ragQueryIntent == null) {
            return List.of();
        }
        Set<String> chunkIds = ragQueryIntent.getSourceChunkIds() == null
                ? Set.of()
                : ragQueryIntent.getSourceChunkIds().stream()
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .filter(id -> !id.isBlank())
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> materialIds = new LinkedHashSet<>();
        if (ragQueryIntent.getSourceMaterialIds() != null) {
            ragQueryIntent.getSourceMaterialIds().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(id -> !id.isBlank())
                    .forEach(materialIds::add);
        }
        // sourceChunkIds encode materialId as the document prefix — recover materials when
        // the improve-plan only carries chunk provenance.
        for (String chunkId : chunkIds) {
            String materialId = materialIdFromChunkId(chunkId);
            if (materialId != null) {
                materialIds.add(materialId);
            }
        }
        if (materialIds.isEmpty()) {
            if (!chunkIds.isEmpty()) {
                log.warn(
                        "Improve-plan sourceChunkIds present but no material ids could be derived "
                                + "(courseId={}, chunkIds={})",
                        courseId,
                        chunkIds);
            }
            return List.of();
        }
        List<String> terms = mergeRetrievalTerms(ragQueryIntent);
        List<CourseMaterial> materials = materialRepository.findAllById(materialIds);
        boolean staleMaterialProvenance = materials.stream()
                .noneMatch(material -> isUsableTextbook(material, courseId, classId));
        if (staleMaterialProvenance) {
            log.warn(
                    "Source material provenance is stale; falling back to ranked course retrieval "
                            + "(courseId={}, staleMaterialIds={})",
                    courseId,
                    materialIds);
            return List.of();
        }

        List<RetrievedCourseChunk> result = new ArrayList<>();
        List<String> searchTerms = searchTerms(terms);
        for (CourseMaterial material : materials) {
            if (!isUsableTextbook(material, courseId, classId)) {
                continue;
            }
            // Rebuilding every section of a full textbook and comparing each child
            // against that section blocked the live answer for several minutes.
            if (chunkIds.isEmpty() && material.getContent().length() > LARGE_MATERIAL_CHARS) {
                long startedNanos = System.nanoTime();
                List<RetrievedCourseChunk> excerpts = excerptMatches(material, excerptNeedles(terms));
                log.info("Large source material excerpted in {} ms (materialId={}, chars={}, excerpts={})",
                        (System.nanoTime() - startedNanos) / 1_000_000,
                        material.getId(),
                        material.getContent().length(),
                        excerpts.size());
                result.addAll(excerpts);
                continue;
            }
            List<CourseMaterialChunkingService.HierarchicalChunk> chunks = chunkingService.chunkHierarchically(material);
            for (CourseMaterialChunkingService.HierarchicalChunk chunk : chunks) {
                boolean exactChunk = !chunkIds.isEmpty() && chunkIds.contains(chunk.chunkId());
                int termMatchScore = provenanceMatchScore(chunk.content(), searchTerms);
                if (!exactChunk && termMatchScore == 0) {
                    continue;
                }
                result.add(new RetrievedCourseChunk(
                        groundedChunkContent(chunk),
                        exactChunk ? 0.99 : Math.min(0.97, 0.82 + (termMatchScore / 100.0)),
                        material.getId(),
                        material.getCourseId(),
                        material.getClassId(),
                        material.getTeacherId(),
                        material.getMaterialScope(),
                        material.getSourceType(),
                        chunk.documentId(),
                        chunk.chapterId(),
                        chunk.chapterTitle(),
                        chunk.sectionId(),
                        chunk.sectionTitle(),
                        chunk.chunkId(),
                        chunk.chunkIndex(),
                        "SECTION"
                ));
            }
        }
        List<RetrievedCourseChunk> ranked = result.stream()
                .sorted((left, right) -> Double.compare(
                        Objects.requireNonNullElse(right.score(), 0.0),
                        Objects.requireNonNullElse(left.score(), 0.0)))
                .limit(6)
                .toList();
        if (!chunkIds.isEmpty()) {
            Set<String> resolved = ranked.stream()
                    .map(RetrievedCourseChunk::chunkId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            List<String> missing = chunkIds.stream().filter(id -> !resolved.contains(id)).toList();
            if (!missing.isEmpty()) {
                log.warn(
                        "Improve-plan sourceChunkIds were not pinned before semantic merge "
                                + "(courseId={}, missingChunkIds={}, resolved={})",
                        courseId,
                        missing,
                        resolved);
            }
        }
        return ranked;
    }

    /** Hierarchical chunk ids are `{materialId}:chapter:...:chunk:N`. */
    static String materialIdFromChunkId(String chunkId) {
        if (chunkId == null || chunkId.isBlank()) {
            return null;
        }
        int marker = chunkId.indexOf(":chapter:");
        if (marker > 0) {
            return chunkId.substring(0, marker);
        }
        int colon = chunkId.indexOf(':');
        if (colon > 0) {
            return chunkId.substring(0, colon);
        }
        return chunkId.trim();
    }

    private String groundedChunkContent(CourseMaterialChunkingService.HierarchicalChunk chunk) {
        String parent = Objects.toString(chunk.parentContent(), "").trim();
        String content = Objects.toString(chunk.content(), "").trim();
        if (parent.isBlank() || parent.equals(content)) {
            return content;
        }
        if (content.isBlank() || parent.contains(content)) {
            return capGroundedText(parent, content);
        }
        return capGroundedText(parent + "\n\n" + content, content);
    }

    private List<RetrievedCourseChunk> excerptMatches(CourseMaterial material, List<String> searchTerms) {
        String content = material.getContent();
        String lower = content.toLowerCase(Locale.ROOT);
        List<RetrievedCourseChunk> excerpts = new ArrayList<>();
        for (String term : searchTerms) {
            if (excerpts.size() >= 6) {
                break;
            }
            int at = lower.indexOf(term);
            if (at < 0) {
                continue;
            }
            int start = Math.max(0, at - EXCERPT_RADIUS);
            int end = Math.min(content.length(), at + term.length() + EXCERPT_RADIUS);
            String excerpt = content.substring(start, end).trim();
            if (excerpt.isBlank() || excerpts.stream().anyMatch(existing -> overlaps(existing.content(), excerpt))) {
                continue;
            }
            excerpts.add(new RetrievedCourseChunk(
                    excerpt,
                    0.9,
                    material.getId(),
                    material.getCourseId(),
                    material.getClassId(),
                    material.getTeacherId(),
                    material.getMaterialScope(),
                    material.getSourceType(),
                    material.getId(),
                    null,
                    "Document",
                    material.getId() + ":excerpt:" + start,
                    "Document",
                    material.getId() + ":excerpt:" + start,
                    excerpts.size(),
                    "SECTION"
            ));
        }
        if (excerpts.isEmpty()) {
            log.info("Large source material had no direct term match; using ranked retrieval (materialId={}, chars={})",
                    material.getId(), content.length());
        }
        return excerpts;
    }

    private boolean overlaps(String left, String right) {
        return left.contains(right) || right.contains(left);
    }

    private String capGroundedText(String candidate, String child) {
        if (candidate.length() <= MAX_GROUNDED_CHARS) {
            return candidate;
        }
        return child.length() <= MAX_GROUNDED_CHARS ? child : child.substring(0, MAX_GROUNDED_CHARS);
    }

    private List<String> excerptNeedles(List<String> terms) {
        LinkedHashSet<String> needles = new LinkedHashSet<>();
        for (String term : terms) {
            String lower = term == null ? "" : term.toLowerCase(Locale.ROOT).trim();
            if (lower.length() >= 4) {
                needles.add(lower);
            }
            for (String raw : lower.split("[^\\p{L}\\p{N}_.]+")) {
                if (raw.length() >= 4 && !STOP_WORDS.contains(raw)) {
                    needles.add(raw);
                }
            }
        }
        return new ArrayList<>(needles);
    }

    private List<String> searchTerms(List<String> terms) {
        LinkedHashSet<String> needles = new LinkedHashSet<>();
        for (String term : terms) {
            String normalized = normalizeForMatch(term);
            if (normalized.length() >= 4) {
                needles.add(normalized);
            }
            extractSignificantTokens(term).stream()
                    .filter(token -> token.length() >= 4)
                    .forEach(needles::add);
        }
        return new ArrayList<>(needles);
    }

    private boolean isUsableTextbook(CourseMaterial material, String courseId, String classId) {
        return material != null
                && courseId.equalsIgnoreCase(Objects.toString(material.getCourseId(), ""))
                && isMaterialVisibleForClass(material, classId)
                && !isNonTextbookMaterial(material)
                && material.getContent() != null
                && !material.getContent().isBlank();
    }

    private List<String> mergeRetrievalTerms(RagQueryIntent ragQueryIntent) {
        LinkedHashSet<String> terms = new LinkedHashSet<>();
        if (ragQueryIntent.getSourceTerms() != null) {
            ragQueryIntent.getSourceTerms().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .forEach(terms::add);
        }
        if (ragQueryIntent.getRetrievalTerms() != null) {
            ragQueryIntent.getRetrievalTerms().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .forEach(terms::add);
        }
        if (ragQueryIntent.getRetrievalQuery() != null && !ragQueryIntent.getRetrievalQuery().isBlank()) {
            terms.add(ragQueryIntent.getRetrievalQuery().trim());
        }
        return new ArrayList<>(terms);
    }

    private int provenanceMatchScore(String content, List<String> searchTerms) {
        String normalizedContent = normalizeForMatch(content);
        if (normalizedContent.isBlank() || searchTerms == null || searchTerms.isEmpty()) {
            return 0;
        }
        int score = 0;
        for (String term : searchTerms) {
            if (term.length() >= 4 && normalizedContent.contains(term)) {
                score += term.length() >= 8 ? 20 : 5;
            }
        }
        return score;
    }

    private boolean isMaterialVisibleForClass(CourseMaterial material, String requestedClassId) {
        String materialClassId = material.getClassId();
        if (materialClassId == null || materialClassId.isBlank() || "null".equalsIgnoreCase(materialClassId)) {
            return true;
        }
        return requestedClassId != null && materialClassId.equalsIgnoreCase(requestedClassId.trim());
    }

    private boolean isNonTextbookMaterial(CourseMaterial material) {
        return "KNOWLEDGE_CANDIDATE".equalsIgnoreCase(material.getSourceType())
                || "GOLD_QA".equalsIgnoreCase(material.getSourceType())
                || "senior-approved-knowledge".equalsIgnoreCase(material.getCategory());
    }

    private List<String> extractSignificantTokens(String text) {
        String normalized = normalizeForMatch(text);
        List<String> tokens = new ArrayList<>();
        for (String raw : normalized.split("[^\\p{L}\\p{N}_.]+")) {
            String token = raw.trim();
            if (token.length() < 3 || STOP_WORDS.contains(token)) {
                continue;
            }
            if (!tokens.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private String normalizeForMatch(String text) {
        return TextSanitizer.normalizeAccentInsensitive(text);
    }

}
