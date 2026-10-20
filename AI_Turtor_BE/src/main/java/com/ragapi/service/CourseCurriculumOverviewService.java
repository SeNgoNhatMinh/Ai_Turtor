package com.ragapi.service;

import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.entity.Course;
import com.ragapi.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;

/**
 * Reads the official curriculum from Course.description. Material headings and
 * language models never create syllabus topics; a language model may only
 * translate the school's source text to Vietnamese while preserving structure.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CourseCurriculumOverviewService {

    private static final int MAX_UNITS = 16;
    private static final Pattern LIST_PREFIX = Pattern.compile(
            "^\\s*(?:[-*\u2022\u25aa\u25e6]+|\\d+(?:\\.\\d+)*[.)-]?)\\s*"
    );
    private static final Pattern TOPIC_SEPARATOR = Pattern.compile("\\s*(?::|\uff1a|\\||\\s[\u2013\u2014-]\\s)\\s*");
    private static final Pattern VIETNAMESE_DIACRITICS = Pattern.compile(
            "[\u00e0\u00e1\u1ea3\u00e3\u1ea1\u0103\u1eb1\u1eaf\u1eb3\u1eb5\u1eb7\u00e2\u1ea7\u1ea5\u1ea9\u1eab\u1ead"
                    + "\u00e8\u00e9\u1ebb\u1ebd\u1eb9\u00ea\u1ec1\u1ebf\u1ec3\u1ec5\u1ec7\u00ec\u00ed\u1ec9\u0129\u1ecb"
                    + "\u00f2\u00f3\u1ecf\u00f5\u1ecd\u00f4\u1ed3\u1ed1\u1ed5\u1ed7\u1ed9\u01a1\u1edd\u1edb\u1edf\u1ee1\u1ee3"
                    + "\u00f9\u00fa\u1ee7\u0169\u1ee5\u01b0\u1eeb\u1ee9\u1eed\u1eef\u1ef1\u1ef3\u00fd\u1ef7\u1ef9\u1ef5\u0111]",
            Pattern.CASE_INSENSITIVE
    );

    private final CourseRepository courseRepository;
    private final OpenRouterChatService chatService;

    public CourseCurriculumOverview forCourse(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return CourseCurriculumOverview.empty("");
        }
        String safeCourseId = courseId.trim();
        Course course = courseRepository.findByCourseId(safeCourseId).orElse(null);
        if (course == null) {
            return CourseCurriculumOverview.empty(safeCourseId);
        }
        return parseSyllabus(
                safeCourseId,
                course.getCourseName(),
                displaySyllabus(course)
        );
    }

    /** Syllabus-only block (objectives + units). Kept for callers that need just this section. */
    public String studentSyllabusMarkdown(CourseCurriculumOverview overview) {
        if (overview == null || (!overview.hasUnits() && !overview.hasObjectives()
                && (overview.summary() == null || overview.summary().isBlank()))) {
            return missingSyllabusMarkdown();
        }
        StringBuilder markdown = new StringBuilder();
        appendObjectives(markdown, overview);
        appendUnits(markdown, overview);
        if (markdown.isEmpty()
                && overview.summary() != null && !overview.summary().isBlank()) {
            markdown.append("### Nội dung chính trong chương trình học\n\n")
                    .append(overview.summary());
        }
        return markdown.toString().trim();
    }

    /**
     * The single welcome template for every course, used by both a brand-new
     * chat and a tutor session. Content is generated only from the official
     * syllabus: name, intro, objectives and units that are actually present.
     * Sections without syllabus data are omitted, except the syllabus section
     * itself which states explicitly that no information is available.
     * Prompt suggestions are rendered once by the client from
     * {@link #promptSuggestions(CourseCurriculumOverview)} topics, so they are
     * not repeated here as a keyword list.
     */
    public String welcomeMarkdown(CourseCurriculumOverview overview, String currentTopic) {
        CourseCurriculumOverview safe = overview == null
                ? CourseCurriculumOverview.empty("")
                : overview;
        StringBuilder opening = new StringBuilder("## Chào mừng bạn đến với môn ");
        opening.append(safe.courseId().isBlank() ? "học" : safe.courseId());
        if (!safe.courseName().isBlank()) {
            opening.append(" (").append(safe.courseName()).append(")");
        }
        opening.append("\n\n");
        if (!safe.summary().isBlank() && !duplicatesAny(safe.summary(), safe)) {
            opening.append(safe.summary()).append("\n\n");
        }
        if (currentTopic != null && !currentTopic.isBlank()) {
            opening.append("Hôm nay chúng ta bắt đầu với **")
                    .append(currentTopic.trim()).append("**.\n\n");
        }
        opening.append(studentSyllabusMarkdown(safe));
        return opening.toString().trim();
    }

    /** Welcome for a brand-new student chat, through the shared template. */
    public String newChatWelcomeMarkdown(String courseId) {
        return welcomeMarkdown(forCourse(courseId), null);
    }

    /**
     * Dynamic starter topics derived from the syllabus only: personal weak /
     * recent topics first (supplied by the caller), then syllabus units.
     * RAG material headings are never used here — materials are evidence for
     * answers, not the learning orientation. Duplicates of objectives or
     * units are removed.
     */
    public static List<String> promptSuggestions(
            CourseCurriculumOverview overview, List<String> personalTopics) {
        java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>();
        List<String> result = new ArrayList<>();
        List<String> candidates = new ArrayList<>();
        if (personalTopics != null) {
            candidates.addAll(personalTopics);
        }
        if (overview != null) {
            candidates.addAll(overview.unitTitles());
        }
        java.util.Set<String> objectiveKeys = new java.util.HashSet<>();
        if (overview != null) {
            overview.objectives().forEach(objective -> objectiveKeys.add(normalizeKey(objective)));
        }
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            String topic = candidate.trim();
            String key = normalizeKey(topic);
            if (key.isBlank() || objectiveKeys.contains(key) || !seen.add(key)) {
                continue;
            }
            result.add(topic);
            if (result.size() >= 6) {
                break;
            }
        }
        return List.copyOf(result);
    }

    private String missingSyllabusMarkdown() {
        return "### Nội dung chính trong chương trình học\n\n"
                + "Chưa có thông tin syllabus chính thức cho môn này trên hệ thống. "
                + "Bạn vẫn có thể đặt câu hỏi; AI Tutor sẽ trả lời dựa trên tài liệu môn học đã được cung cấp.";
    }

    private void appendObjectives(StringBuilder markdown, CourseCurriculumOverview overview) {
        if (!overview.hasObjectives()) {
            return;
        }
        markdown.append("### Mục tiêu học tập\n\n");
        overview.objectives().forEach(objective -> markdown.append("- ").append(objective).append('\n'));
        markdown.append('\n');
    }

    private void appendUnits(StringBuilder markdown, CourseCurriculumOverview overview) {
        markdown.append("### Nội dung chính trong chương trình học\n\n");
        if (!overview.hasUnits()) {
            markdown.append("Chưa có thông tin syllabus chính thức cho môn này trên hệ thống. ")
                    .append("Bạn vẫn có thể đặt câu hỏi; AI Tutor sẽ trả lời dựa trên tài liệu môn học đã được cung cấp.");
            return;
        }
        overview.units().forEach(unit -> {
            markdown.append("- **").append(unit.title()).append("**");
            if (unit.detail() != null && !unit.detail().isBlank()) {
                markdown.append(": ").append(unit.detail());
            }
            markdown.append('\n');
        });
    }

    private static boolean duplicatesAny(String text, CourseCurriculumOverview overview) {
        String key = normalizeKey(text);
        if (key.isBlank()) {
            return true;
        }
        if (overview.objectives().stream().anyMatch(item -> normalizeKey(item).equals(key))) {
            return true;
        }
        return overview.units().stream().anyMatch(unit ->
                normalizeKey(unit.title()).equals(key) || normalizeKey(unit.detail()).equals(key));
    }

    static String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public void saveOfficialSyllabus(String courseId, String syllabusDescription) {
        String safeCourseId = requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
        String safeSyllabus = validateOfficialSyllabus(syllabusDescription);
        Course course = courseRepository.findByCourseId(safeCourseId)
                .orElseThrow(() -> new IllegalArgumentException("Course " + safeCourseId + " does not exist"));
        course.setDescription(safeSyllabus);
        String translated = translateToVietnamese(safeSyllabus);
        course.setSyllabusVietnamese(shouldCacheTranslation(safeSyllabus, translated) ? translated : null);
        course.setUpdatedAt(LocalDateTime.now());
        courseRepository.save(course);
    }

    public String validateOfficialSyllabus(String syllabusDescription) {
        String safeSyllabus = requireMaxLength(
                syllabusDescription,
                "syllabusDescription",
                DEFAULT_TEXT_MAX_LENGTH
        );
        if (safeSyllabus == null || safeSyllabus.isBlank()) {
            throw new IllegalArgumentException("Syllabus không được để trống");
        }
        return safeSyllabus.trim();
    }

    private String displaySyllabus(Course course) {
        String source = course.getDescription();
        if (source == null || source.isBlank()) {
            return "";
        }
        if (course.getSyllabusVietnamese() != null && !course.getSyllabusVietnamese().isBlank()) {
            return course.getSyllabusVietnamese();
        }
        String translated = translateToVietnamese(source);
        if (shouldCacheTranslation(source, translated)) {
            course.setSyllabusVietnamese(translated);
            course.setUpdatedAt(LocalDateTime.now());
            courseRepository.save(course);
        }
        return translated;
    }

    private String translateToVietnamese(String source) {
        if (source == null || source.isBlank() || looksVietnamese(source)) {
            return source == null ? "" : source.trim();
        }
        String prompt = """
                Dịch syllabus chính thức sau sang tiếng Việt.
                Yêu cầu bắt buộc:
                - Chỉ dịch ngôn ngữ; không thêm, bớt, gộp, suy luận hay giải thích nội dung.
                - Giữ nguyên thứ tự và số dòng nội dung.
                - Giữ nguyên dấu đầu dòng, số thứ tự và mọi dấu phân cách nếu có.
                - Giữ nguyên tên công nghệ, từ viết tắt và mã như Java, JSP, Servlet, MVC, JPA, AI.
                - Chỉ trả về bản dịch, không dùng khung mã Markdown.

                Syllabus:
                %s
                """.formatted(source.trim());
        try {
            String translated = stripCodeFence(chatService.generateUtility(prompt));
            if (translated.isBlank() || !looksVietnamese(translated)) {
                return source.trim();
            }
            int sourceUnits = parseSyllabus("", "", source).units().size();
            int translatedUnits = parseSyllabus("", "", translated).units().size();
            if (sourceUnits > 0 && translatedUnits != sourceUnits) {
                log.warn("Rejected syllabus translation because unit count changed: {} -> {}", sourceUnits, translatedUnits);
                return source.trim();
            }
            return translated;
        } catch (Exception error) {
            log.warn("Could not translate official syllabus to Vietnamese: {}", error.getMessage());
            return source.trim();
        }
    }

    private boolean shouldCacheTranslation(String source, String translated) {
        return translated != null
                && !translated.isBlank()
                && (looksVietnamese(source) || !translated.trim().equals(source.trim()));
    }

    private boolean looksVietnamese(String value) {
        return value != null && VIETNAMESE_DIACRITICS.matcher(value).find();
    }

    private String stripCodeFence(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (!trimmed.startsWith("```")) {
            return trimmed;
        }
        int firstLineEnd = trimmed.indexOf('\n');
        int lastFence = trimmed.lastIndexOf("```");
        if (firstLineEnd >= 0 && lastFence > firstLineEnd) {
            return trimmed.substring(firstLineEnd + 1, lastFence).trim();
        }
        return trimmed.replace("```", "").trim();
    }

    static CourseCurriculumOverview parseSyllabus(
            String courseId,
            String courseName,
            String syllabusDescription
    ) {
        String safeCourseId = courseId == null ? "" : courseId.trim();
        String safeCourseName = courseName == null ? "" : courseName.trim();
        if (syllabusDescription == null || syllabusDescription.isBlank()) {
            return new CourseCurriculumOverview(safeCourseId, safeCourseName, "", List.of());
        }

        List<String> summaryLines = new ArrayList<>();
        List<CourseCurriculumOverview.Unit> units = new ArrayList<>();
        List<String> objectives = new ArrayList<>();
        Section section = Section.INTRO;
        for (String rawLine : syllabusDescription.split("\\R")) {
            String line = rawLine == null ? "" : rawLine.trim();
            if (line.isBlank()) {
                continue;
            }
            Matcher prefixMatcher = LIST_PREFIX.matcher(line);
            boolean listItem = prefixMatcher.find() && prefixMatcher.end() > 0;
            String contentLine = listItem ? line.substring(prefixMatcher.end()).trim() : line;
            if (contentLine.isBlank()) {
                continue;
            }

            // Headings only switch sections; they never become invented content.
            Section heading = sectionHeading(contentLine, line);
            if (heading != null) {
                section = heading;
                String inline = inlineHeadingContent(contentLine);
                if (inline.isBlank()) {
                    continue;
                }
                contentLine = inline;
                listItem = true;
            } else if (section == Section.INTRO && isSyllabusHeading(contentLine)) {
                section = Section.CONTENT;
                continue;
            }

            if (section == Section.OBJECTIVES) {
                String objective = cleanMarkdown(contentLine);
                if (!objective.isBlank() && objectives.size() < MAX_UNITS) {
                    objectives.add(objective);
                }
                continue;
            }
            if (section == Section.OTHER) {
                summaryLines.add(cleanMarkdown(contentLine));
                continue;
            }

            Matcher separatorMatcher = TOPIC_SEPARATOR.matcher(contentLine);
            // "Topic: detail" is optional. Bullet/numbered lines without ":" still count as topics.
            if (separatorMatcher.find() && separatorMatcher.start() > 0) {
                String title = cleanMarkdown(contentLine.substring(0, separatorMatcher.start()));
                String detail = cleanMarkdown(contentLine.substring(separatorMatcher.end()));
                if (!title.isBlank()) {
                    units.add(new CourseCurriculumOverview.Unit(title, detail));
                }
            } else if (listItem) {
                String title = cleanMarkdown(contentLine);
                if (!title.isBlank()) {
                    units.add(new CourseCurriculumOverview.Unit(title, ""));
                }
            } else if (units.isEmpty()) {
                summaryLines.add(cleanMarkdown(contentLine));
            } else {
                CourseCurriculumOverview.Unit previous = units.remove(units.size() - 1);
                String detail = previous.detail().isBlank()
                        ? cleanMarkdown(contentLine)
                        : previous.detail() + " " + cleanMarkdown(contentLine);
                units.add(new CourseCurriculumOverview.Unit(previous.title(), detail));
            }

            if (units.size() >= MAX_UNITS) {
                break;
            }
        }

        // No fabricated summary: without intro lines from the school, summary stays empty.
        String summary = summaryLines.stream()
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse("");
        // Objectives that merely repeat a unit are shown once, as that unit.
        java.util.Set<String> unitKeys = new java.util.HashSet<>();
        units.forEach(unit -> {
            unitKeys.add(normalizeKey(unit.title()));
            unitKeys.add(normalizeKey(unit.title() + " " + unit.detail()));
        });
        List<String> dedupedObjectives = objectives.stream()
                .filter(objective -> !unitKeys.contains(normalizeKey(objective)))
                .distinct()
                .toList();
        return new CourseCurriculumOverview(safeCourseId, safeCourseName, summary, units, dedupedObjectives);
    }

    private enum Section { INTRO, OBJECTIVES, CONTENT, OTHER }

    private static Section sectionHeading(String contentLine, String rawLine) {
        String cleaned = cleanMarkdown(contentLine);
        String lower = cleaned.toLowerCase(Locale.ROOT);
        boolean headingShape = rawLine.trim().startsWith("#")
                || cleaned.endsWith(":")
                || lower.matches("^(mục tiêu|learning objectives?|learning outcomes?|course objectives?|chuẩn đầu ra|kết quả học tập|nội dung|topics?|curriculum|course content|chủ đề|lộ trình|roadmap|đánh giá|assessment|tài liệu.*|references?)(\\s|:|$).*")
                && cleaned.length() <= 90;
        if (!headingShape || cleaned.length() > 120) {
            return null;
        }
        if (lower.contains("mục tiêu") || lower.contains("learning objective")
                || lower.contains("learning outcome") || lower.contains("course objective")
                || lower.contains("chuẩn đầu ra") || lower.contains("kết quả học tập")
                || lower.contains("kỹ năng đạt được")) {
            return Section.OBJECTIVES;
        }
        if (isSyllabusHeading(cleaned) || lower.contains("nội dung")
                || lower.equals("topics") || lower.equals("topic")
                || lower.contains("curriculum") || lower.contains("course content")
                || lower.contains("chủ đề") || lower.contains("các chương")) {
            return Section.CONTENT;
        }
        if (cleaned.endsWith(":") && !cleaned.contains(".")) {
            return Section.OTHER;
        }
        return null;
    }

    /** "Mục tiêu: hiểu ..." keeps the text after the heading as an objective. */
    private static String inlineHeadingContent(String contentLine) {
        String cleaned = cleanMarkdown(contentLine);
        Matcher separatorMatcher = TOPIC_SEPARATOR.matcher(cleaned);
        if (separatorMatcher.find() && separatorMatcher.start() > 0
                && !cleaned.endsWith(":")) {
            return cleaned.substring(separatorMatcher.end()).trim();
        }
        return "";
    }

    private static boolean isSyllabusHeading(String value) {
        String normalized = value.toLowerCase(Locale.ROOT)
                .replace("**", "")
                .replace("#", "")
                .trim();
        return normalized.equals("syllabus")
                || normalized.equals("course syllabus")
                || normalized.equals("nội dung chính trong chương trình học")
                || normalized.equals("nội dung chính trong chương trình học:");
    }

    private static String cleanMarkdown(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
                .replaceAll("^#{1,6}\\s*", "")
                .replaceAll("^\\*\\*(.*?)\\*\\*$", "$1")
                .replace("**", "")
                .trim();
    }
}
