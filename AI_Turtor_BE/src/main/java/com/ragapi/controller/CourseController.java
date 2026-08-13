package com.ragapi.controller;

import com.ragapi.entity.ClassSection;
import com.ragapi.entity.Course;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.Semester;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.CourseRepository;
import com.ragapi.repository.SemesterRepository;
import com.ragapi.service.CourseDeletionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@AllArgsConstructor
@Tag(name = "Courses", description = "Semester, course and academic lifecycle APIs")
public class CourseController {

    private final SemesterRepository semesterRepository;
    private final CourseRepository courseRepository;
    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseDeletionService courseDeletionService;

    @PostMapping({"/academic/semesters", "/admin/semesters"})
    @Operation(summary = "Create or update a semester")
    public ResponseEntity<?> saveSemester(@RequestBody Semester request) {
        if (request == null || isBlank(request.getSemesterCode())) {
            return ResponseEntity.badRequest().body(Map.of("error", "semesterCode is required"));
        }

        Semester semester = semesterRepository.findBySemesterCode(request.getSemesterCode().trim())
                .orElseGet(() -> Semester.builder()
                        .id(UUID.randomUUID().toString())
                        .createdAt(LocalDateTime.now())
                        .build());

        semester.setSemesterCode(request.getSemesterCode().trim());
        semester.setName(trimToNull(request.getName()));
        semester.setStatus(defaultStatus(request.getStatus()));
        semester.setStartedAt(request.getStartedAt());
        semester.setEndedAt(request.getEndedAt());
        semester.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(semesterRepository.save(semester));
    }

    @GetMapping({"/academic/semesters", "/admin/semesters"})
    @Operation(summary = "List semesters")
    public ResponseEntity<List<Semester>> listSemesters() {
        return ResponseEntity.ok(semesterRepository.findAll());
    }

