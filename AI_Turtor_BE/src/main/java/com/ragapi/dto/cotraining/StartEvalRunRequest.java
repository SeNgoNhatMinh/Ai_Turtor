package com.ragapi.dto.cotraining;

import lombok.Data;

@Data
public class StartEvalRunRequest {
    private String courseId;
    private String chapter;
    private String harnessVersion;
    private String kbVersion;
    private String promptVersion;
    private Double passThreshold;
    private String triggeredBy;
}
