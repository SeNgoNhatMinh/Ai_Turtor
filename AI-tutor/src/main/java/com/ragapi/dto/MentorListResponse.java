package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * MentorListResponse - Response danh sách mentor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorListResponse {
    private Integer totalCount;
    private Integer pageNumber;
    private Integer pageSize;
    private List<MentorInfo> mentors;
}
