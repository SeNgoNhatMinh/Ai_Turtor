package com.ragapi.dto;

import java.util.List;

public record CourseCurriculumOverview(
        String courseId,
        String courseName,
        String summary,
        List<Unit> units,
        List<String> objectives
) {
    public CourseCurriculumOverview {
        courseId = courseId == null ? "" : courseId.trim();
        courseName = courseName == null ? "" : courseName.trim();
        summary = summary == null ? "" : summary.trim();
        units = units == null ? List.of() : List.copyOf(units);
        objectives = objectives == null ? List.of() : List.copyOf(objectives);
    }

    /** Backward-compatible constructor for callers that only know syllabus units. */
    public CourseCurriculumOverview(String courseId, String courseName, String summary, List<Unit> units) {
        this(courseId, courseName, summary, units, List.of());
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

    public List<String> unitTitles() {
        return units.stream().map(Unit::title).filter(title -> !title.isBlank()).toList();
    }
}