    @GetMapping({"/academic/semesters/{semesterCode}", "/admin/semesters/{semesterCode}"})
    @Operation(summary = "Get semester detail")
    public ResponseEntity<?> getSemester(@PathVariable String semesterCode) {
        return semesterRepository.findBySemesterCode(semesterCode)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "code", "SEMESTER_NOT_FOUND",
                        "error", "SEMESTER_NOT_FOUND",
                        "message", "Semester " + semesterCode + " does not exist"
                )));
    }

    @PutMapping({"/academic/semesters/{semesterCode}", "/admin/semesters/{semesterCode}"})
    @Operation(summary = "Update a semester")
    public ResponseEntity<?> updateSemester(
            @PathVariable String semesterCode,
            @RequestBody Semester request
    ) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
        }
        request.setSemesterCode(semesterCode);
        return saveSemester(request);
    }

    @DeleteMapping({"/academic/semesters/{semesterCode}", "/admin/semesters/{semesterCode}"})
    @Operation(summary = "Delete a semester when no course is attached")
    public ResponseEntity<?> deleteSemester(@PathVariable String semesterCode) {
        Semester semester = semesterRepository.findBySemesterCode(semesterCode)
                .orElseThrow(() -> new IllegalArgumentException("Semester not found"));
        List<Course> courses = courseRepository.findBySemesterId(semesterCode);
        if (!courses.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "SEMESTER_HAS_COURSES",
                    "error", "SEMESTER_HAS_COURSES",
                    "message", "Cannot delete semester because courses are attached",
                    "courseCount", courses.size()
            ));
        }
        semesterRepository.delete(semester);
        return ResponseEntity.ok(Map.of("status", "DELETED", "semesterCode", semesterCode));
    }
    @PostMapping({"/academic/courses", "/admin/courses"})
    @Operation(summary = "Create or update a course")
    public ResponseEntity<?> saveCourse(@RequestBody Course request) {
        if (request == null || isBlank(request.getCourseId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "courseId is required"));
        }

        Course course = courseRepository.findByCourseId(request.getCourseId().trim())
                .orElseGet(() -> Course.builder()
                        .id(UUID.randomUUID().toString())
                        .createdAt(LocalDateTime.now())
                        .build());

        course.setSemesterId(trimToNull(request.getSemesterId()));
        course.setCourseId(request.getCourseId().trim());
        course.setCourseName(trimToNull(request.getCourseName()));
        course.setDescription(trimToNull(request.getDescription()));
        course.setCredits(request.getCredits());
        course.setStatus(defaultStatus(request.getStatus()));
        course.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(courseRepository.save(course));
    }

    @GetMapping({"/academic/courses", "/courses", "/admin/courses"})
    @Operation(summary = "List courses")
    public ResponseEntity<List<Course>> listCourses(@RequestParam(value = "semesterId", required = false) String semesterId) {
        if (semesterId != null && !semesterId.isBlank()) {
            return ResponseEntity.ok(courseRepository.findBySemesterId(semesterId));
        }
        return ResponseEntity.ok(courseRepository.findAll());
    }

    @GetMapping({"/academic/courses/{courseId}", "/courses/{courseId}", "/admin/courses/{courseId}"})
    @Operation(summary = "Get course detail")
    public ResponseEntity<?> getCourse(@PathVariable String courseId) {
        return courseRepository.findByCourseId(courseId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "code", "COURSE_NOT_FOUND",
                        "error", "COURSE_NOT_FOUND",
                        "message", "Course " + courseId + " does not exist"
                )));
    }

    @PutMapping({"/academic/courses/{courseId}", "/admin/courses/{courseId}"})
    @Operation(summary = "Update a course")
    public ResponseEntity<?> updateCourse(
            @PathVariable String courseId,
            @RequestBody Course request
    ) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
        }
        request.setCourseId(courseId);
        return saveCourse(request);
    }

    @DeleteMapping({"/academic/courses/{courseId}", "/admin/courses/{courseId}"})
    @Operation(summary = "Delete a course; cascade deletion must be explicitly confirmed")
    public ResponseEntity<?> deleteCourse(
            @PathVariable String courseId,
            @RequestParam(value = "cascade", defaultValue = "false") boolean cascade
    ) {
        Course course = courseRepository.findByCourseId(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found"));
        Map<String, Long> dependencies = courseDeletionService.findDependencies(courseId);
        if (!dependencies.isEmpty() && !cascade) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("code", "COURSE_IN_USE");
            response.put("error", "COURSE_IN_USE");
            response.put("message", "Course still contains related data. Confirm cascade deletion to remove it.");
            response.put("cascadeAvailable", true);
            response.put("dependencies", dependencies);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }
        if (cascade) {
            try {
                return ResponseEntity.ok(courseDeletionService.deleteCourseCascade(course));
            } catch (IOException e) {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("code", "COURSE_CASCADE_DELETE_FAILED");
                response.put("error", "COURSE_CASCADE_DELETE_FAILED");
                response.put("message", "Could not remove all indexed course material. The course was not deleted.");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }
        }
        courseRepository.delete(course);
        return ResponseEntity.ok(Map.of("status", "DELETED", "courseId", courseId));
    }
    @GetMapping({"/academic/mentors/{teacherId}/courses", "/mentors/{teacherId}/courses"})
    @Operation(summary = "List courses taught by one teacher or mentor")
    public ResponseEntity<List<Course>> listTeacherCourses(@PathVariable String teacherId) {
        List<String> courseIds = classSectionRepository.findByTeacherId(teacherId).stream()
                .map(ClassSection::getCourseId)
                .filter(courseId -> courseId != null && !courseId.isBlank())
                .distinct()
                .toList();

        List<Course> courses = courseRepository.findAll().stream()
                .filter(course -> courseIds.contains(course.getCourseId()))
                .toList();

        return ResponseEntity.ok(courses);
    }

    @PatchMapping("/admin/courses/{courseId}/class-sections/{classId}/complete")
    @Operation(summary = "Mark a class section and its enrollments as completed")
    public ResponseEntity<?> completeClassSection(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestParam(value = "requesterRole", required = false) String requesterRole
    ) {
        try {
            validateAdminIfProvided(requesterRole);
            ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                    .orElseThrow(() -> new IllegalArgumentException("Class section not found"));
            LocalDateTime now = LocalDateTime.now();
            section.setStatus("COMPLETED");
            section.setEndedAt(now);
            section.setUpdatedAt(now);
            classSectionRepository.save(section);

            List<CourseEnrollment> enrollments = enrollmentRepository.findByCourseIdAndClassId(courseId, classId);
            for (CourseEnrollment enrollment : enrollments) {
                enrollment.setStatus("COMPLETED");
                enrollment.setCompletedAt(now);
                enrollment.setUpdatedAt(now);
            }
            enrollmentRepository.saveAll(enrollments);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "COMPLETED");
            response.put("courseId", courseId);
            response.put("classId", classId);
            response.put("updatedEnrollments", enrollments.size());
            response.put("routingNote", "Future escalations for completed enrollments can use mentor matching");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/admin/courses/{courseId}/complete")
    @Operation(summary = "Mark a course, its class sections and enrollments as completed")
    public ResponseEntity<?> completeCourse(
            @PathVariable String courseId,
            @RequestParam(value = "requesterRole", required = false) String requesterRole
    ) {
        try {
            validateAdminIfProvided(requesterRole);
            Course course = courseRepository.findByCourseId(courseId)
                    .orElseThrow(() -> new IllegalArgumentException("Course not found"));
            LocalDateTime now = LocalDateTime.now();
            course.setStatus("COMPLETED");
            course.setUpdatedAt(now);
            courseRepository.save(course);

            List<ClassSection> sections = classSectionRepository.findByCourseId(courseId);
            for (ClassSection section : sections) {
                section.setStatus("COMPLETED");
                section.setEndedAt(now);
                section.setUpdatedAt(now);
            }
            classSectionRepository.saveAll(sections);

            List<CourseEnrollment> enrollments = enrollmentRepository.findByCourseId(courseId);
            for (CourseEnrollment enrollment : enrollments) {
                enrollment.setStatus("COMPLETED");
                enrollment.setCompletedAt(now);
                enrollment.setUpdatedAt(now);
            }
            enrollmentRepository.saveAll(enrollments);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "COMPLETED");
            response.put("courseId", courseId);
            response.put("updatedClassSections", sections.size());
            response.put("updatedEnrollments", enrollments.size());
            response.put("routingNote", "Future escalations for completed enrollments can use mentor matching");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private void validateAdminIfProvided(String requesterRole) {
        if (!isBlank(requesterRole) && !"ADMIN".equalsIgnoreCase(requesterRole.trim())) {
            throw new IllegalArgumentException("ADMIN role is required");
        }
    }

    private String defaultStatus(String status) {
        return isBlank(status) ? "ACTIVE" : status.trim().toUpperCase();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
