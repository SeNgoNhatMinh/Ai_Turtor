package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor; /**
 * User Login Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserLoginResponse {
    private String userId;     // MongoDB ID - dùng làm userId trong /select
    private String email;
    private String fullName;
    private String avatarUrl;
    private String role;
    private String token;      // JWT token (optional)
    private String message;
}
