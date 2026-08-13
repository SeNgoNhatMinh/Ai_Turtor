package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MentorInfo - Thông tin mentor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorInfo {
    private String id;
    private String mentorCode;
    private String mentorName;
    private String avatarUrl;
    private String description;
    private List<String> specializations;
    private Double averageRating;
    private Integer completedMentorSessions;
    private Integer responseTimeMinutes;
    private String email;
    private String phone;
}
