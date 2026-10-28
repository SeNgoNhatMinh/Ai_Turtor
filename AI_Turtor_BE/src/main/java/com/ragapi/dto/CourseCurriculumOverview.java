package com.ragapi.dto;

import java.util.List;

/**
 * Student-facing curriculum overview of a course.
 *
 * <p>Grounding contract: every value in this overview comes only from
 * school-provided documents — the official syllabus stored for the course,
 * exactly as written (nothing is auto-translated; admins adjust wording
 * through manual curriculum edits). Nothing is taken from external
 * knowledge: summaries, units, objectives and keywords must be traceable
 * to words that actually appear in those documents, and {@code keywords}
 * in particular are copied from the source text, never invented or
 * paraphrased by a language model.
 */
public record CourseCurriculumOverview(
        String courseId,
        String courseName,
        String summary,
        List<Unit> units,
        List<String> objectives,
        List<String> skillObjectives,
        List<String> keywords
) {
    public CourseCurriculumOverview {
        courseId = courseId == null ? "" : courseId.trim();
        courseName = courseName == null ? "" : courseName.trim();
        summary = summary == null ? "" : summary.trim();
        units = units == null ? List.of() : List.copyOf(units);
        objectives = objectives == null ? List.of() : List.copyOf(objectives);
        skillObjectives = skillObjectives == null ? List.of() : List.copyOf(skillObjectives);
        keywords = keywords == null ? List.of() : List.copyOf(keywords);
    }

    /** Backward-compatible constructor for callers that only know syllabus units. */
    public CourseCurriculumOverview(String courseId, String courseName, String summary, List<Unit> units) {
        this(courseId, courseName, summary, units, List.of(), List.of(), List.of());
    }

    public CourseCurriculumOverview(
            String courseId, String courseName, String summary, List<Unit> units, List<String> objectives) {
        this(courseId, courseName, summary, units, objectives, List.of(), List.of());
    }

    public CourseCurriculumOverview(
            String courseId, String courseName, String summary, List<Unit> units,
            List<String> objectives, List<String> skillObjectives) {
        this(courseId, courseName, summary, units, objectives, skillObjectives, List.of());
    }

    public record Unit(String title, String detail) {
        public Unit {
            title = title == null ? "" : title.trim();
            detail = detail == null ? "" : detail.trim();
        }

        public boolean hasTitle() {
            return !title.isBlank();
        }
    }

    public static CourseCurriculumOverview empty(String courseId) {
        return new CourseCurriculumOverview(courseId, "", "", List.of());
    }

    public boolean hasUnits() {
        return !units.isEmpty();
    }

    public boolean hasObjectives() {
        return !objectives.isEmpty();
    }

    public boolean hasSkillObjectives() {
        return !skillObjectives.isEmpty();
    }

    public boolean hasKeywords() {
        return !keywords.isEmpty();
    }

    public List<String> unitTitles() {
        return units.stream().map(Unit::title).filter(title -> !title.isBlank()).toList();
    }
}
