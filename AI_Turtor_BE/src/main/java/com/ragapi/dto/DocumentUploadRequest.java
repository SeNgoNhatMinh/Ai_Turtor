package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Legacy JSON course-material upload request")
public class DocumentUploadRequest {

    @Schema(description = "Material title", example = "PRJ301 Java Web - JPA Mapping")
    private String title;

    @Schema(description = "Material category", example = "course-material")
    private String category;

    @Schema(description = "Course ID for scoped course-material indexing", example = "PRJ301")
    private String courseId;

    @Schema(description = "Class section ID for scoped course-material indexing", example = "SE1840")
    private String classId;

    @Schema(description = "Teacher ID for scoped course-material indexing", example = "teacher-a")
    private String teacherId;

    @Schema(description = "Material content")
    private String content;
}





