package com.ragapi.controller;

import com.ragapi.dto.CourseCurriculumOverview;
import com.ragapi.entity.Course;
import com.ragapi.entity.CourseLearningGuide;
import com.ragapi.repository.CourseRepository;
import com.ragapi.service.CourseCurriculumOverviewService;
import com.ragapi.service.CourseLearningGuideService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Learning-guide endpoints. The student-facing GET serves only stored data:
 * the latest approved guide, or the deterministic syllabus parse while no
 * guide is approved yet. It never triggers an LLM call.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CourseLearningGuideController {

    private final CourseRepository courseRepository;
    private final CourseLearningGuideService learningGuideService;
    private final CourseCurriculumOverviewService overviewService;

    @GetMapping("/courses/{courseId}/learning-guide")
    @Operation(summary = "Student view of the course learning guide (stored data only, no LLM call)")
    public ResponseEntity<?> studentGuide(@PathVariable String courseId) {
        Course course = courseRepository.findByCourseId(courseId).orElse(null);
        if (course == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "code", "COURSE_NOT_FOUND",
                    "error", "COURSE_NOT_FOUND",
                    "message", "Course " + courseId + " does not exist"));
        }
        CourseCurriculumOverview overview = overviewService.forCourse(courseId);
        Optional<CourseLearningGuide> approved = learningGuideService.latestApprovedGuide(courseId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("courseId", overview.courseId());
        body.put("courseName", overview.courseName());
        body.put("overview", overview.summary());
        body.put("knowledgeObjectives", approved.map(CourseLearningGuide::getKnowledgeObjectives)
                .orElse(overview.objectives()));
        body.put("skillObjectives", approved.map(CourseLearningGuide::getSkillObjectives)
                .orElse(List.of()));
        body.put("topics", overview.units());
        body.put("keywords", approved.map(CourseLearningGuide::getKeywords).orElse(List.of()));
        body.put("source", approved.isPresent() ? "LEARNING_GUIDE" : "SYLLABUS_PARSER");
        body.put("status", approved.map(CourseLearningGuide::getStatus)
                .orElse(course.getDescription() == null || course.getDescription().isBlank()
                        ? "NO_SYLLABUS" : "FALLBACK"));
        approved.ifPresent(guide -> body.put("syllabusVersion", guide.getSyllabusVersion()));
        body.put("welcomeMarkdown", overviewService.welcomeMarkdown(overview, null));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/admin/courses/{courseId}/learning-guide")
    @Operation(summary = "Latest learning guide in any status, for review")
    public ResponseEntity<?> adminGuide(@PathVariable String courseId) {
        Optional<CourseLearningGuide> guide = learningGuideService.latestGuide(courseId);
        if (guide.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "NONE", "courseId", courseId));
        }
        return ResponseEntity.ok(guide.get());
    }

    @PostMapping("/admin/courses/{courseId}/learning-guide/regenerate")
    @Operation(summary = "Re-run the one-time LLM extraction for the current syllabus")
    public ResponseEntity<?> regenerate(@PathVariable String courseId) {
        try {
            CourseLearningGuide guide = learningGuideService.regenerate(courseId);
            if (guide == null) {
                return ResponseEntity.ok(Map.of("status", "NO_SYLLABUS", "courseId", courseId));
            }
            return ResponseEntity.ok(guide);
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "code", "COURSE_NOT_FOUND", "error", "COURSE_NOT_FOUND", "message", error.getMessage()));
        }
    }

    @PostMapping("/admin/courses/{courseId}/learning-guide/approve")
    @Operation(summary = "Approve the pending learning guide so students see it")
    public ResponseEntity<?> approve(
            @PathVariable String courseId,
            @RequestParam(value = "reviewedBy", required = false) String reviewedBy) {
        return review(courseId, reviewedBy, true);
    }

    @PostMapping("/admin/courses/{courseId}/learning-guide/reject")
    @Operation(summary = "Reject the pending learning guide; students keep the previous approved guide or parser fallback")
    public ResponseEntity<?> reject(
            @PathVariable String courseId,
            @RequestParam(value = "reviewedBy", required = false) String reviewedBy) {
        return review(courseId, reviewedBy, false);
    }

    private ResponseEntity<?> review(String courseId, String reviewedBy, boolean approve) {
        try {
            CourseLearningGuide guide = approve
                    ? learningGuideService.approveLatest(courseId, reviewedBy)
                    : learningGuideService.rejectLatest(courseId, reviewedBy);
            return ResponseEntity.ok(guide);
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "code", "GUIDE_NOT_FOUND", "error", "GUIDE_NOT_FOUND", "message", error.getMessage()));
        } catch (IllegalStateException error) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "code", "GUIDE_NOT_PENDING", "error", "GUIDE_NOT_PENDING", "message", error.getMessage()));
        }
    }
}
