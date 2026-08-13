package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCaseMemoryRequest {
    private String title;
    private String summary;
    private String status;
    private List<String> tags;
    private List<String> requiredDocuments;
    private List<String> knownIssues;
}






