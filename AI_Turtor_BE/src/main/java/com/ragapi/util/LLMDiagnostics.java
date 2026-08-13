package com.ragapi.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.*;

/**
 * Diagnostic utility ï¿½'ï¿½f test OpenRouter API + Ollama connection
 * GiÃºp debug lï¿½-i LLM service
 */
@Slf4j
@Component
public class LLMDiagnostics {

    @Value("${openrouter.api-key}")
    private String openRouterApiKey;

    @Value("${openrouter.base-url}")
    private String openRouterBaseUrl;

    @Value("${openrouter.model}")
    private String openRouterModel;

    @Value("${ollama.base-url}")
    private String ollamaBaseUrl;

    @Value("${ollama.embedding-model}")
    private String embeddingModel;

    @Value("${rag.embedding.provider:ollama}")
    private String embeddingProvider;

    @Value("${rag.embedding.openrouter.model:}")
    private String openRouterEmbeddingModel;

    /**
     * Run full diagnostics and return results
     */
    public DiagnosticResult runDiagnostics() {
        log.info("=== Starting LLM Diagnostics ===");

        DiagnosticResult result = new DiagnosticResult();

        // 1. Check OpenRouter API Key
        result.apiKeyValid = isApiKeyValid(openRouterApiKey);
        log.info("OpenRouter API Key Valid: {}", result.apiKeyValid);

        // 2. Test OpenRouter Connectivity
        result.openRouterConnectivity = testOpenRouterConnectivity();
        log.info("OpenRouter Connectivity: {}", result.openRouterConnectivity);

        // 3. Test OpenRouter API
        result.openRouterApiTest = testOpenRouterApi();
        log.info("OpenRouter API Response: {}", result.openRouterApiTest);

        // 4. Test Ollama Connectivity
        result.ollamaConnectivity = testOllamaConnectivity();
        log.info("Ollama Connectivity: {}", result.ollamaConnectivity);

        // 5. Check Configuration
        result.configDetails = new HashMap<>();
        result.configDetails.put("OpenRouter Base URL", openRouterBaseUrl);
        result.configDetails.put("OpenRouter Model", openRouterModel);
        result.configDetails.put("Ollama Base URL", ollamaBaseUrl);
        result.configDetails.put("Embedding Provider", embeddingProvider);
        result.configDetails.put("Embedding Model", "openrouter".equalsIgnoreCase(embeddingProvider)
                ? openRouterEmbeddingModel
                : embeddingModel);
        result.configDetails.put("API Key (masked)", maskApiKey(openRouterApiKey));

        // 6. Overall Status
        result.overallStatus = determineOverallStatus(result);

        log.info("=== Diagnostics Complete ===");
        return result;
    }

    /**
     * Test OpenRouter API Connectivity
     */
    private boolean testOpenRouterConnectivity() {
        try {
            URL url = new URL(openRouterBaseUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(5000);
            int responseCode = conn.getResponseCode();
            conn.disconnect();
            
            boolean success = (responseCode >= 200 && responseCode < 300);
            log.info("OpenRouter connectivity test: HTTP {}", responseCode);
            return success;
            
        } catch (ConnectException e) {
            log.error("OpenRouter connection refused - check base URL: {}", openRouterBaseUrl);
            return false;
        } catch (SocketTimeoutException e) {
            log.error("OpenRouter connection timeout - network issue?");
            return false;
        } catch (IOException e) {
            log.error("OpenRouter connectivity error: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Test OpenRouter API with simple request
     */
    private String testOpenRouterApi() {
        try {
            log.info("Testing OpenRouter API with model: {}", openRouterModel);
            
            // Note: We can't easily test without creating the actual LLM client
            // This is a placeholder for full integration test
            
            if (!openRouterApiKey.startsWith("sk-or")) {
                return "INVALID_KEY_FORMAT";
            }

            if (openRouterApiKey.length() < 50) {
                return "KEY_TOO_SHORT";
            }

            return "KEY_FORMAT_OK";
            
        } catch (Exception e) {
            log.error("OpenRouter API test failed: {}", e.getMessage());
            return "TEST_FAILED: " + e.getMessage();
        }
    }

    /**
     * Test Ollama Connectivity
     */
    private boolean testOllamaConnectivity() {
        try {
            String healthUrl = ollamaBaseUrl + "/api/tags";
            URL url = new URL(healthUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            int responseCode = conn.getResponseCode();
            conn.disconnect();
            
            boolean success = (responseCode >= 200 && responseCode < 300);
            log.info("Ollama connectivity test: HTTP {}", responseCode);
            return success;
            
        } catch (ConnectException e) {
            log.error("Ollama connection refused - is Ollama running on {}?", ollamaBaseUrl);
            return false;
        } catch (SocketTimeoutException e) {
            log.error("Ollama connection timeout - network issue or Ollama not responding?");
            return false;
        } catch (IOException e) {
            log.error("Ollama connectivity error: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Validate API Key format
     */
    private boolean isApiKeyValid(String apiKey) {
        return apiKey != null && 
               !apiKey.isEmpty() && 
               !apiKey.contains("YOUR_KEY") &&
               !apiKey.contains("sk-proj");
    }

    /**
     * Mask API Key for logging (show only first 10 and last 4 chars)
     */
    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.length() <= 14) {
            return "***INVALID***";
        }
        return apiKey.substring(0, 10) + "..." + apiKey.substring(apiKey.length() - 4);
    }

    /**
     * Determine overall status based on individual test results
     */
    private String determineOverallStatus(DiagnosticResult result) {
        if (!result.apiKeyValid) {
            return "FAILED: OpenRouter API Key invalid or not configured";
        }
        if (!result.openRouterConnectivity) {
            return "FAILED: Cannot connect to OpenRouter - check network/firewall";
        }
        if (!result.ollamaConnectivity) {
            return "WARNING: Cannot connect to Ollama - embedding may fail";
        }
        if (!result.openRouterApiTest.equals("KEY_FORMAT_OK")) {
            return "WARNING: OpenRouter API key format issue";
        }
        if (result.openRouterConnectivity && result.ollamaConnectivity && result.apiKeyValid) {
            return "OK: All services appear to be configured correctly";
        }
        return "UNKNOWN: Check logs for more details";
    }

    /**
     * Result object for diagnostics
     */
    public static class DiagnosticResult {
        public boolean apiKeyValid;
        public boolean openRouterConnectivity;
        public String openRouterApiTest;
        public boolean ollamaConnectivity;
        public Map<String, String> configDetails;
        public String overallStatus;

        @Override
        public String toString() {
            return """
                    
                    ===== LLM DIAGNOSTICS RESULT =====
                    API Key Valid: %s
                    OpenRouter Connectivity: %s
                    OpenRouter API Test: %s
                    Ollama Connectivity: %s
                    
                    Configuration:
                    %s
                    
                    Overall Status: %s
                    ==================================
                    """.formatted(
                    apiKeyValid ? "YES" : "NO",
                    openRouterConnectivity ? "YES" : "NO",
                    openRouterApiTest,
                    ollamaConnectivity ? "YES" : "NO",
                    configDetailsToString(),
                    overallStatus
            );
        }

        private String configDetailsToString() {
            StringBuilder sb = new StringBuilder();
            configDetails.forEach((k, v) -> sb.append("  ").append(k).append(": ").append(v).append("\n"));
            return sb.toString();
        }
    }
}






