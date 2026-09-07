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
        CourseCurriculumOverview parsed = parseSyllabus(
                "",
                "",
                safeSyllabus
        );
        if (!parsed.hasUnits()) {
            throw new IllegalArgumentException(
                    "Syllabus phải có ít nhất một dòng theo định dạng \"Chủ đề: mô tả\""
            );
        }
        return safeSyllabus;
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
                - Giữ nguyên dấu đầu dòng, số thứ tự và dấu hai chấm phân cách chủ đề.
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
        for (String rawLine : syllabusDescription.split("\\R")) {
            String line = rawLine == null ? "" : rawLine.trim();
            if (line.isBlank() || isSyllabusHeading(line)) {
                continue;
            }
            Matcher prefixMatcher = LIST_PREFIX.matcher(line);
            boolean listItem = prefixMatcher.find() && prefixMatcher.end() > 0;
            if (listItem) {
                line = line.substring(prefixMatcher.end()).trim();
            }
            if (line.isBlank()) {
                continue;
            }

            Matcher separatorMatcher = TOPIC_SEPARATOR.matcher(line);
            if (separatorMatcher.find() && separatorMatcher.start() > 0) {
                String title = cleanMarkdown(line.substring(0, separatorMatcher.start()));
                String detail = cleanMarkdown(line.substring(separatorMatcher.end()));
                if (!title.isBlank()) {
                    units.add(new CourseCurriculumOverview.Unit(title, detail));
                }
            } else if (listItem) {
                String title = cleanMarkdown(line);
                if (!title.isBlank()) {
                    units.add(new CourseCurriculumOverview.Unit(title, ""));
                }
            } else if (units.isEmpty()) {
                summaryLines.add(cleanMarkdown(line));
            } else {
                CourseCurriculumOverview.Unit previous = units.remove(units.size() - 1);
                String detail = previous.detail().isBlank()
                        ? cleanMarkdown(line)
                        : previous.detail() + " " + cleanMarkdown(line);
                units.add(new CourseCurriculumOverview.Unit(previous.title(), detail));
            }

            if (units.size() >= MAX_UNITS) {
                break;
            }
        }

        String summary = summaryLines.stream()
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElseGet(() -> officialSummary(safeCourseId, safeCourseName));
        return new CourseCurriculumOverview(safeCourseId, safeCourseName, summary, units);
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

    private static String officialSummary(String courseId, String courseName) {
        String label = courseName == null || courseName.isBlank()
                ? courseId
                : courseId + " (" + courseName + ")";
        return label == null || label.isBlank()
                ? "Chương trình học chính thức do nhà trường cung cấp."
                : "Chương trình học chính thức của môn " + label + " do nhà trường cung cấp.";
    }
}
