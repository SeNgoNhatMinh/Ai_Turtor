package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MentorEscalationCancelRequest - Request cancel tư vấn
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorEscalationCancelRequest {
    private String questionEscalationId;
    private String userId;
    private String reason;
}
