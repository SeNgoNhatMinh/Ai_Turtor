package com.ragapi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.entity.Course;
import com.ragapi.entity.CourseLearningGuide;
import com.ragapi.repository.CourseLearningGuideRepository;
import com.ragapi.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Extract-once learning guides: when a syllabus is saved, an LLM extracts a
 * fixed JSON schema from it a single time. The result is validated against
 * the source text (grounding, dedupe, caps), then stored in MongoDB.
 * Clean extractions are auto-approved; anything with warnings waits for a
 * human review. Course reads never call an LLM — they use the latest
 * approved guide, or a deterministic syllabus parse as fallback.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CourseLearningGuideService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int MAX_OBJECTIVES = 12;
    private static final int MAX_TOPICS = 16;
    private static final int MAX_KEYWORDS = 20;
    private static final int MAX_ITEM_LENGTH = 240;
    private static final int MAX_OVERVIEW_LENGTH = 600;
    private static final double GROUNDING_THRESHOLD = 0.6;

    private final CourseRepository courseRepository;
    private final CourseLearningGuideRepository guideRepository;
    private final OpenRouterChatService chatService;

    @Value("${ai.learning-guide.extraction-enabled:true}")
    private boolean extractionEnabled;

    // ------------------------------------------------------------------
    // Extraction lifecycle
    // ------------------------------------------------------------------

    /**
     * Creates a guide for the course's current syllabus unless an up-to-date
     * guide (same syllabus hash, not FAILED) already exists. Never throws:
     * syllabus saving must succeed even when the LLM is unavailable.
     */
    public CourseLearningGuide refreshGuide(Course course, boolean force) {
        if (course == null || course.getDescription() == null || course.getDescription().isBlank()) {
            return null;
        }
        String source = course.getDescription().trim();
        String hash = syllabusHash(source);
        try {
            if (!force) {
                Optional<CourseLearningGuide> existing =
                        guideRepository.findFirstByCourseIdOrderByCreatedAtDesc(course.getCourseId());
                if (existing.isPresent()
                        && hash.equals(existing.get().getSyllabusHash())
                        && !CourseLearningGuide.STATUS_FAILED.equals(existing.get().getStatus())) {
                    return existing.get();
                }
            }
            if (!extractionEnabled) {
                return null;
            }
            String raw = chatService.generateUtility(buildExtractionPrompt(course, source));
            Extraction extraction = parseExtraction(raw, course, source);
            LocalDateTime now = LocalDateTime.now();
            CourseLearningGuide guide = CourseLearningGuide.builder()
                    .id(UUID.randomUUID().toString())
                    .courseId(course.getCourseId())
                    .syllabusHash(hash)
                    .syllabusVersion(hash.substring(0, Math.min(12, hash.length())))
                    .overview(extraction.overview())
                    .knowledgeObjectives(extraction.knowledgeObjectives())
                    .skillObjectives(extraction.skillObjectives())
                    .topics(extraction.topics().stream()
                            .map(topic -> CourseLearningGuide.Topic.builder()
                                    .title(topic.title()).detail(topic.detail()).build())
                            .toList())
                    .keywords(extraction.keywords())
                    .validationWarnings(extraction.warnings())
                    .status(extraction.warnings().isEmpty()
                            ? CourseLearningGuide.STATUS_APPROVED
                            : CourseLearningGuide.STATUS_PENDING_REVIEW)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            if (guide.getTopics().isEmpty() && guide.getKnowledgeObjectives().isEmpty()
                    && guide.getSkillObjectives().isEmpty()) {
                guide.setStatus(CourseLearningGuide.STATUS_FAILED);
                guide.setErrorMessage("LLM không trích xuất được nội dung có căn cứ từ syllabus.");
            }
            CourseLearningGuide saved = guideRepository.save(guide);
            log.info("Learning guide extracted: course={}, status={}, topics={}, warnings={}",
                    course.getCourseId(), saved.getStatus(), saved.getTopics().size(),
                    saved.getValidationWarnings().size());
            return saved;
        } catch (Exception error) {
            log.warn("Learning guide extraction failed for course {}: {}",
                    course.getCourseId(), error.getMessage());
            return saveFailedGuide(course, hash, error.getMessage());
        }
    }

    private CourseLearningGuide saveFailedGuide(Course course, String hash, String errorMessage) {
        try {
            LocalDateTime now = LocalDateTime.now();
            return guideRepository.save(CourseLearningGuide.builder()
                    .id(UUID.randomUUID().toString())
                    .courseId(course.getCourseId())
                    .syllabusHash(hash)
                    .syllabusVersion(hash.substring(0, Math.min(12, hash.length())))
                    .status(CourseLearningGuide.STATUS_FAILED)
                    .errorMessage(errorMessage == null ? "Extraction failed"
                            : errorMessage.substring(0, Math.min(500, errorMessage.length())))
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        } catch (Exception persistenceError) {
            log.warn("Could not persist failed learning guide for {}: {}",
                    course.getCourseId(), persistenceError.getMessage());
            return null;
        }
    }

    public Optional<CourseLearningGuide> latestGuide(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return Optional.empty();
        }
        return guideRepository.findFirstByCourseIdOrderByCreatedAtDesc(courseId.trim());
    }

    public Optional<CourseLearningGuide> latestApprovedGuide(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return Optional.empty();
        }
        return guideRepository.findFirstByCourseIdAndStatusOrderByCreatedAtDesc(
                courseId.trim(), CourseLearningGuide.STATUS_APPROVED);
    }

    public CourseLearningGuide approveLatest(String courseId, String reviewedBy) {
        CourseLearningGuide guide = latestGuide(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Chưa có bản hướng dẫn nào cho môn " + courseId));
        if (!CourseLearningGuide.STATUS_PENDING_REVIEW.equals(guide.getStatus())) {
            throw new IllegalStateException("Bản hướng dẫn không ở trạng thái chờ duyệt: " + guide.getStatus());
        }
        guide.setStatus(CourseLearningGuide.STATUS_APPROVED);
        guide.setReviewedBy(reviewedBy);
        guide.setReviewedAt(LocalDateTime.now());
        guide.setUpdatedAt(LocalDateTime.now());
        return guideRepository.save(guide);
    }

    public CourseLearningGuide rejectLatest(String courseId, String reviewedBy) {
        CourseLearningGuide guide = latestGuide(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Chưa có bản hướng dẫn nào cho môn " + courseId));
        if (!CourseLearningGuide.STATUS_PENDING_REVIEW.equals(guide.getStatus())) {
            throw new IllegalStateException("Bản hướng dẫn không ở trạng thái chờ duyệt: " + guide.getStatus());
        }
        guide.setStatus(CourseLearningGuide.STATUS_REJECTED);
        guide.setReviewedBy(reviewedBy);
        guide.setReviewedAt(LocalDateTime.now());
        guide.setUpdatedAt(LocalDateTime.now());
        return guideRepository.save(guide);
    }

    public CourseLearningGuide regenerate(String courseId) {
        Course course = courseRepository.findByCourseId(courseId == null ? "" : courseId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Course " + courseId + " does not exist"));
        return refreshGuide(course, true);
    }

    // ------------------------------------------------------------------
    // Read path (no LLM)
    // ------------------------------------------------------------------

    /** Overview backed by the latest approved guide, when one exists. */
    public Optional<CourseCurriculumOverview> approvedOverview(Course course) {
        if (course == null || course.getDescription() == null || course.getDescription().isBlank()) {
            return Optional.empty();
        }
        return latestApprovedGuide(course.getCourseId()).map(guide -> {
            List<String> objectives = new ArrayList<>();
            if (guide.getKnowledgeObjectives() != null) {
                objectives.addAll(guide.getKnowledgeObjectives());
            }
            if (guide.getSkillObjectives() != null) {
                objectives.addAll(guide.getSkillObjectives());
            }
            return new CourseCurriculumOverview(
                    course.getCourseId(),
                    course.getCourseName() == null ? "" : course.getCourseName(),
                    guide.getOverview() == null ? "" : guide.getOverview(),
                    guide.getTopics().stream()
                            .map(topic -> new CourseCurriculumOverview.Unit(topic.getTitle(), topic.getDetail()))
                            .toList(),
                    objectives);
        });
    }

    // ------------------------------------------------------------------
    // Extraction + validation
    // ------------------------------------------------------------------

    static String buildExtractionPrompt(Course course, String source) {
        return """
                Bạn là hệ thống trích xuất syllabus. Chỉ trích xuất thông tin CÓ TRONG syllabus bên dưới,
                tuyệt đối không bịa thêm môn học, chủ đề hay mục tiêu không xuất hiện trong nguồn.
                Dịch sang tiếng Việt nếu nguồn là tiếng Anh, giữ nguyên thuật ngữ kỹ thuật tiếng Anh.
                Chỉ trả về JSON hợp lệ (không Markdown, không giải thích) đúng schema:
                {
                  "courseCode": "mã môn",
                  "courseName": "tên môn",
                  "overview": "mô tả tổng quan ngắn dựa trên phần giới thiệu của syllabus, tối đa 3 câu",
                  "knowledgeObjectives": ["mục tiêu kiến thức"],
                  "skillObjectives": ["mục tiêu kỹ năng/thực hành"],
                  "topics": [{"title": "chủ đề", "detail": "mô tả ngắn hoặc rỗng"}],
                  "keywords": ["từ khóa/ thuật ngữ trọng tâm"]
                }
                Môn học: %s – %s
                Syllabus:
                %s
                """.formatted(
                course.getCourseId() == null ? "" : course.getCourseId(),
                course.getCourseName() == null ? "" : course.getCourseName(),
                source);
    }

    record Extraction(
            String overview,
            List<String> knowledgeObjectives,
            List<String> skillObjectives,
            List<CourseCurriculumOverview.Unit> topics,
            List<String> keywords,
            List<String> warnings
    ) {
    }

    /** Parses and validates the LLM JSON against the syllabus source. Pure: no LLM or DB calls. */
    static Extraction parseExtraction(String raw, Course course, String source) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("LLM không trả về nội dung trích xuất");
        }
        JsonNode root;
        try {
            root = OBJECT_MAPPER.readTree(extractJson(raw));
        } catch (Exception error) {
            throw new IllegalArgumentException("LLM trả về JSON không hợp lệ: " + error.getMessage());
        }
        List<String> warnings = new ArrayList<>();
        String foldedSource = fold(source);
        Set<String> sourceTokens = new LinkedHashSet<>(List.of(foldedSource.split(" ")));

        String extractedCode = root.path("courseCode").asText("").trim();
        if (!extractedCode.isBlank() && course.getCourseId() != null
                && !extractedCode.equalsIgnoreCase(course.getCourseId().trim())) {
            warnings.add("Mã môn LLM trả về (" + extractedCode + ") khác mã môn hệ thống, đã dùng mã hệ thống.");
        }

        String overview = cap(root.path("overview").asText("").trim(), MAX_OVERVIEW_LENGTH);
        if (!overview.isBlank() && !grounded(overview, sourceTokens, foldedSource)) {
            warnings.add("Tổng quan không có căn cứ rõ trong syllabus, đã loại bỏ.");
            overview = "";
        }

        List<String> knowledge = validateItems(
                stringList(root.path("knowledgeObjectives")), sourceTokens, foldedSource,
                MAX_OBJECTIVES, "Mục tiêu kiến thức", warnings);
        List<String> skills = validateItems(
                stringList(root.path("skillObjectives")), sourceTokens, foldedSource,
                MAX_OBJECTIVES, "Mục tiêu kỹ năng", warnings);
        Set<String> knowledgeKeys = new LinkedHashSet<>();
        knowledge.forEach(item -> knowledgeKeys.add(fold(item)));
        skills.removeIf(item -> knowledgeKeys.contains(fold(item)));

        List<CourseCurriculumOverview.Unit> topics = new ArrayList<>();
        Set<String> topicKeys = new LinkedHashSet<>();
        for (JsonNode node : root.path("topics")) {
            if (topics.size() >= MAX_TOPICS) {
                break;
            }
            String title = node.isTextual() ? node.asText("") : node.path("title").asText("");
            String detail = node.isTextual() ? "" : node.path("detail").asText("");
            title = cap(title.trim(), MAX_ITEM_LENGTH);
            detail = cap(detail.trim(), MAX_ITEM_LENGTH);
            if (title.isBlank() || !topicKeys.add(fold(title))) {
                continue;
            }
            if (!grounded(title, sourceTokens, foldedSource)) {
                warnings.add("Loại chủ đề không có trong syllabus: " + title);
                continue;
            }
            if (!detail.isBlank() && !grounded(detail, sourceTokens, foldedSource)) {
                warnings.add("Loại mô tả không có căn cứ của chủ đề: " + title);
                detail = "";
            }
            topics.add(new CourseCurriculumOverview.Unit(title, detail));
        }

        // Completeness cross-check with the deterministic parser: syllabus
        // topics the LLM missed are restored (they are grounded by definition).
        CourseCurriculumOverview parsed = CourseCurriculumOverviewService.parseSyllabus(
                course.getCourseId(), course.getCourseName(), source);
        for (CourseCurriculumOverview.Unit unit : parsed.units()) {
            if (topics.size() >= MAX_TOPICS) {
                break;
            }
            boolean covered = topics.stream().anyMatch(topic ->
                    fold(topic.title()).equals(fold(unit.title()))
                            || tokenOverlap(fold(topic.title()), fold(unit.title())) >= GROUNDING_THRESHOLD);
            if (!covered) {
                topics.add(unit);
                topicKeys.add(fold(unit.title()));
                warnings.add("Bổ sung chủ đề LLM bỏ sót từ syllabus: " + unit.title());
            }
        }
        if (topics.isEmpty() && !parsed.units().isEmpty()) {
            topics.addAll(parsed.units());
            warnings.add("LLM không trích xuất được chủ đề, đã dùng danh sách chủ đề từ syllabus.");
        }

        List<String> keywords = validateItems(
                stringList(root.path("keywords")), sourceTokens, foldedSource,
                MAX_KEYWORDS, "Từ khóa", warnings);

        return new Extraction(overview, knowledge, skills, List.copyOf(topics), keywords,
                List.copyOf(warnings));
    }

    private static List<String> validateItems(
            List<String> items, Set<String> sourceTokens, String foldedSource,
            int cap, String label, List<String> warnings) {
        LinkedHashMap<String, String> deduped = new LinkedHashMap<>();
        for (String item : items) {
            if (deduped.size() >= cap) {
                break;
            }
            String value = cap(item == null ? "" : item.trim(), MAX_ITEM_LENGTH);
            if (value.isBlank()) {
                continue;
            }
            deduped.putIfAbsent(fold(value), value);
        }
        List<String> result = new ArrayList<>();
        for (String value : deduped.values()) {
            if (grounded(value, sourceTokens, foldedSource)) {
                result.add(value);
            } else {
                warnings.add("Loại " + label.toLowerCase(Locale.ROOT) + " không có trong syllabus: " + value);
            }
        }
        return result;
    }

    static boolean grounded(String text, Set<String> sourceTokens, String foldedSource) {
        String folded = fold(text);
        if (folded.isBlank()) {
            return false;
        }
        if (foldedSource.contains(folded)) {
            return true;
        }
        return tokenOverlap(folded, String.join(" ", sourceTokens)) >= GROUNDING_THRESHOLD
                || overlapAgainstTokens(folded, sourceTokens) >= GROUNDING_THRESHOLD;
    }

    private static double overlapAgainstTokens(String foldedText, Set<String> sourceTokens) {
        Set<String> tokens = significantTokens(foldedText);
        if (tokens.isEmpty()) {
            return 0;
        }
        long present = tokens.stream().filter(sourceTokens::contains).count();
        return (double) present / tokens.size();
    }

    static double tokenOverlap(String left, String right) {
        Set<String> a = significantTokens(left);
        Set<String> b = significantTokens(right);
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        long shared = a.stream().filter(b::contains).count();
        return (double) shared / Math.min(a.size(), b.size());
    }

    private static Set<String> significantTokens(String folded) {
        Set<String> tokens = new LinkedHashSet<>();
        for (String token : folded.split(" ")) {
            if (token.length() >= 3) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    /** Accent-insensitive normalization so LLM output matches the source reliably. */
    static String fold(String value) {
        String key = CourseCurriculumOverviewService.normalizeKey(value);
        String decomposed = Normalizer.normalize(key, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd');
        return decomposed.replaceAll("\\s+", " ").trim();
    }

    private static List<String> stringList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(item -> values.add(item.asText("")));
        }
        return values;
    }

    private static String cap(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String cleaned = value.replaceAll("\\s+", " ").trim();
        return cleaned.length() <= maxLength ? cleaned : cleaned.substring(0, maxLength).trim();
    }

    private static String extractJson(String raw) {
        String trimmed = raw.trim();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    public static String syllabusHash(String source) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest((source == null ? "" : source.trim())
                    .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (Exception error) {
            throw new IllegalStateException("Could not hash syllabus", error);
        }
    }
}
