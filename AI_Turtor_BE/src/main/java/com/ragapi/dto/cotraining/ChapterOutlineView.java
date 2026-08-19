package com.ragapi.dto.cotraining;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ChapterOutlineView {
    private String id;
    private String courseId;
    private String chapterKey;
    private String title;
    private String status;
    private String detectedFrom;
    private List<String> sourceMaterialIds;
    private int chunkCount;
    private long approxChars;
    /** NO_MATERIAL, MATERIAL_THIN, MATERIAL_OK */
    private String materialHealth;
    private int trainingGoldCount;
    private int evaluationGoldCount;
    private int tocLevel;
    private int pageStart;
    private int pageEnd;
    private String primarySourceMaterialId;
}
