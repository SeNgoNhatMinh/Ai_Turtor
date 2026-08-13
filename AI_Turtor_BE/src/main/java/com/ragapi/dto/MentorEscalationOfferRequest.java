package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MentorEscalationOfferRequest - Request �'�f offer tư vấn cho user
 * (Được gửi từ backend sau 30s user hỏi)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorEscalationOfferRequest {
    private String userId;
    private String question;
    private String aiResponse;
}






