package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "llm_provider_overrides")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LlmProviderOverride {

    @Id
    private String providerId;
    private Boolean enabled;
    private String model;
    private Boolean deleted;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
