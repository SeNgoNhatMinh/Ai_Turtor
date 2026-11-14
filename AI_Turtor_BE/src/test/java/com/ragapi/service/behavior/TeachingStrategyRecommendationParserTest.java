package com.ragapi.service.behavior;

import com.ragapi.dto.TeachingStrategyRecommendation;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TeachingStrategyRecommendationParserTest {

    @Test
    void dropsUnknownStrategyCodes() {
        List<TeachingStrategyRecommendation> parsed = TeachingStrategyRecommendationParser.parse(List.of(
                Map.of("strategyCode", "FAKE_CODE", "reason", "x", "confidence", 0.9,
                        "supportingEvidence", List.of(Map.of("description", "evidence")))
        ));
        assertThat(parsed).isEmpty();
    }

    @Test
    void dropsLowConfidenceWithoutStrongEvidence() {
        List<TeachingStrategyRecommendation> parsed = TeachingStrategyRecommendationParser.parse(List.of(
                Map.of("strategyCode", "STEP_BY_STEP", "reason", "weak", "confidence", 0.2,
                        "supportingEvidence", List.of(Map.of("description", "asked again")))
        ));
        assertThat(parsed).isEmpty();
    }

    @Test
    void acceptsKnownCodeWithEvidence() {
        List<TeachingStrategyRecommendation> parsed = TeachingStrategyRecommendationParser.parse(List.of(
                Map.of(
                        "strategyCode", "STEP_BY_STEP",
                        "reason", "Sinh viên cần chia nhỏ logic vòng lặp",
                        "confidence", 0.88,
                        "priority", "HIGH",
                        "supportingEvidence", List.of(Map.of(
                                "evidenceType", "CHAT",
                                "referenceId", "msg-1",
                                "description", "Hỏi lại logic vòng lặp nhiều lần"
                        ))
                )
        ));
        assertThat(parsed).hasSize(1);
        assertThat(parsed.get(0).getStrategyCode()).isEqualTo("STEP_BY_STEP");
        assertThat(parsed.get(0).getStrategyName()).isEqualTo("Giải thích từng bước");
    }

    @Test
    void deduplicatesRepeatedCodes() {
        List<TeachingStrategyRecommendation> parsed = TeachingStrategyRecommendationParser.parse(List.of(
                Map.of("strategyCode", "VISUAL_EXAMPLES", "reason", "a", "confidence", 0.9,
                        "supportingEvidence", List.of(Map.of("description", "e1"))),
                Map.of("strategyCode", "VISUAL_EXAMPLES", "reason", "b", "confidence", 0.9,
                        "supportingEvidence", List.of(Map.of("description", "e2")))
        ));
        assertThat(parsed).hasSize(1);
    }

    @Test
    void activeContextIncludesOnlyCatalogInstructions() {
        String block = TeachingStrategyCatalog.activeContextBlock(List.of(
                TeachingStrategyCatalog.STEP_BY_STEP,
                TeachingStrategyCatalog.MISCONCEPTION_REMEDIATION
        ));
        assertThat(block).contains("ACTIVE TEACHING STRATEGIES")
                .contains("STEP_BY_STEP")
                .contains("MISCONCEPTION_REMEDIATION")
                .contains("COURSE MATERIAL CONTEXT");
    }
}
