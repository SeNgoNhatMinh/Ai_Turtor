package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User Registration Response
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserRegisterResponse {
    private String userId;     // Generated MongoDB ID
    private String email;
    private String fullName;
    private String role;
    private String message;
    private String token;      // JWT token (nếu cần)
}
