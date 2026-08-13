package com.ragapi.dto.cotraining;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ChapterSourceMaterialView {
    private String id;
    private String title;
    private String sourceType;
    private String indexingStatus;
}
