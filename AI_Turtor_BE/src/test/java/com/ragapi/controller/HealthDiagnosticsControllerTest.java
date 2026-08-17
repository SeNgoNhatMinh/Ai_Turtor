package com.ragapi.controller;

import com.ragapi.dto.LlmProviderConfigView;
import com.ragapi.service.LlmProviderAdminService;
import com.ragapi.util.LLMDiagnostics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HealthDiagnosticsControllerTest {

    @Mock
    private LLMDiagnostics llmDiagnostics;

    @Mock
    private LlmProviderAdminService llmProviderAdminService;

    @InjectMocks
    private HealthDiagnosticsController controller;

    @Test
    void runLlmDiagnostics_exposesFrontendContract() {
        LLMDiagnostics.DiagnosticResult result = new LLMDiagnostics.DiagnosticResult();
        result.apiKeyValid = true;
        result.openRouterConnectivity = true;
        result.openRouterApiTest = "KEY_FORMAT_OK";
        result.ollamaConnectivity = false;
        result.overallStatus = "WARNING: Cannot connect to Ollama - embedding may fail";
        result.configDetails = new HashMap<>(Map.of(
                "OpenRouter Model", "google/gemma-2-9b-it",
                "Ollama Base URL", "http://localhost:11434"
        ));

        when(llmDiagnostics.runDiagnostics()).thenReturn(result);
        when(llmProviderAdminService.listProviderConfigs()).thenReturn(List.of(
                LlmProviderConfigView.builder()
                        .providerId("groq-1")
                        .label("Groq 1")
                        .effectiveModel("openai/gpt-oss-120b")
                        .effectiveEnabled(true)
                        .build(),
                LlmProviderConfigView.builder()
                        .providerId("openrouter-primary")
                        .label("OpenRouter primary")
                        .effectiveModel("google/gemma-2-9b-it")
                        .effectiveEnabled(true)
                        .build()
        ));

        ResponseEntity<Map<String, Object>> response = controller.runLlmDiagnostics();

        @SuppressWarnings("unchecked")
        Map<String, Object> diagnostics = (Map<String, Object>) response.getBody().get("diagnostics");
        assertTrue((Boolean) diagnostics.get("apiKeyValid"));
        assertEquals("google/gemma-2-9b-it", ((Map<?, ?>) diagnostics.get("configDetails")).get("activeModel"));
        assertEquals(2, diagnostics.get("providerCount"));
        assertEquals(2L, diagnostics.get("activeProviderCount"));
        assertEquals(2, ((List<?>) diagnostics.get("providers")).size());
    }
}
