package com.ragapi.dto;

import lombok.Data;

@Data
public class AdminMentorUpdateRequest {
    private Boolean isActive;
    private Boolean verified;
}
