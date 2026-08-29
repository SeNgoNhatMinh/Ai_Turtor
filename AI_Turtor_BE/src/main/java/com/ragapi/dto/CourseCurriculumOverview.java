package com.ragapi.dto;

import java.util.List;

public record CourseCurriculumOverview(
        String courseId,
        String courseName,
        String summary,
        List<Unit> units
) {
    public CourseCurriculumOverview {
        courseId = courseId == null ? "" : courseId.trim();
        courseName = courseName == null ? "" : courseName.trim();
        summary = summary == null ? "" : summary.trim();
        units = units == null ? List.of() : List.copyOf(units);
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

    public List<String> unitTitles() {
        return units.stream().map(Unit::title).filter(title -> !title.isBlank()).toList();
    }
}
