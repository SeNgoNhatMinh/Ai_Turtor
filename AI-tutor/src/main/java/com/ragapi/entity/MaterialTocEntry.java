package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaterialTocEntry {
    private String title;
    /** 0 = top-level bookmark, 1 = subsection, etc. */
    private int level;
    /** 1-based PDF page where the section starts. */
    private int pageStart;
    /** 1-based PDF page where the section ends (computed when outline is built). */
    private Integer pageEnd;
}
