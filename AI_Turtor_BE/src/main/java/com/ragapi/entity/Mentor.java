package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "mentors")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Mentor {

    @Id
    private String id;

    private String mentorCode;
    private String mentorName;
    private String email;
    private String phone;
    private String website;
    private String avatarUrl;

    private String description;
    private String address;
    private String city;
    private String department;
    private String faculty;

    private List<String> specializations;
    private List<String> categories;
    private List<String> managedCourseIds;
    private List<String> teachingClassIds;
    private Integer experienceYears;

    private Double averageRating;
    private Integer totalReviews;
    private Integer completedMentorSessions;

    private Boolean isActive;
    private Integer responseTimeMinutes;
    private List<String> availableHours;
    private Integer maxConcurrentChats;
    private Integer currentActiveChatSessions;

    private Integer totalHoursSpent;
    private Double satisfactionRate;

    private List<String> keywords;

    // V2 proactive expert co-training profile.
    private List<String> expertiseTags;
    private String expertTier; // JUNIOR, STANDARD, SENIOR, PRINCIPAL
    private Double qualityScore;
    private Integer approvedContributionCount;
    private Integer rejectedContributionCount;
    private Double preferenceAgreementRate;
    private LocalDateTime lastContributionAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private Boolean verified;
    private String verificationCode;
}
