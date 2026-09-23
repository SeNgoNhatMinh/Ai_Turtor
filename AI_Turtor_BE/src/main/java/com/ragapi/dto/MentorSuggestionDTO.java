package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MentorSuggestionDTO - Chi tiết mentor �'ược suggest
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorSuggestionDTO {
    private String id;
    private String mentorName;
    private String avatarUrl;
    private Double averageRating;
    private Integer completedMentorSessions;
    private String description;
    private Double matchScore; // 0-100
    private String matchReason;
    private Integer responseTimeMinutes;
    private List<String> specializations;
    /**
     * Live presence from the authenticated realtime WebSocket connection.
     * This is informational only: an offline teacher can still be selected so
     * the request remains assigned to the student's preferred teacher.
     */
    private Boolean online;
}






