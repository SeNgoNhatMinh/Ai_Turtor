package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublishQuizAssignmentRequest {
    /** CLASS or SELECTED_STUDENTS */
    private String targetType;
    private List<String> targetStudentIds;
}
