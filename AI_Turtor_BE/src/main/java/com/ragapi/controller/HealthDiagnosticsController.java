package com.ragapi.controller;

import com.ragapi.dto.LlmProviderConfigView;
import com.ragapi.service.LlmProviderAdminService;
import com.ragapi.util.LLMDiagnostics;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthDiagnosticsController {

    private final LLMDiagnostics llmDiagnostics;
    private final LlmProviderAdminService llmProviderAdminService;

    @GetMapping("/llm-diagnostics")
    public ResponseEntity<Map<String, Object>> runLlmDiagnostics() {
        LLMDiagnostics.DiagnosticResult result = llmDiagnostics.runDiagnostics();
        List<LlmProviderConfigView> providers = llmProviderAdminService.listProviderConfigs();
        long activeProviders = providers.stream().filter(LlmProviderConfigView::isEffectiveEnabled).count();

        Map<String, Object> configDetails = new LinkedHashMap<>();
        if (result.configDetails != null) {
            configDetails.putAll(result.configDetails);
        }
        configDetails.putIfAbsent("activeModel", configDetails.get("OpenRouter Model"));

        Map<String, Object> diagnostics = new LinkedHashMap<>();
        diagnostics.put("apiKeyValid", result.apiKeyValid);
        diagnostics.put("openRouterConnectivity", result.openRouterConnectivity);
        diagnostics.put("openRouterApiTest", result.openRouterApiTest);
        diagnostics.put("ollamaConnectivity", result.ollamaConnectivity);
        diagnostics.put("configDetails", configDetails);
        diagnostics.put("overallStatus", result.overallStatus);
        diagnostics.put("providers", providers);
        diagnostics.put("providerCount", providers.size());
        diagnostics.put("activeProviderCount", activeProviders);

        return ResponseEntity.ok(Map.of("diagnostics", diagnostics));
    }
}
