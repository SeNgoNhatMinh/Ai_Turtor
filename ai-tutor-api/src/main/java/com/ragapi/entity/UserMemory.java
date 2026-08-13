package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * UserMemory - Luu tru bo nho dai han cua tung nguoi dung cho tro ly AI.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "user_memories")
public class UserMemory {
    @Id
    private String id;

    private String userId;

    // Summary + tags
    private String summary;
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    // Known documents/permits and activities
    @Builder.Default
    private List<String> knownDocuments = new ArrayList<>();

    @Builder.Default
    private List<String> knownPermits = new ArrayList<>();

    @Builder.Default
    private List<String> businessActivities = new ArrayList<>();

    // Recent interactions (last N questions)
    @Builder.Default
    private List<String> recentQuestions = new ArrayList<>();

    @Builder.Default
    private List<String> recentAnswers = new ArrayList<>();
    // Preferences and privacy flags (custom fields)
    @Builder.Default
    private Map<String, String> preferences = new HashMap<>();

    @Builder.Default
    private Map<String, String> privacyFlags = new HashMap<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
