package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document("user_notifications")
@CompoundIndex(name = "user_notifications_user_created", def = "{'userId': 1, 'createdAt': -1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserNotification {
    @Id
    private String id;
    private String userId;
    private String type;
    private String title;
    private String body;
    private String questionEscalationId;
    private String courseId;
    private String classId;
    /** Frontend path opened when the user clicks the notification. */
    private String linkPath;
    private String entityType;
    private String entityId;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
}
