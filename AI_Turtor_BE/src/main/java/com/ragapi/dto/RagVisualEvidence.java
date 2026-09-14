package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RagVisualEvidence {
    private String type;
    private String imageUrl;
    private String documentUrl;
    private String caption;
    private Integer pageNumber;
    private Boolean pageEstimated;
    private String retrievalProvider;
    private Double score;
}
