package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MentorListRequest - Request �'�f lấy danh sách mentor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorListRequest {
    private String category; // Danh mục (VD: "java", "spring")
    private String specialization; // Chuyên môn
    private Integer pageNumber;
    private Integer pageSize;
    private String sortBy; // "rating", "reviews", "responseTime"
}
