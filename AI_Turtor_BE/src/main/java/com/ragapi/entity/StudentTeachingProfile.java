package com.ragapi.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** How one student learns best in one course; drives behavior retrieval. */
@Document(collection = "student_teaching_profiles")
@CompoundIndex(name = "teaching_profile_student_course_unique", def = "{'studentId':1,'courseId':1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentTeachingProfile {
    @Id
    private String id;
    private String studentId;
    private String courseId;
    private String classId;
    @Builder.Default
    private List<String> learnsBestWith = new ArrayList<>();
    @Builder.Default
    private List<String> struggleSignals = new ArrayList<>();
    /** SLOW, NORMAL or FAST. */
    private String pace;
    private String teacherNote;
    @Builder.Default
    private List<String> pinnedBehaviorIds = new ArrayList<>();
    @Builder.Default
    private List<String> blockedBehaviorIds = new ArrayList<>();
    @JsonIgnore
    private List<Float> profileEmbedding;
    /** Behaviors returned to the tutor since the last review; scored at the next review. */
    @Builder.Default
    private List<String> usedBehaviorIdsSinceReview = new ArrayList<>();
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
