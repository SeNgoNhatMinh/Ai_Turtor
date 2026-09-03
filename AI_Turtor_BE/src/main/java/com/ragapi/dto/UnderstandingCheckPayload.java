package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Structured formative understanding check extracted from the tutor answer")
public class UnderstandingCheckPayload {

    private String question;
    private List<Option> options;

    @Schema(description = "Correct option key. The student UI reveals it only after a choice.")
    private String correctKey;

    private String explanation;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Option {
        private String key;
        private String text;
    }
}
