package com.ragapi.service.behavior;

import com.ragapi.dto.TeachingStrategyRecommendation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Validates and normalizes LLM strategyRecommendations against the catalog.
 * Unknown codes, weak confidence, and fabricated empty evidence are dropped.
 */
public final class TeachingStrategyRecommendationParser {

    public static final double MIN_CONFIDENCE = 0.55;
    public static final int MAX_ITEMS = 3;

    private TeachingStrategyRecommendationParser() {
    }

    @SuppressWarnings("unchecked")
    public static List<TeachingStrategyRecommendation> parse(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return List.of();
        }
        List<TeachingStrategyRecommendation> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (Object item : list) {
            if (result.size() >= MAX_ITEMS) break;
            if (!(item instanceof Map<?, ?> map)) continue;
            TeachingStrategyRecommendation parsed = fromMap((Map<String, Object>) map);
            if (parsed == null) continue;
            if (!seen.add(parsed.getStrategyCode())) continue;
            result.add(parsed);
        }
        return List.copyOf(result);
    }

    /** Legacy free-text styles → structured recommendations when LLM omitted the new field. */
    public static List<TeachingStrategyRecommendation> fromLegacyTexts(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();
        List<TeachingStrategyRecommendation> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String text : texts) {
            if (result.size() >= MAX_ITEMS) break;
            TeachingStrategyCatalog catalog = TeachingStrategyCatalog.fromLegacyLabel(text).orElse(null);
            if (catalog == null || !seen.add(catalog.code())) continue;
            result.add(TeachingStrategyRecommendation.builder()
                    .strategyCode(catalog.code())
                    .strategyName(catalog.displayName())
                    .description(catalog.shortDescription())
                    .reason(text)
                    .supportingEvidence(List.of())
                    .priority("MEDIUM")
                    .confidence(0.6)
                    .suggestedDuration("NEXT_5_SESSIONS")
                    .build());
        }
        return List.copyOf(result);
    }

    public static List<String> legacyDisplayTexts(List<TeachingStrategyRecommendation> recommendations) {
        if (recommendations == null || recommendations.isEmpty()) return List.of();
        List<String> texts = new ArrayList<>();
        for (TeachingStrategyRecommendation item : recommendations) {
            TeachingStrategyCatalog catalog = TeachingStrategyCatalog.fromCode(item.getStrategyCode()).orElse(null);
            String name = catalog == null ? item.getStrategyName() : catalog.displayName();
            String reason = item.getReason() == null ? "" : item.getReason().trim();
            texts.add(reason.isBlank() ? name : name + ": " + reason);
        }
        return List.copyOf(texts);
    }

    private static TeachingStrategyRecommendation fromMap(Map<String, Object> map) {
        TeachingStrategyCatalog catalog = TeachingStrategyCatalog.fromCode(string(map.get("strategyCode")))
                .orElse(null);
        if (catalog == null) return null;
        double confidence = number(map.get("confidence"), 0.0);
        if (confidence > 0 && confidence < MIN_CONFIDENCE) return null;
        List<Map<String, Object>> evidence = evidenceList(map.get("supportingEvidence"));
        // Allow empty evidence only at medium confidence when a clear reason is present.
        String reason = string(map.get("reason"));
        if (evidence.isEmpty() && (reason.isBlank() || confidence < 0.7)) {
            return null;
        }
        String priority = string(map.get("priority")).toUpperCase(Locale.ROOT);
        if (!Set.of("HIGH", "MEDIUM", "LOW").contains(priority)) {
            priority = confidence >= 0.8 ? "HIGH" : "MEDIUM";
        }
        return TeachingStrategyRecommendation.builder()
                .strategyCode(catalog.code())
                .strategyName(catalog.displayName())
                .description(catalog.shortDescription())
                .reason(reason.isBlank() ? catalog.shortDescription() : reason)
                .supportingEvidence(evidence)
                .targetLearningProblem(string(map.get("targetLearningProblem")))
                .expectedOutcome(string(map.get("expectedOutcome")))
                .priority(priority)
                .confidence(confidence <= 0 ? 0.7 : Math.min(1.0, confidence))
                .suggestedDuration(string(map.get("suggestedDuration")).isBlank()
                        ? "NEXT_5_SESSIONS" : string(map.get("suggestedDuration")))
                .build();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> evidenceList(Object raw) {
        if (!(raw instanceof List<?> list)) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            String description = string(map.get("description"));
            if (description.isBlank()) continue;
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("evidenceType", string(map.get("evidenceType")).isBlank()
                    ? "CHAT" : string(map.get("evidenceType")).toUpperCase(Locale.ROOT));
            normalized.put("referenceId", string(map.get("referenceId")));
            normalized.put("description", description);
            result.add(normalized);
            if (result.size() >= 5) break;
        }
        return List.copyOf(result);
    }

    private static String string(Object value) {
        return value == null ? "" : Objects.toString(value, "").trim();
    }

    private static double number(Object value, double fallback) {
        if (value instanceof Number number) return number.doubleValue();
        if (value == null) return fallback;
        try {
            return Double.parseDouble(value.toString().trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
