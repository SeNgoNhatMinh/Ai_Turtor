package com.ragapi.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RagSourceEvidence {
    private String courseId;
    private String courseName;
    private String materialId;
    private String materialTitle;
    private String chapter;
    private Integer pageStart;
    private Integer pageEnd;
    private Boolean pageEstimated;
    private String excerpt;
    private List<RagVisualEvidence> visualEvidence;
}
