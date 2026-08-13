package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "user_subscriptions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSubscription {
    @Id
    private String id;

    private String userId;
    private String planId;
    private String planCode;
    private String planName;

    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String status; // ACTIVE, EXPIRED, CANCELED, REPLACED
    private Boolean isTrial;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime canceledAt;
}
