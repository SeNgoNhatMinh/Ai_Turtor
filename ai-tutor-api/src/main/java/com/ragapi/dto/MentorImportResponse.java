package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorImportResponse {
    private Boolean success;
    private String message;
    private Integer totalRows;
    private Integer successCount;
    private Integer errorCount;
    private List<String> successMessages;
    private List<String> errorMessages;
    private Boolean dryRun;
}
