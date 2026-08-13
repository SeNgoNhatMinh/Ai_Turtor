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
public class CourseMaterialListResponse {

    private String courseId;
    private String classId;
    private String teacherId;
    private String materialScope;
    private String indexingStatus;
    private String sourceType;
    private Integer count;
    private List<CourseMaterialSummary> materials;
}
