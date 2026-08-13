package com.ragapi.controller;

import com.ragapi.dto.EnrollStudentsRequest;
import com.ragapi.dto.MentorImportResponse;
import com.ragapi.dto.StudentEnrollmentItem;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.service.StudentEnrollmentImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.ragapi.util.ValidationUtils.requireEnum;
import static com.ragapi.util.ValidationUtils.requireText;

@RestController
@RequestMapping("/api")
@AllArgsConstructor
@Tag(name = "Class Sections", description = "Class section and student enrollment management APIs")
public class ClassSectionController {

    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final StudentEnrollmentImportService studentEnrollmentImportService;

    @PostMapping({"/academic/class-sections", "/admin/class-sections"})
    @Operation(summary = "Create or update a class section for one teacher")
    public ResponseEntity<?> saveClassSection(@RequestBody ClassSection request) {
        String validationError = validateClassSection(request);
        if (validationError != null) {
            return ResponseEntity.badRequest().body(Map.of("error", validationError));
        }

        ClassSection section = upsertClassSection(request);
        return ResponseEntity.ok(classSectionRepository.save(section));
    }

    @PostMapping("/admin/courses/{courseId}/class-sections")
    @Operation(summary = "Create or update a class section for one course")
    public ResponseEntity<?> saveCourseClassSection(
            @PathVariable String courseId,
            @RequestBody ClassSection request
    ) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
        }
        request.setCourseId(courseId);
        return saveClassSection(request);
    }
    @GetMapping({"/academic/courses/{courseId}/class-sections", "/courses/{courseId}/class-sections"})
    @Operation(summary = "List class sections by course")
    public ResponseEntity<List<ClassSection>> listCourseClassSections(@PathVariable String courseId) {
        return ResponseEntity.ok(classSectionRepository.findByCourseId(courseId));
    }

    @GetMapping({"/academic/courses/{courseId}/class-sections/{classId}", "/courses/{courseId}/class-sections/{classId}", "/admin/courses/{courseId}/class-sections/{classId}"})
    @Operation(summary = "Get class section detail")
    public ResponseEntity<?> getClassSection(
            @PathVariable String courseId,
            @PathVariable String classId
    ) {
        return classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "code", "CLASS_SECTION_NOT_FOUND",
                        "error", "CLASS_SECTION_NOT_FOUND",
                        "message", "Class section " + courseId + "/" + classId + " does not exist",
                        "courseId", courseId,
                        "classId", classId
                )));
    }

    @PutMapping({"/academic/courses/{courseId}/class-sections/{classId}", "/admin/courses/{courseId}/class-sections/{classId}"})
    @Operation(summary = "Update class section detail")
    public ResponseEntity<?> updateClassSection(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestBody ClassSection request
    ) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
        }
        request.setCourseId(courseId);
        request.setClassId(classId);
        return saveClassSection(request);
    }

    @DeleteMapping({"/academic/courses/{courseId}/class-sections/{classId}", "/admin/courses/{courseId}/class-sections/{classId}"})
    @Operation(summary = "Delete a class section when no students are enrolled")
    public ResponseEntity<?> deleteClassSection(
            @PathVariable String courseId,
            @PathVariable String classId
    ) {
        ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                .orElseThrow(() -> new IllegalArgumentException("Class section not found"));
        List<CourseEnrollment> enrollments = courseEnrollmentRepository.findByCourseIdAndClassId(courseId, classId);
        if (!enrollments.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "CLASS_SECTION_HAS_STUDENTS",
                    "error", "CLASS_SECTION_HAS_STUDENTS",
                    "message", "Cannot delete class section because students are enrolled",
                    "studentCount", enrollments.size()
            ));
        }
        classSectionRepository.delete(section);
        return ResponseEntity.ok(Map.of("status", "DELETED", "courseId", courseId, "classId", classId));
    }
    @GetMapping({"/academic/mentors/{teacherId}/class-sections", "/mentors/{teacherId}/class-sections", "/teachers/{teacherId}/classes"})
    @Operation(summary = "List class sections managed by one teacher or mentor")
    public ResponseEntity<List<ClassSection>> listTeacherClassSections(@PathVariable String teacherId) {
        return ResponseEntity.ok(classSectionRepository.findByTeacherId(teacherId));
    }

    @GetMapping({"/academic/courses/{courseId}/class-sections/{classId}/students", "/courses/{courseId}/class-sections/{classId}/students"})
    @Operation(summary = "List students enrolled in a class section")
    public ResponseEntity<?> listClassStudents(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestParam(value = "teacherId", required = false) String teacherId
    ) {
        var section = classSectionRepository.findByCourseIdAndClassId(courseId, classId);
        if (section.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "success", false,
                    "status", "FAILED",
                    "code", "CLASS_SECTION_NOT_FOUND",
                    "error", "CLASS_SECTION_NOT_FOUND",
                    "message", "Class section " + courseId + "/" + classId + " does not exist. Please create class section and enroll students first.",
                    "courseId", courseId,
                    "classId", classId
            ));
        }
        if (!isBlank(teacherId) && !teacherId.equals(section.get().getTeacherId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "This teacher is not assigned to the requested class section"));
        }

        List<CourseEnrollment> students = courseEnrollmentRepository.findByCourseIdAndClassId(courseId, classId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("courseId", courseId);
        response.put("classId", classId);
        response.put("teacherId", section.get().getTeacherId());
        response.put("count", students.size());
        response.put("students", students);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/academic/enrollments", "/admin/enrollments"})
    @Operation(summary = "Create or update one student enrollment")
    public ResponseEntity<?> saveEnrollment(@RequestBody CourseEnrollment request) {
        String validationError = validateEnrollment(request);
        if (validationError != null) {
            return ResponseEntity.badRequest().body(Map.of("error", validationError));
        }
        return ResponseEntity.ok(saveEnrollmentEntity(request));
    }

    @PostMapping({"/admin/class-sections/{courseId}/{classId}/students", "/courses/{courseId}/class-sections/{classId}/students"})
    @Operation(summary = "Enroll multiple students into a class section from JSON")
    public ResponseEntity<?> enrollStudents(
            @PathVariable String courseId,
            @PathVariable String classId,
            @RequestBody EnrollStudentsRequest request
    ) {
        if (request == null || request.getStudents() == null || request.getStudents().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "students must not be empty"));
        }

        List<CourseEnrollment> saved = new ArrayList<>();
        Set<String> seenStudentIds = new HashSet<>();
        for (StudentEnrollmentItem student : request.getStudents()) {
            if (student == null || isBlank(student.getStudentId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "studentId is required for every student"));
            }
            String safeStudentId = requireText(student.getStudentId(), "studentId");
            if (!seenStudentIds.add(safeStudentId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Duplicate studentId in request: " + safeStudentId));
            }
            CourseEnrollment enrollment = CourseEnrollment.builder()
                    .studentId(safeStudentId)
                    .studentCode(trimToNull(student.getStudentCode()))
                    .studentName(trimToNull(student.getStudentName()))
                    .studentEmail(trimToNull(student.getStudentEmail()))
                    .studentPhone(trimToNull(student.getStudentPhone()))
                    .semesterId(trimToNull(request.getSemesterId()))
                    .courseId(courseId)
                    .courseName(trimToNull(request.getCourseName()))
                    .classId(classId)
                    .className(trimToNull(request.getClassName()))
                    .status(defaultStatus(request.getStatus()))
                    .build();
            saved.add(saveEnrollmentEntity(enrollment));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("courseId", courseId);
        response.put("classId", classId);
        response.put("count", saved.size());
        response.put("students", saved);
        return ResponseEntity.ok(response);
    }

    @PostMapping(
            value = {"/admin/class-sections/{courseId}/{classId}/students/import", "/courses/{courseId}/class-sections/{classId}/students/import"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @Operation(summary = "Import students into a class section from Excel .xlsx")
    public ResponseEntity<?> importStudentsFromExcel(
            @PathVariable String courseId,
            @PathVariable String classId,
            @Parameter(description = "Excel file (.xlsx or .xls)", required = true, schema = @Schema(type = "string", format = "binary"))
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "semesterId", required = false) String semesterId,
            @RequestParam(value = "courseName", required = false) String courseName,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "dryRun", defaultValue = "false") boolean dryRun
    ) {
        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".xlsx") && !filename.endsWith(".xls"))) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Only Excel files are supported (.xlsx or .xls)"));
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "File is too large. Maximum size is 5MB"));
        }

        MentorImportResponse response = studentEnrollmentImportService.importStudents(
                file,
                courseId,
                classId,
                semesterId,
                courseName,
                status,
                dryRun
        );
        return Boolean.TRUE.equals(response.getSuccess())
                ? ResponseEntity.ok(response)
                : ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @GetMapping({"/admin/class-sections/students/import/template", "/courses/class-sections/students/import/template"})
    @Operation(summary = "Get student enrollment Excel template specification")
    public ResponseEntity<?> getStudentImportTemplateSpec() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("format", "Excel format (.xlsx)");
        response.put("downloadUrl", "/api/admin/class-sections/students/import/template.xlsx");
        response.put("columns", studentEnrollmentImportService.getTemplateColumns());
        response.put("note", "Student ID should match the studentId used by AI Tutor. If Student ID is blank, Email must match an existing registered user.");
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = {"/admin/class-sections/students/import/template.xlsx", "/courses/class-sections/students/import/template.xlsx"})
    @Operation(summary = "Download generated student enrollment Excel template")
    public ResponseEntity<?> downloadStudentImportTemplate() {
        try {
            byte[] workbook = studentEnrollmentImportService.buildTemplateWorkbook();
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                            .filename("student-enrollment-template.xlsx")
                            .build()
                            .toString())
                    .body(workbook);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot generate template: " + e.getMessage()));
        }
    }

    @GetMapping({"/academic/enrollments/{enrollmentId}", "/admin/enrollments/{enrollmentId}"})
    @Operation(summary = "Get one student enrollment")
    public ResponseEntity<?> getEnrollment(@PathVariable String enrollmentId) {
        return courseEnrollmentRepository.findById(enrollmentId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "code", "ENROLLMENT_NOT_FOUND",
                        "error", "ENROLLMENT_NOT_FOUND",
                        "message", "Enrollment " + enrollmentId + " does not exist"
                )));
    }

    @PutMapping({"/academic/enrollments/{enrollmentId}", "/admin/enrollments/{enrollmentId}"})
    @Operation(summary = "Update one student enrollment")
    public ResponseEntity<?> updateEnrollment(
            @PathVariable String enrollmentId,
            @RequestBody CourseEnrollment request
    ) {
        String validationError = validateEnrollment(request);
        if (validationError != null) {
            return ResponseEntity.badRequest().body(Map.of("error", validationError));
        }
        CourseEnrollment enrollment = courseEnrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("Enrollment not found"));
        applyEnrollmentUpdate(enrollment, request);
        return ResponseEntity.ok(courseEnrollmentRepository.save(enrollment));
    }

    @DeleteMapping({"/academic/enrollments/{enrollmentId}", "/admin/enrollments/{enrollmentId}"})
    @Operation(summary = "Delete one student enrollment")
    public ResponseEntity<?> deleteEnrollment(@PathVariable String enrollmentId) {
        CourseEnrollment enrollment = courseEnrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("Enrollment not found"));
        courseEnrollmentRepository.delete(enrollment);
        return ResponseEntity.ok(Map.of("status", "DELETED", "enrollmentId", enrollmentId));
    }

    @DeleteMapping({"/admin/class-sections/{courseId}/{classId}/students/{studentId}", "/courses/{courseId}/class-sections/{classId}/students/{studentId}"})
    @Operation(summary = "Remove one student from a class section")
    public ResponseEntity<?> removeStudentFromClass(
            @PathVariable String courseId,
            @PathVariable String classId,
            @PathVariable String studentId
    ) {
        CourseEnrollment enrollment = courseEnrollmentRepository.findByStudentIdAndCourseIdAndClassId(studentId, courseId, classId)
                .orElseThrow(() -> new IllegalArgumentException("Enrollment not found"));
        courseEnrollmentRepository.delete(enrollment);
        return ResponseEntity.ok(Map.of(
                "status", "DELETED",
                "studentId", studentId,
                "courseId", courseId,
                "classId", classId
        ));
    }
    @GetMapping({"/academic/students/{studentId}/enrollments", "/students/{studentId}/enrollments", "/students/{studentId}/courses"})
    @Operation(summary = "List courses and class sections enrolled by one student")
    public ResponseEntity<List<CourseEnrollment>> listStudentEnrollments(@PathVariable String studentId) {
        return ResponseEntity.ok(courseEnrollmentRepository.findByStudentId(studentId));
    }

    private ClassSection upsertClassSection(ClassSection request) {
        ClassSection section = classSectionRepository
                .findByCourseIdAndClassId(request.getCourseId().trim(), request.getClassId().trim())
                .orElseGet(() -> ClassSection.builder()
                        .id(UUID.randomUUID().toString())
                        .createdAt(LocalDateTime.now())
                        .build());

        section.setSemesterId(trimToNull(request.getSemesterId()));
        section.setCourseId(request.getCourseId().trim());
        section.setCourseName(trimToNull(request.getCourseName()));
        section.setClassId(request.getClassId().trim());
        section.setClassName(trimToNull(request.getClassName()));
        section.setTeacherId(request.getTeacherId().trim());
        section.setTeacherName(trimToNull(request.getTeacherName()));
        section.setTeacherEmail(trimToNull(request.getTeacherEmail()));
        section.setStatus(defaultStatus(request.getStatus()));
        section.setStartedAt(request.getStartedAt());
        section.setEndedAt(request.getEndedAt());
        section.setUpdatedAt(LocalDateTime.now());
        return section;
    }

    private CourseEnrollment saveEnrollmentEntity(CourseEnrollment request) {
        CourseEnrollment enrollment = courseEnrollmentRepository
                .findByStudentIdAndCourseIdAndClassId(
                        request.getStudentId().trim(),
                        request.getCourseId().trim(),
                        request.getClassId().trim()
                )
                .orElseGet(() -> CourseEnrollment.builder()
                        .id(UUID.randomUUID().toString())
                        .createdAt(LocalDateTime.now())
                        .enrolledAt(LocalDateTime.now())
                        .build());

        enrollment.setStudentId(request.getStudentId().trim());
        enrollment.setStudentCode(trimToNull(request.getStudentCode()));
        enrollment.setStudentName(trimToNull(request.getStudentName()));
        enrollment.setStudentEmail(trimToNull(request.getStudentEmail()));
        enrollment.setStudentPhone(trimToNull(request.getStudentPhone()));
        enrollment.setSemesterId(trimToNull(request.getSemesterId()));
        enrollment.setCourseId(request.getCourseId().trim());
        enrollment.setCourseName(trimToNull(request.getCourseName()));
        enrollment.setClassId(request.getClassId().trim());
        enrollment.setClassName(trimToNull(request.getClassName()));
        enrollment.setStatus(defaultStatus(request.getStatus()));
        enrollment.setCompletedAt(request.getCompletedAt());
        enrollment.setUpdatedAt(LocalDateTime.now());
        return courseEnrollmentRepository.save(enrollment);
    }


    private void applyEnrollmentUpdate(CourseEnrollment enrollment, CourseEnrollment request) {
        enrollment.setStudentId(request.getStudentId().trim());
        enrollment.setStudentCode(trimToNull(request.getStudentCode()));
        enrollment.setStudentName(trimToNull(request.getStudentName()));
        enrollment.setStudentEmail(trimToNull(request.getStudentEmail()));
        enrollment.setStudentPhone(trimToNull(request.getStudentPhone()));
        enrollment.setSemesterId(trimToNull(request.getSemesterId()));
        enrollment.setCourseId(request.getCourseId().trim());
        enrollment.setCourseName(trimToNull(request.getCourseName()));
        enrollment.setClassId(request.getClassId().trim());
        enrollment.setClassName(trimToNull(request.getClassName()));
        enrollment.setStatus(defaultStatus(request.getStatus()));
        enrollment.setCompletedAt(request.getCompletedAt());
        enrollment.setUpdatedAt(LocalDateTime.now());
    }
    private String validateClassSection(ClassSection request) {
        try {
            if (request == null) return "Request body is required";
            requireText(request.getCourseId(), "courseId");
            requireText(request.getClassId(), "classId");
            requireText(request.getTeacherId(), "teacherId");
            defaultStatus(request.getStatus());
            return null;
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
    }

    private String validateEnrollment(CourseEnrollment request) {
        try {
            if (request == null) return "Request body is required";
            requireText(request.getStudentId(), "studentId");
            requireText(request.getCourseId(), "courseId");
            requireText(request.getClassId(), "classId");
            defaultStatus(request.getStatus());
            return null;
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
    }

    private String defaultStatus(String status) {
        if (isBlank(status)) {
            return "ACTIVE";
        }
        return requireEnum(status, "status", "ACTIVE", "INACTIVE", "COMPLETED", "DROPPED");
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
