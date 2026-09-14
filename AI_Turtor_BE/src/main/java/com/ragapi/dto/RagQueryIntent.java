package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RagQueryIntent {

    private String learningObjective;
    private String retrievalQuery;

    @Builder.Default
    private List<String> retrievalTerms = new ArrayList<>();

    private String teachingMode;

    @Builder.Default
    private List<String> outputConstraints = new ArrayList<>();

    private String improvePlanId;
    private String planItemId;

    @Builder.Default
    private List<String> sourceChunkIds = new ArrayList<>();

    @Builder.Default
    private List<String> sourceMaterialIds = new ArrayList<>();

    @Builder.Default
    private List<String> sourceTerms = new ArrayList<>();
}
