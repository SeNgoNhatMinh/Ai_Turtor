package com.ragapi.service;

import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.entity.Course;
import com.ragapi.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
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
 * Reads the official curriculum from Course.description. The overview is
 * deterministic: uploaded material headings and language models never create
 * or rewrite the school's syllabus.
 */
@Service
@RequiredArgsConstructor
public class CourseCurriculumOverviewService {

    private static final int MAX_UNITS = 16;
    private static final Pattern LIST_PREFIX = Pattern.compile(
            "^\\s*(?:[-*\u2022\u25aa\u25e6]+|\\d+(?:\\.\\d+)*[.)-]?)\\s*"
    );
    private static final Pattern TOPIC_SEPARATOR = Pattern.compile("\\s*(?::|\uff1a|\\||\\s[\u2013\u2014-]\\s)\\s*");

    private final CourseRepository courseRepository;

    public CourseCurriculumOverview forCourse(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return CourseCurriculumOverview.empty("");
        }
        String safeCourseId = courseId.trim();
        Course course = courseRepository.findByCourseId(safeCourseId).orElse(null);
        if (course == null) {
            return CourseCurriculumOverview.empty(safeCourseId);
        }
        return parseSyllabus(safeCourseId, course.getCourseName(), course.getDescription());
    }

    public void saveOfficialSyllabus(String courseId, String syllabusDescription) {
        String safeCourseId = requireMaxLength(courseId, "courseId", SHORT_TEXT_MAX_LENGTH);
        String safeSyllabus = requireMaxLength(
                syllabusDescription,
                "syllabusDescription",
                DEFAULT_TEXT_MAX_LENGTH
        );
        Course course = courseRepository.findByCourseId(safeCourseId)
                .orElseThrow(() -> new IllegalArgumentException("Course " + safeCourseId + " does not exist"));
        CourseCurriculumOverview parsed = parseSyllabus(
                safeCourseId,
                course.getCourseName(),
                safeSyllabus
        );
        if (!parsed.hasUnits()) {
            throw new IllegalArgumentException(
                    "Syllabus phải có ít nhất một dòng theo định dạng \"Chủ đề: mô tả\""
            );
        }
        course.setDescription(safeSyllabus);
        course.setUpdatedAt(LocalDateTime.now());
        courseRepository.save(course);
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
