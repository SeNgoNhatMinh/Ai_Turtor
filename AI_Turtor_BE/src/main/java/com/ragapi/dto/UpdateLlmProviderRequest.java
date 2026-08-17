package com.ragapi.dto;

import lombok.Data;

@Data
public class UpdateLlmProviderRequest {
    private Boolean enabled;
    private String model;
}
