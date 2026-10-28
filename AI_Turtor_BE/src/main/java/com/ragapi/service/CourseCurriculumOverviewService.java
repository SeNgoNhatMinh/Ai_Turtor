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
 * language models never create syllabus topics, and nothing is auto-translated:
 * students see the syllabus exactly as written, with wording corrections made
 * through manual admin edits of the curriculum guide.
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
    private final CourseRepository courseRepository;
    private final CourseLearningGuideService learningGuideService;

    public CourseCurriculumOverview forCourse(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return CourseCurriculumOverview.empty("");
        }
        String safeCourseId = courseId.trim();
        Course course = courseRepository.findByCourseId(safeCourseId).orElse(null);
        if (course == null) {
            return CourseCurriculumOverview.empty(safeCourseId);
        }
        // Stored, approved learning guide first — reading a course never calls an LLM.
        if (learningGuideService != null) {
            var approved = learningGuideService.approvedOverview(course);
            if (approved.isPresent()) {
                return approved.get();
            }
        }
        return parseSyllabus(
                safeCourseId,
                course.getCourseName(),
                displaySyllabus(course)
        );
    }

    /** Syllabus-only block (objectives + topics). Kept for callers that need just this section. */
    public String studentSyllabusMarkdown(CourseCurriculumOverview overview) {
        if (overview == null || (!overview.hasUnits() && !overview.hasObjectives()
                && !overview.hasSkillObjectives()
                && (overview.summary() == null || overview.summary().isBlank()))) {
            return missingSyllabusMarkdown();
        }
        StringBuilder markdown = new StringBuilder();
        appendObjectives(markdown, overview);
        appendUnits(markdown, overview);
        if (markdown.isEmpty()
                && overview.summary() != null && !overview.summary().isBlank()) {
            markdown.append("### Các chủ đề trọng tâm\n\n")
                    .append(overview.summary());
        }
        return markdown.toString().trim();
    }

    /**
     * The single welcome template for every course, used by both a brand-new
     * chat and a tutor session. It is filled only from the stored learning
     * guide extracted once from the official syllabus (deterministic parse as
     * fallback): sections without data are omitted and numbering adapts, so
     * nothing is invented. Study suggestions reference short topic titles
     * only, never long objective sentences.
     */
    public String welcomeMarkdown(CourseCurriculumOverview overview) {
        CourseCurriculumOverview safe = overview == null
                ? CourseCurriculumOverview.empty("")
                : overview;
        String label = courseLabel(safe);
        boolean hasSyllabus = safe.hasUnits() || safe.hasObjectives() || safe.hasSkillObjectives()
                || !safe.summary().isBlank();
        StringBuilder opening = new StringBuilder("# Chào mừng bạn đến với môn ")
                .append(label)
                .append("\n\n");
        if (hasSyllabus) {
            opening.append("Đây là chương trình học của môn **").append(label)
                    .append("**, được xây dựng dựa trên syllabus và tài liệu học tập do nhà trường cung cấp.\n\n");
        } else {
            opening.append("Chưa có thông tin syllabus chính thức cho môn **").append(label)
                    .append("** trên hệ thống.\n\n");
        }
        int section = 1;
        boolean hasOverview = (!safe.summary().isBlank() && !duplicatesAny(safe.summary(), safe))
                || safe.hasObjectives() || safe.hasSkillObjectives();
        if (hasOverview) {
            opening.append("## ").append(section++).append(". Tổng quan môn học\n\n");
            if (!safe.summary().isBlank() && !duplicatesAny(safe.summary(), safe)) {
                opening.append(safe.summary()).append("\n\n");
            }
            if (safe.hasObjectives()) {
                opening.append("### Mục tiêu kiến thức\n\n")
                        .append("Sau khi hoàn thành môn học, sinh viên có thể:\n\n");
                safe.objectives().forEach(objective -> opening.append("- ").append(objective).append('\n'));
                opening.append('\n');
            }
            if (safe.hasSkillObjectives()) {
                opening.append("### Mục tiêu kỹ năng\n\n");
                safe.skillObjectives().forEach(objective -> opening.append("- ").append(objective).append('\n'));
                opening.append('\n');
            }
        }

        opening.append("## ").append(section++).append(". Các chủ đề trọng tâm\n\n");
        if (safe.hasUnits()) {
            safe.units().forEach(unit -> {
                opening.append("- **").append(unit.title()).append("**");
                if (unit.detail() != null && !unit.detail().isBlank()) {
                    opening.append(": ").append(unit.detail());
                }
                opening.append('\n');
            });
            opening.append('\n');
        } else {
            opening.append("Chưa có thông tin về các chủ đề trọng tâm trong syllabus của môn này.\n\n");
        }

        if (safe.hasKeywords()) {
            opening.append("## ").append(section++).append(". Từ khóa\n\n");
            safe.keywords().stream()
                    .filter(keyword -> keyword != null && !keyword.isBlank())
                    .limit(12)
                    .forEach(keyword -> opening.append('`').append(keyword.trim()).append("` "));
            opening.append("\n\n");
        }

        opening.append("## ").append(section).append(". Gợi ý học tập\n\n")
                .append("Bạn có thể bắt đầu bằng cách hỏi AI Tutor:\n\n");
        appendStudySuggestions(opening, safe);
        opening.append("\n**Mẹo:** Hãy chọn một chủ đề cụ thể để AI Tutor tìm kiếm tài liệu liên quan và hỗ trợ bạn học tập theo nội dung của môn học.");
        return opening.toString().trim();
    }

    private static String courseLabel(CourseCurriculumOverview overview) {
        String id = overview.courseId() == null ? "" : overview.courseId().trim();
        String name = overview.courseName() == null ? "" : overview.courseName().trim();
        if (!id.isBlank() && !name.isBlank()) {
            return id + " – " + name;
        }
        if (!id.isBlank()) {
            return id;
        }
        return name.isBlank() ? "học" : name;
    }

    /**
     * Study prompts built from short topic titles only. Long sentence-like
     * titles (for example objective statements misparsed as topics) are
     * skipped so suggestions never read as full paragraphs.
     */
    private void appendStudySuggestions(StringBuilder opening, CourseCurriculumOverview overview) {
        List<String> topics = overview.unitTitles().stream()
                .filter(title -> title != null && title.length() <= 80)
                .limit(4)
                .toList();
        if (topics.isEmpty()) {
            opening.append("- Cho tôi biết môn học này gồm những nội dung nào theo syllabus chính thức.\n");
            opening.append("- Tôi muốn tìm hiểu về một chủ đề trong môn học này.\n");
            opening.append("- Kiểm tra kiến thức của tôi về môn học này.\n");
            return;
        }
        String first = topics.get(0);
        String second = topics.size() > 1 ? topics.get(1) : first;
        String third = topics.size() > 2 ? topics.get(2) : first;
        opening.append("- Tôi muốn tìm hiểu về ").append(first).append(".\n");
        opening.append("- Giải thích ").append(second).append(" bằng ví dụ đơn giản.\n");
        opening.append("- Hướng dẫn tôi thực hành ").append(third).append(".\n");
        opening.append("- Cho tôi bài tập luyện tập về ").append(first).append(".\n");
        opening.append("- Kiểm tra kiến thức của tôi về ").append(second).append(".\n");
    }

    /** Welcome for a brand-new student chat, through the shared template. */
    public String newChatWelcomeMarkdown(String courseId) {
        return welcomeMarkdown(forCourse(courseId));
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
        return "### Các chủ đề trọng tâm\n\n"
                + "Chưa có thông tin syllabus chính thức cho môn này trên hệ thống. "
                + "Bạn vẫn có thể đặt câu hỏi; AI Tutor sẽ trả lời dựa trên tài liệu môn học đã được cung cấp.";
    }

    private void appendObjectives(StringBuilder markdown, CourseCurriculumOverview overview) {
        if (overview.hasObjectives()) {
            markdown.append("### Mục tiêu kiến thức\n\n")
                    .append("Sau khi hoàn thành môn học, sinh viên có thể:\n\n");
            overview.objectives().forEach(objective -> markdown.append("- ").append(objective).append('\n'));
            markdown.append('\n');
        }
        if (overview.hasSkillObjectives()) {
            markdown.append("### Mục tiêu kỹ năng\n\n");
            overview.skillObjectives().forEach(objective -> markdown.append("- ").append(objective).append('\n'));
            markdown.append('\n');
        }
    }

    private void appendUnits(StringBuilder markdown, CourseCurriculumOverview overview) {
        markdown.append("### Các chủ đề trọng tâm\n\n");
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
        if (overview.objectives().stream().anyMatch(item -> normalizeKey(item).equals(key))
                || overview.skillObjectives().stream().anyMatch(item -> normalizeKey(item).equals(key))) {
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
        // No automatic translation anymore: the syllabus text an admin saves
        // is exactly what students see (legacy auto-translations are cleared).
        course.setSyllabusVietnamese(null);
        course.setUpdatedAt(LocalDateTime.now());
        courseRepository.save(course);
        // Every syllabus save (course edit form or any material upload) extracts
        // the structured learning guide once for this syllabus version.
        refreshLearningGuide(course);
    }

    /** One-time LLM extraction hook; a failure never breaks the syllabus save. */
    public void refreshLearningGuide(Course course) {
        if (learningGuideService == null || course == null) {
            return;
        }
        try {
            learningGuideService.refreshGuide(course, false);
        } catch (Exception error) {
            log.warn("Learning guide refresh failed for {}: {}",
                    course.getCourseId(), error.getMessage());
        }
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
        // No automatic translation: students see the syllabus exactly as the
        // admin wrote it; curriculum wording is fixed by manual admin edits.
        if (course == null || course.getDescription() == null) {
            return "";
        }
        return course.getDescription();
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
        List<String> skillObjectives = new ArrayList<>();
        boolean skillMode = false;
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
            // Inside the objectives section, an ordinary line that merely ends
            // with ":" (e.g. "Hiểu các công nghệ cốt lõi của lập trình web
            // Java:") is an objective, not a new miscellaneous section.
            Section heading = sectionHeading(contentLine, line);
            if (heading == Section.OTHER && section == Section.OBJECTIVES) {
                heading = null;
            }
            if (heading != null) {
                section = heading;
                if (heading == Section.OBJECTIVES) {
                    skillMode = isSkillHeading(contentLine);
                }
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
                // Sub-headings split knowledge objectives from skill objectives.
                if (isHeadingShape(contentLine, line) && isSkillHeading(contentLine)) {
                    skillMode = true;
                    String inline = inlineHeadingContent(contentLine);
                    if (!inline.isBlank() && skillObjectives.size() < MAX_UNITS) {
                        skillObjectives.add(cleanMarkdown(inline));
                    }
                    continue;
                }
                if (isHeadingShape(contentLine, line) && isKnowledgeHeading(contentLine)) {
                    skillMode = false;
                    String inline = inlineHeadingContent(contentLine);
                    if (!inline.isBlank() && objectives.size() < MAX_UNITS) {
                        objectives.add(cleanMarkdown(inline));
                    }
                    continue;
                }
                String objective = cleanMarkdown(contentLine);
                List<String> target = skillMode ? skillObjectives : objectives;
                if (!objective.isBlank() && target.size() < MAX_UNITS) {
                    target.add(objective);
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

        // No fabricated summary: without intro lines from the school, summary
        // stays empty. The syllabus only contributes a 1–2 line summary; the
        // curriculum itself is the chapter/topic list below.
        String summary = limitSummary(summaryLines.stream()
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse(""));
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
        java.util.Set<String> knowledgeKeys = new java.util.HashSet<>();
        dedupedObjectives.forEach(objective -> knowledgeKeys.add(normalizeKey(objective)));
        List<String> dedupedSkills = skillObjectives.stream()
                .filter(objective -> !unitKeys.contains(normalizeKey(objective)))
                .filter(objective -> !knowledgeKeys.contains(normalizeKey(objective)))
                .distinct()
                .toList();
        // Keywords are the chapter/topic titles themselves: every keyword is
        // guaranteed to appear in the school document because it is copied
        // from its topic list, never invented separately.
        List<String> keywords = units.stream()
                .map(CourseCurriculumOverview.Unit::title)
                .filter(title -> title != null && !title.isBlank())
                .distinct()
                .limit(MAX_UNITS)
                .toList();
        return new CourseCurriculumOverview(
                safeCourseId, safeCourseName, summary, units, dedupedObjectives, dedupedSkills, keywords);
    }

    /**
     * Keeps at most the first two sentences (the syllabus contributes only a
     * 1–2 line summary to the curriculum overview), capped in length.
     */
    public static String limitSummary(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String text = value.replaceAll("\\s+", " ").trim();
        String[] sentences = text.split("(?<=[.!?])\\s+");
        StringBuilder limited = new StringBuilder();
        for (int index = 0; index < Math.min(2, sentences.length); index++) {
            if (!limited.isEmpty()) {
                limited.append(' ');
            }
            limited.append(sentences[index].trim());
        }
        String result = limited.toString().trim();
        if (result.length() > 320) {
            result = result.substring(0, 320).trim();
        }
        return result;
    }

    private static boolean isSkillHeading(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return lower.contains("kỹ năng") || lower.contains("kĩ năng")
                || lower.contains("skill") || lower.contains("thực hành");
    }

    private static boolean isKnowledgeHeading(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        return lower.contains("kiến thức") || lower.contains("knowledge");
    }

    private static boolean isHeadingShape(String contentLine, String rawLine) {
        String cleaned = cleanMarkdown(contentLine);
        return rawLine.trim().startsWith("#") || cleaned.endsWith(":") || cleaned.length() <= 60;
    }

    private enum Section { INTRO, OBJECTIVES, CONTENT, OTHER }

    private static Section sectionHeading(String contentLine, String rawLine) {
        String cleaned = cleanMarkdown(contentLine);
        String lower = cleaned.toLowerCase(Locale.ROOT);
        // Objective labels also appear as "a) Knowledge: (…)" / "b) Skills: (…)"
        // or an intro such as "By the end of this course Students will be able
        // to:". Short label-like lines switch to the objectives section even
        // though they do not start with "Mục tiêu".
        boolean objectivesLabel = lower.contains("mục tiêu") || lower.contains("learning objective")
                || lower.contains("learning outcome") || lower.contains("course objective")
                || lower.contains("chuẩn đầu ra") || lower.contains("kết quả học tập")
                || lower.contains("kỹ năng đạt được")
                || lower.contains("students will be able") || lower.contains("sinh viên sẽ")
                || isSkillHeading(cleaned) || isKnowledgeHeading(cleaned);
        if (objectivesLabel && cleaned.length() <= 70
                && (cleaned.contains(":") || cleaned.contains("：") || rawLine.trim().startsWith("#"))) {
            return Section.OBJECTIVES;
        }
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
                || lower.contains("kỹ năng đạt được")
                || lower.startsWith("kỹ năng") || lower.startsWith("kĩ năng") || lower.startsWith("skill")
                || isKnowledgeHeading(cleaned)) {
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
            String inline = cleaned.substring(separatorMatcher.end()).trim();
            // "(what will students know?)" is a label clarification, not content.
            return inline.startsWith("(") ? "" : inline;
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
