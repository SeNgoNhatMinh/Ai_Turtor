package com.ragapi.dto;

import com.ragapi.entity.MaterialTocEntry;

import java.util.List;

public record PdfExtractionResult(
        String text,
        int pageCount,
        List<MaterialTocEntry> tableOfContents
) {
}
