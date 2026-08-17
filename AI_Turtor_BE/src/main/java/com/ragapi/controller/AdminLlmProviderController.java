package com.ragapi.controller;

import com.ragapi.dto.LlmProviderConfigView;
import com.ragapi.dto.UpdateLlmProviderRequest;
import com.ragapi.service.LlmProviderAdminService;
import com.ragapi.service.OpenRouterChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/llm-providers")
public class AdminLlmProviderController {

    private final OpenRouterChatService chatService;
    private final LlmProviderAdminService providerAdminService;

    @GetMapping
    public ResponseEntity<?> listProviders() {
        List<LlmProviderConfigView> providers = providerAdminService.listProviderConfigs();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", Instant.now());
        response.put("count", providers.size());
        response.put("providers", providers);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", Instant.now());
        response.put("scope", "CURRENT_BACKEND_RUNTIME");
        response.put("providers", chatService.providerStats());
        response.put("note", "Counters reset when the Backend container restarts.");
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{providerId}")
    public ResponseEntity<?> updateProvider(@PathVariable String providerId,
                                            @RequestBody UpdateLlmProviderRequest request,
                                            Authentication authentication) {
        try {
            LlmProviderConfigView updated = providerAdminService.updateProvider(
                    providerId,
                    request,
                    adminUserId(authentication));
            return ResponseEntity.ok(Map.of("status", "UPDATED", "provider", updated));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Failed to update LLM provider {}", providerId, error);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/{providerId}/enable")
    public ResponseEntity<?> enableProvider(@PathVariable String providerId, Authentication authentication) {
        return toggleProvider(providerId, true, authentication);
    }

    @PostMapping("/{providerId}/disable")
    public ResponseEntity<?> disableProvider(@PathVariable String providerId, Authentication authentication) {
        return toggleProvider(providerId, false, authentication);
    }

    @DeleteMapping("/{providerId}")
    public ResponseEntity<?> deleteProvider(@PathVariable String providerId, Authentication authentication) {
        try {
            LlmProviderConfigView deleted = providerAdminService.deleteProvider(providerId, adminUserId(authentication));
            return ResponseEntity.ok(Map.of("status", "DELETED", "provider", deleted));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Failed to delete LLM provider {}", providerId, error);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/{providerId}/restore")
    public ResponseEntity<?> restoreProvider(@PathVariable String providerId, Authentication authentication) {
        try {
            LlmProviderConfigView restored = providerAdminService.restoreProvider(providerId, adminUserId(authentication));
            return ResponseEntity.ok(Map.of("status", "RESTORED", "provider", restored));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Failed to restore LLM provider {}", providerId, error);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/reload")
    public ResponseEntity<?> reloadProviders() {
        try {
            providerAdminService.reloadRuntimeChain();
            return ResponseEntity.ok(Map.of(
                    "status", "RELOADED",
                    "providers", providerAdminService.listProviderConfigs(),
                    "runtimeStats", chatService.providerStats()
            ));
        } catch (Exception error) {
            log.error("Failed to reload LLM provider chain", error);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", error.getMessage()));
        }
    }

    private ResponseEntity<?> toggleProvider(String providerId, boolean enabled, Authentication authentication) {
        try {
            LlmProviderConfigView updated = providerAdminService.setEnabled(
                    providerId,
                    enabled,
                    adminUserId(authentication));
            return ResponseEntity.ok(Map.of(
                    "status", enabled ? "ENABLED" : "DISABLED",
                    "provider", updated));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            log.error("Failed to toggle LLM provider {}", providerId, error);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", error.getMessage()));
        }
    }

    private String adminUserId(Authentication authentication) {
        return authentication == null || authentication.getName() == null ? "admin" : authentication.getName();
    }
}
