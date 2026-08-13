package com.ragapi.util;

import com.ragapi.entity.CaseMemory;
import com.ragapi.entity.UserMemory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionRuleContext {
    private UserMemory userMemory;
    private CaseMemory caseMemory;
}
