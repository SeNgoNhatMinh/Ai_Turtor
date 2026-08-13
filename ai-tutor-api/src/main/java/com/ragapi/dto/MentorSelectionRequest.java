package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MentorSelectionRequest - Request khi user chọn mentor
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorSelectionRequest {
    private String userId;
    private String questionEscalationId;
    private String selectedMentorId;
}
