package com.ragapi.dto;

import lombok.Data;

@Data
public class AdminUserUpdateRequest {
    private Boolean isActive;
    private String role;
}
