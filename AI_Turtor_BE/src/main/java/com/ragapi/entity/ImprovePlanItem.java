package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImprovePlanItem {

    private String id;
    private String title;
    private String instruction;
    private String sourceTopic;

    @Builder.Default
    private List<String> sourceChunkIds = new ArrayList<>();

    @Builder.Default
    private List<String> sourceMaterialIds = new ArrayList<>();

    @Builder.Default
    private List<String> retrievalTerms = new ArrayList<>();

    @Builder.Default
    private List<String> sourceTerms = new ArrayList<>();

    private String generatedBy;
    private String groundingStatus;
    private Double groundingConfidence;
    private LocalDateTime createdAt;
}
