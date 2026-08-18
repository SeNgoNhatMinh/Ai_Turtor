package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TutorCacheHitMetadata {
    private String hitType;
    private String matchedCacheId;
    private Double similarity;
    private Long cacheLookupMs;
    private String courseId;
    private String classId;
}
