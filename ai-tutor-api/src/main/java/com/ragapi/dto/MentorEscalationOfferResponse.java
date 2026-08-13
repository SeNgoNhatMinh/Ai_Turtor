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
public class MentorEscalationOfferResponse {
    private String questionEscalationId;
    private Boolean shouldOfferMentorHelp;
    private List<MentorSuggestionDTO> suggestedMentors;
    private String message;
    private String escalationRoute;
    private String routeReason;
}
