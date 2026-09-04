package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "pedagogical_directives")
@CompoundIndex(name = "directive_scope_idx", def = "{'courseId':1,'classId':1,'studentId':1,'status':1,'priority':-1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PedagogicalDirective {
    @Id
    private String id;
    private String teacherId;
    private String teacherName;
    private String studentId;
    @Transient
    private String studentName;
    @Transient
    private String studentCode;
    @Transient
    private String studentEmail;
    private String courseId;
    private String classId;
    private String topic;
    private String instruction;
    /** STUDENT or CLASS. */
    private String scope;
    /** DRAFT, CONFIRMED, ARCHIVED. Only CONFIRMED directives reach the tutor. */
    private String status;
    private String supportLevel;
    private Integer priority;
    private Integer version;
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveUntil;
    private LocalDateTime confirmedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
