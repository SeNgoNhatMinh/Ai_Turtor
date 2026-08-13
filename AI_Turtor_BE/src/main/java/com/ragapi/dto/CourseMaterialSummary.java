package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseMaterialSummary {

    private String id;
    private String title;
    private String category;
    private String courseId;
    private String classId;
    private String teacherId;
    private String materialScope;
    private String uploadedByRole;
    private String sourceFileName;
    private String sourceType;
    private String sourceUrl;
    private String sourceDomain;
    private String sourceSection;
    private Integer importedPageCount;
    private String pdfFileId;
    private Long pdfFileSize;
    private Boolean hasPdf;
    private String indexingStatus;
    private LocalDateTime indexedAt;
    private String indexingError;
    private Integer pageCount;
    private Integer tocItemCount;
}
