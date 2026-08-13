package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor; /**
 * User Registration Request
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserRegisterRequest {
    private String email;      // Required - unique
    private String password;   // Required - min 6 chars
    private String fullName;   // Required
    private String phone;      // Optional
}
