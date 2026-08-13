package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Preview table of contents from an HTML documentation URL")
public class HtmlTableOfContentsRequest {

    @Schema(description = "HTML documentation index or chapter URL", example = "https://docs.oracle.com/javase/specs/jvms/se8/html/index.html")
    private String url;
}