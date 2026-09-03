package com.ragapi.dto;

import lombok.Data;

@Data
public class SyncLivePlaybackRequest {
    private Boolean paused;
    private Double positionSeconds;
}
