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
public class StudentWeakTopic {

    private String topic;
    private String canonicalTopic;

    @Builder.Default
    private List<String> sourceTerms = new ArrayList<>();

    @Builder.Default
    private List<String> sourceChunkIds = new ArrayList<>();

    @Builder.Default
    private List<String> sourceMaterialIds = new ArrayList<>();

    private String origin;
    private Double confidence;
    private LocalDateTime updatedAt;
}
