package com.ragapi.entity;

import com.ragapi.dto.RagSourceEvidence;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "canonical_tutor_answers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CanonicalTutorAnswer {

    @Id
    private String id;
    private String courseId;
    private String classId;
    private String mode;
    private String question;
    private String answer;
    private Double confidence;
    private List<String> sources;
    private List<RagSourceEvidence> sourceEvidence;
    private String groundingType;
    private List<Float> questionEmbedding;
    /**
     * ACTIVE, DISABLED, SENIOR_APPROVED, SENIOR_CORRECTED
     */
    private String reviewStatus;
    private String originalAnswer;
    private String seniorReviewerId;
    private String seniorReviewerName;
    private String seniorReviewNotes;
    private String linkedReviewId;
    private LocalDateTime seniorReviewedAt;
    @Builder.Default
    private long reuseCount = 0L;
    private LocalDateTime lastReusedAt;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
