package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class LlmProviderConfigView {
    private String providerId;
    private String family;
    private String label;
    private String envModel;
    private String effectiveModel;
    private boolean envEnabled;
    private boolean effectiveEnabled;
    private boolean adminDeleted;
    private Boolean adminEnabledOverride;
    private String adminModelOverride;
    private boolean apiKeyConfigured;
    private String baseUrl;
    private int timeoutSeconds;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
