package com.ragapi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.dto.cotraining.ChapterOutlineView;
import com.ragapi.entity.Course;
import com.ragapi.repository.CourseRepository;
import com.ragapi.util.ChapterHeadingUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Turns indexed chapter headings into a student-facing "nội dung chính" list.
 * Grounded in course materials; not a hardcoded syllabus per course code.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseCurriculumOverviewService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int MAX_HEADINGS = 48;
    private static final int MAX_UNITS = 8;

    private final CourseRepository courseRepository;
    private final ChapterOutlineService chapterOutlineService;
    private final OpenRouterChatService chatService;
    private final Map<String, CourseCurriculumOverview> cache = new ConcurrentHashMap<>();

    public CourseCurriculumOverview forCourse(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return CourseCurriculumOverview.empty("");
        }
        String safeCourseId = courseId.trim();
        Course course = courseRepository.findByCourseId(safeCourseId).orElse(null);
        List<String> headings = materialHeadings(safeCourseId);
        String cacheKey = cacheKey(safeCourseId, course, headings);
        CourseCurriculumOverview cached = cache.get(cacheKey);
        if (cached != null) {
            return cached;
        }
        CourseCurriculumOverview generated = generate(safeCourseId, course, headings);
        if (generated.hasUnits()) {
            cache.put(cacheKey, generated);
        }
        return generated;
    }

    private List<String> materialHeadings(String courseId) {
        try {
            return chapterOutlineService.suggestChapters(courseId).stream()
                    .map(ChapterOutlineView::getTitle)
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(title -> !title.isBlank())
                    .filter(ChapterHeadingUtils::isStudyUnitTitle)
                    .distinct()
                    .limit(MAX_HEADINGS)
                    .toList();
        } catch (Exception error) {
            log.warn("Could not load chapter headings for {}: {}", courseId, error.getMessage());
            return List.of();
        }
    }

    private CourseCurriculumOverview generate(String courseId, Course course, List<String> headings) {
        String courseName = course == null || course.getCourseName() == null ? "" : course.getCourseName().trim();
        String description = course == null || course.getDescription() == null ? "" : course.getDescription().trim();
        if (headings.isEmpty() && courseName.isBlank() && description.isBlank()) {
            return CourseCurriculumOverview.empty(courseId);
        }
        String raw = chatService.generateUtility(buildPrompt(courseId, courseName, description, headings));
        CourseCurriculumOverview parsed = parse(courseId, courseName, raw);
        if (parsed.hasUnits()) {
            return parsed;
        }
        return fallback(courseId, courseName, headings);
    }

    static String buildPrompt(String courseId, String courseName, String description, List<String> headings) {
        StringBuilder headingBlock = new StringBuilder();
        headings.forEach(title -> headingBlock.append("- ").append(title).append("\n"));
        return """
                You write a Vietnamese tutor opening for one university course.
                Group the material headings into the MAIN curriculum blocks a beginner should study.
                Do not invent a different subject. Use only this course code, name, description, and headings.

                Course code: %s
                Course name: %s
                Description: %s

                Material headings:
                %s
                Return exactly one JSON object and no markdown:
                {
                  "summary": "one Vietnamese sentence: what this course trains the student to do",
                  "units": [
                    {"title": "short Vietnamese unit name", "detail": "one short Vietnamese clause of what it covers"}
                  ]
                }

                Rules:
                - 5 to 8 units, in a sensible study order
                - title is a study topic the student can click, not a question
                - merge tiny TOC subsections into larger blocks (syntax, control flow, functions, data, files, OOP, ...)
                - skip book front matter and publisher notes
                """.formatted(
                courseId == null ? "" : courseId,
                courseName == null || courseName.isBlank() ? courseId : courseName,
                description == null || description.isBlank() ? "(none)" : description,
                headingBlock.isEmpty() ? "- (no headings indexed yet)" : headingBlock
        );
    }

    static CourseCurriculumOverview parse(String courseId, String courseName, String raw) {
        if (raw == null || raw.isBlank()) {
            return CourseCurriculumOverview.empty(courseId);
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(extractJson(raw));
            String summary = root.path("summary").asText("").trim();
            List<CourseCurriculumOverview.Unit> units = new ArrayList<>();
            for (JsonNode node : root.path("units")) {
                String title = node.path("title").asText("").trim();
                String detail = node.path("detail").asText("").trim();
                if (title.isBlank()) {
                    continue;
                }
                units.add(new CourseCurriculumOverview.Unit(title, detail));
                if (units.size() >= MAX_UNITS) {
                    break;
                }
            }
            return new CourseCurriculumOverview(courseId, courseName, summary, units);
        } catch (Exception error) {
            return CourseCurriculumOverview.empty(courseId);
        }
    }

    static CourseCurriculumOverview fallback(String courseId, String courseName, List<String> headings) {
        List<CourseCurriculumOverview.Unit> units = headings.stream()
                .limit(MAX_UNITS)
                .map(title -> new CourseCurriculumOverview.Unit(title, ""))
                .toList();
        String summary = courseName == null || courseName.isBlank()
                ? ""
                : "Môn " + courseId + " (" + courseName + ").";
        return new CourseCurriculumOverview(courseId, courseName, summary, units);
    }

    static String extractJson(String raw) {
        String trimmed = raw.trim();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    private String cacheKey(String courseId, Course course, List<String> headings) {
        String name = course == null ? "" : String.valueOf(course.getCourseName());
        String description = course == null ? "" : String.valueOf(course.getDescription());
        return courseId + "|" + name + "|" + description + "|" + String.join("\n", headings);
    }
}
