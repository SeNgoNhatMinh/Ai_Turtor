package com.ragapi.controller;

import com.ragapi.dto.MentorImportResponse;
import com.ragapi.entity.Mentor;
import com.ragapi.repository.MentorRepository;
import com.ragapi.service.MentorImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mentors")
@AllArgsConstructor
@Tag(name = "Teacher Import", description = "Bulk import teachers from CSV or Excel")
public class MentorImportController {

    private final MentorImportService mentorImportService;
    private final MentorRepository mentorRepository;

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Import teachers from CSV or Excel",
            description = "Upload .csv, .xlsx, or .xls file with teacher records. Use dryRun=true to validate before saving.",
            tags = {"Mentor Import"}
    )
    @ApiResponse(responseCode = "200", description = "Import completed")
    @ApiResponse(responseCode = "400", description = "Invalid CSV or Excel file")
    @ApiResponse(responseCode = "500", description = "Server error")
    public ResponseEntity<?> importMentorsFromExcel(
            @Parameter(description = "Teacher import file (.csv, .xlsx, or .xls)", required = true, schema = @Schema(type = "string", format = "binary"))
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "dryRun", defaultValue = "false")
            @Parameter(description = "true = preview only, false = save records")
            boolean dryRun
    ) {
        try {
            String filename = file.getOriginalFilename();
            if (filename == null || (!filename.endsWith(".csv") && !filename.endsWith(".xlsx") && !filename.endsWith(".xls"))) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("success", false, "message", "Only CSV or Excel files are supported (.csv, .xlsx, .xls)"));
            }
            if (file.getSize() > 5 * 1024 * 1024) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("success", false, "message", "File is too large. Maximum size is 5MB"));
            }

            MentorImportResponse response = filename.endsWith(".csv")
                    ? mentorImportService.importMentorsFromCsv(file, dryRun)
                    : mentorImportService.importMentorsFromExcel(file, dryRun);
            return response.getSuccess()
                    ? ResponseEntity.ok(response)
                    : ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            log.error("Error importing mentors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Server error: " + e.getMessage()));
        }
    }

    @GetMapping("/import/template")
    @Operation(
            summary = "Get mentor import template specifications",
            description = "Returns the expected teacher import columns and template download endpoints.",
            tags = {"Mentor Import"}
    )
    public ResponseEntity<?> getTemplateSpec() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("format", "CSV recommended; Excel still supported (.csv, .xlsx, .xls)");
        response.put("downloadUrl", "/api/mentors/import/template.csv");
        response.put("excelDownloadUrl", "/api/mentors/import/template.xlsx");
        response.put("columns", mentorImportService.getTemplateColumns());
        response.put("dryRun", "Use dryRun=true on /api/mentors/import to preview validation errors before saving");
        return ResponseEntity.ok(response);
    }


    @GetMapping(value = "/import/template.csv", produces = "text/csv")
    @Operation(
            summary = "Download teacher import CSV template",
            description = "Recommended template for importing teacher accounts. Imported teachers get role TEACHER; default password is Phone and is stored as BCrypt hash.",
            tags = {"Mentor Import"}
    )
    public ResponseEntity<?> downloadCsvTemplateFile() {
        byte[] csv = mentorImportService.buildTemplateCsv();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("teacher-import-template.csv")
                        .build()
                        .toString())
                .body(csv);
    }
    @GetMapping(value = {"/import/template/download", "/import/template.xlsx"})
    @Operation(
            summary = "Download generated mentor import template",
            description = "Generates an Excel template for teacher/mentor import. No static file is required.",
            tags = {"Mentor Import"}
    )
    public ResponseEntity<?> downloadTemplateFile() {
        try {
            byte[] workbook = mentorImportService.buildTemplateWorkbook();
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                            .filename("mentor-import-template.xlsx")
                            .build()
                            .toString())
                    .body(workbook);
        } catch (Exception e) {
            log.error("Error generating mentor import template", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot generate template: " + e.getMessage()));
        }
    }

    @GetMapping
    @Operation(
            summary = "List all active mentors",
            description = "Frontend can call this endpoint to let users choose or inspect mentors.",
            tags = {"Mentor Management"}
    )
    public ResponseEntity<?> getAllMentors(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "specialization", required = false) String specialization,
            @RequestParam(value = "minRating", required = false) Double minRating
    ) {
        try {
            List<Mentor> mentors;
            if (category != null && !category.isBlank()) {
                mentors = mentorRepository.findByCategories(category);
            } else if (specialization != null && !specialization.isBlank()) {
                mentors = mentorRepository.findBySpecializations(specialization);
            } else if (minRating != null) {
                mentors = mentorRepository.findByAverageRatingGreaterThanEqual(minRating);
            } else {
                mentors = mentorRepository.findByIsActiveTrue();
            }

            List<Map<String, Object>> items = mentors.stream()
                    .filter(mentor -> mentor.getIsActive() != null && mentor.getIsActive())
                    .map(this::mapMentorToResponse)
                    .toList();

            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "totalCount", items.size(),
                    "mentors", items
            ));
        } catch (Exception e) {
            log.error("Error fetching mentors", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot fetch mentors: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    @Operation(
            summary = "Get mentor details by ID",
            description = "Get full mentor details before selection.",
            tags = {"Mentor Management"}
    )
    public ResponseEntity<?> getMentorDetail(@PathVariable String id) {
        try {
            return mentorRepository.findById(id)
                    .<ResponseEntity<?>>map(mentor -> ResponseEntity.ok(Map.of(
                            "status", "SUCCESS",
                            "mentor", mapMentorToDetailResponse(mentor)
                    )))
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(Map.of("error", "Mentor not found")));
        } catch (Exception e) {
            log.error("Error fetching mentor detail", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot fetch mentor: " + e.getMessage()));
        }
    }

    private Map<String, Object> mapMentorToResponse(Mentor mentor) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", mentor.getId());
        response.put("code", mentor.getMentorCode());
        response.put("name", mentor.getMentorName());
        response.put("email", mentor.getEmail());
        response.put("phone", mentor.getPhone());
        response.put("avatarUrl", mentor.getAvatarUrl());
        response.put("averageRating", mentor.getAverageRating());
        response.put("completedMentorSessions", mentor.getCompletedMentorSessions());
        response.put("department", mentor.getDepartment());
        response.put("faculty", mentor.getFaculty());
        response.put("managedCourseIds", mentor.getManagedCourseIds());
        response.put("teachingClassIds", mentor.getTeachingClassIds());
        response.put("specializations", mentor.getSpecializations());
        response.put("responseTimeMinutes", mentor.getResponseTimeMinutes());
        response.put("isActive", mentor.getIsActive());
        return response;
    }

    private Map<String, Object> mapMentorToDetailResponse(Mentor mentor) {
        Map<String, Object> response = mapMentorToResponse(mentor);
        response.put("website", mentor.getWebsite());
        response.put("description", mentor.getDescription());
        response.put("address", mentor.getAddress());
        response.put("city", mentor.getCity());
        response.put("categories", mentor.getCategories());
        response.put("experienceYears", mentor.getExperienceYears());
        response.put("totalReviews", mentor.getTotalReviews());
        response.put("maxConcurrentChats", mentor.getMaxConcurrentChats());
        response.put("currentActiveChatSessions", mentor.getCurrentActiveChatSessions());
        response.put("totalHoursSpent", mentor.getTotalHoursSpent());
        response.put("satisfactionRate", mentor.getSatisfactionRate());
        response.put("verified", mentor.getVerified());
        return response;
    }
}
