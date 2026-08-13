package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Import course material from an HTML documentation URL")
public class ImportCourseMaterialUrlRequest {

    @Schema(description = "HTML documentation URL", example = "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html#jvms-1.1")
    private String url;

    @Schema(description = "Material title. If empty, the HTML title will be used.", example = "JVM Spec SE8 - Chapter 1")
    private String title;

    @Schema(description = "Class section ID. Required for TEACHER imports, empty for ADMIN course-shared imports.", example = "SE1840")
    private String classId;

    @Schema(description = "Teacher or uploader ID", example = "TEACHER_A")
    private String teacherId;

    @Schema(description = "ADMIN imports course-shared material, TEACHER imports class-scoped material", example = "ADMIN")
    private String uploaderRole;

    @Schema(description = "Specific TOC/chapter URLs selected by FE. When provided, followNext is ignored. There is no fixed item-count limit.")
    private List<String> selectedUrls;

    @Schema(description = "Follow documentation Next links on the same domain", example = "false")
    private Boolean followNext;

    @Schema(description = "Requested number of HTML pages to import when followNext=true. The backend applies no fixed upper limit.", example = "3")
    private Integer maxPages;
}
