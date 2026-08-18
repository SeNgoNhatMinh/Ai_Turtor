package com.ragapi.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "course_materials")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CourseMaterial {

    @Id
    private String id;

    private String title;

    private String content;

    private String category;

    private String courseId;

    private String classId;

    private String teacherId;

    /** COURSE_SHARED for admin/common materials, CLASS_SECTION for teacher class materials. */
    private String materialScope;

    /** ADMIN or TEACHER. */
    private String uploadedByRole;

    /** Original uploaded file name. */
    private String sourceFileName;

    /** Source type, for example PDF, DOCX, PPT, HTML_URL, or JSON. */
    private String sourceType;

    /** Origin metadata for reusable knowledge approved by a senior mentor. */
    private String knowledgeCandidateId;
    private String approvedBy;
    private String approvedByName;
    private LocalDateTime approvedAt;

    /** Original web documentation URL when imported from HTML. */
    private String sourceUrl;

    /** Source domain for imported web documentation. */
    private String sourceDomain;

    /** Optional section anchor or first imported section. */
    private String sourceSection;

    /** Number of HTML pages imported into this material. */
    private Integer importedPageCount;

    /** File id in MongoDB GridFS bucket course_materials. */
    private String pdfFileId;

    /** Uploaded file size in bytes. */
    private Long pdfFileSize;

    /** SHA-256 of the original PDF, used to prevent duplicate uploads per course. */
    private String contentHash;

    /** Total PDF pages when sourceType is PDF. */
    private Integer pageCount;

    /** PDF bookmark / HTML section outline extracted at upload time. */
    private List<MaterialTocEntry> tableOfContents;

    /** PROCESSING, INDEXED, or FAILED. */
    private String indexingStatus;

    private LocalDateTime indexedAt;

    private String indexingError;

    /** DISABLED, PROCESSING, INDEXED, PARTIAL, or FAILED. */
    private String visualIndexingStatus;
    private Integer visualIndexedPageCount;
    private LocalDateTime visualIndexedAt;
    private String visualIndexingError;
}
