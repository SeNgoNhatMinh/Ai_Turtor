package com.ragapi.harness.util;

import com.ragapi.harness.entity.CaseMemory;
import com.ragapi.harness.entity.UserMemory;
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






