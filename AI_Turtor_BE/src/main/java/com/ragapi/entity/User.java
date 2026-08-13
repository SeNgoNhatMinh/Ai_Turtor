package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

/**
 * User - Người dùng bình thường (không phải mentor)
 * Login/Register bằng email + password
 */
@Document(collection = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    private String id;  // MongoDB ID - dùng làm userId
    
    // Authentication
    private String email;  // Unique
    private String password;  // Hashed password
    private String phone;  // Optional
    
    // User Info
    private String fullName;
    private String avatarUrl;
    private String role;  // "STUDENT", "TEACHER", "SENIOR_MENTOR", "ADMIN"
    
    // Status
    private Boolean isActive;
    private Boolean isEmailVerified;
    private LocalDateTime emailVerifiedAt;
    
    // Metadata
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastLoginAt;
    
    // Additional
    private String bio;
    private String address;
    private String city;
}





