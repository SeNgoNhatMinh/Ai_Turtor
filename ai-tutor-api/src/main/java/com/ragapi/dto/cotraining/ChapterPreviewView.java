package com.ragapi.dto.cotraining;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ChapterPreviewView {
    private String courseId;
    private String chapterKey;
    private String title;
    private String status;
    private String detectedFrom;
    private String materialHealth;
    private int chunkCount;
    private long approxChars;
    private String excerpt;
    /** True when excerpt was shortened for preview (not full section mode). */
    private boolean excerptTruncated;
    private int excerptTotalChars;
    /** True when chapter content is mapped from indexed course materials. */
    private boolean hasMaterialContent;
    /** 1-based PDF page for bookmark-mapped chapters (0 if unknown). */
    private int pageStart;
    private int pageEnd;
    /** Preferred material id for opening PDF at chapter section. */
    private String primarySourceMaterialId;
    private List<ChapterSourceMaterialView> sourceMaterials;
}
