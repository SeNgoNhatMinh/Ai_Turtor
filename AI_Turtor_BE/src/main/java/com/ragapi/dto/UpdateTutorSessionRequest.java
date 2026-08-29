package com.ragapi.dto;

import lombok.Data;

@Data
public class UpdateTutorSessionRequest {
    private String topic;
    private String goal;
    private String phase;
    private String supportLevel;
}
