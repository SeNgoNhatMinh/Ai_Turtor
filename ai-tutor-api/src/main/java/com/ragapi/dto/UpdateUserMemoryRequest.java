package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserMemoryRequest {
    private String summary;
    private List<String> tags;
    private List<String> knownDocuments;
    private List<String> knownPermits;
    private List<String> businessActivities;
    private List<String> recentQuestions;
    private List<String> recentAnswers;
    private Map<String, String> preferences;
    private Map<String, String> privacyFlags;

}
