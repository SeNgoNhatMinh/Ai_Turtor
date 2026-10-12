package com.ragapi.dto;

import lombok.Data;

@Data
public class StudentLlmKeyRequest {
    private String provider;
    private String model;
    private String apiKey;
}
