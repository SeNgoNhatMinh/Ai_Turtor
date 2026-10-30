package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "question_escalations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionEscalation {

    @Id
    private String id;

    /**
     * Stable key for one logical student question. Retries from n8n, the
     * browser, or a timed-out HTTP request must resolve to the same ticket.
     * It is cleared when the ticket reaches a terminal state so the student
     * may ask the same question again later.
     */
    @Indexed(unique = true, sparse = true)
    private String idempotencyKey;

    private String userId;
    private String userEmail;
    private String userName;

    private String originalQuestion;
    private String aiResponse;
    private List<String> relatedFormCodes;

    private String courseId;
    private String classId;

    @Indexed
    private String conversationId;
    /**
     * PENDING_OFFER -> OFFERED -> IN_CHAT -> COMPLETED -> CANCELLED
     */
    private String status;
    private LocalDateTime questionAskedAt;
    private LocalDateTime mentorHelpOfferedAt;
    private LocalDateTime mentorAssignedAt;

    private String assignedMentorId;
    private String assignedMentorName;
    private String assignedMentorEmail;

    /**
     * CLASS_TEACHER while the course/class is active.
     * MENTOR_MATCHING after course completion or when no active class route exists.
     */
    private String escalationRoute;
    private String routeReason;

    @Indexed
    private String chatRoomId;
    private List<MentorSuggestion> suggestedMentors;

    /**
     * Soft-delete marker for the assigned teacher's support inbox only.
     * The escalation remains available to the student and is not removed from MongoDB.
     */
    private LocalDateTime hiddenFromMentorInboxAt;

    private Integer mentorResponseTime;
    private Integer durationSeconds;
    private Double userSatisfactionRating;
    private String userFeedback;

    private String internalNotes;
    private String cancelReason;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class MentorSuggestion {
    private String mentorId;
    private String mentorName;
    private String avatarUrl;
    private Double averageRating;
    private Integer completedMentorSessions;
    private String description;
    private Double matchScore;
    private String matchReason;
}


