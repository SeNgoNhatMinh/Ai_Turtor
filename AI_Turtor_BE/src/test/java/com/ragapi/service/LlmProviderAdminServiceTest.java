package com.ragapi.service;

import com.ragapi.dto.UpdateLlmProviderRequest;
import com.ragapi.entity.LlmProviderOverride;
import com.ragapi.repository.LlmProviderOverrideRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LlmProviderAdminServiceTest {

    @Mock
    private LlmProviderOverrideRepository overrideRepository;

    @Mock
    private OpenRouterChatService chatService;

    @InjectMocks
    private LlmProviderAdminService service;

    private final List<LlmProviderOverride> overrides = new ArrayList<>();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "primaryEnabled", true);
        ReflectionTestUtils.setField(service, "primaryApiKey", "primary-key");
        ReflectionTestUtils.setField(service, "primaryBaseUrl", "https://openrouter.ai/api/v1");
        ReflectionTestUtils.setField(service, "primaryModelName", "openrouter/primary-model");
        ReflectionTestUtils.setField(service, "groqEnabled", true);
        ReflectionTestUtils.setField(service, "groqApiKey", "groq-key");
        ReflectionTestUtils.setField(service, "groqBaseUrl", "https://api.groq.com/openai/v1");
        ReflectionTestUtils.setField(service, "groqModelName", "groq/model-a");
        ReflectionTestUtils.setField(service, "groqModelNames", "");
        ReflectionTestUtils.setField(service, "groqDisabledModelNames", "");
        ReflectionTestUtils.setField(service, "nvidiaEnabled", false);
        ReflectionTestUtils.setField(service, "nvidiaModelNames", "");
        ReflectionTestUtils.setField(service, "fallbackEnabled", false);
        ReflectionTestUtils.setField(service, "freeRouterEnabled", false);
        ReflectionTestUtils.setField(service, "ollamaChatEnabled", false);
        ReflectionTestUtils.setField(service, "ollamaChatModelName", "");
        when(overrideRepository.findAll()).thenAnswer(invocation -> List.copyOf(overrides));
        when(overrideRepository.findById(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> overrides.stream()
                        .filter(item -> item.getProviderId().equals(invocation.getArgument(0)))
                        .findFirst());
        when(overrideRepository.save(any(LlmProviderOverride.class))).thenAnswer(invocation -> {
            LlmProviderOverride saved = invocation.getArgument(0);
            overrides.removeIf(item -> item.getProviderId().equals(saved.getProviderId()));
            overrides.add(saved);
            return saved;
        });
        overrides.clear();
    }

    @Test
    void listProviderConfigs_exposesEffectiveModelWithoutApiKey() {
        var configs = service.listProviderConfigs();
        assertThat(configs).anySatisfy(view -> {
            assertThat(view.getProviderId()).isEqualTo("groq-1");
            assertThat(view.getEffectiveModel()).isEqualTo("groq/model-a");
            assertThat(view.isApiKeyConfigured()).isTrue();
            assertThat(view.isEffectiveEnabled()).isTrue();
        });
    }

    @Test
    void disableProvider_persistsOverrideAndReloadsChain() {
        when(overrideRepository.findById("groq-1")).thenReturn(Optional.empty());

        UpdateLlmProviderRequest request = new UpdateLlmProviderRequest();
        request.setEnabled(false);
        var updated = service.updateProvider("groq-1", request, "admin-1");

        assertThat(updated.isEffectiveEnabled()).isFalse();
        verify(chatService).reloadProviderChain();
    }

    @Test
    void deleteProvider_marksDeletedAndRemovesFromActiveSlots() {
        when(overrideRepository.findById("groq-1")).thenReturn(Optional.empty());

        service.deleteProvider("groq-1", "admin-1");

        ArgumentCaptor<LlmProviderOverride> captor = ArgumentCaptor.forClass(LlmProviderOverride.class);
        verify(overrideRepository).save(captor.capture());
        assertThat(captor.getValue().getDeleted()).isTrue();
        assertThat(captor.getValue().getEnabled()).isFalse();
        assertThat(service.activeRuntimeSlots()).noneMatch(slot -> slot.providerId().equals("groq-1"));
        verify(chatService).reloadProviderChain();
    }

    @Test
    void updateProvider_canOverrideModel() {
        when(overrideRepository.findById("groq-1")).thenReturn(Optional.empty());

        UpdateLlmProviderRequest request = new UpdateLlmProviderRequest();
        request.setModel("groq/custom-model");
        var updated = service.updateProvider("groq-1", request, "admin-1");

        assertThat(updated.getEffectiveModel()).isEqualTo("groq/custom-model");
        assertThat(service.activeRuntimeSlots())
                .anyMatch(slot -> slot.providerId().equals("groq-1") && slot.model().equals("groq/custom-model"));
    }

    @Test
    void restoreProvider_clearsDeletedFlag() {
        LlmProviderOverride existing = LlmProviderOverride.builder()
                .providerId("groq-1")
                .deleted(true)
                .enabled(false)
                .build();
        when(overrideRepository.findById("groq-1")).thenReturn(Optional.of(existing));

        var restored = service.restoreProvider("groq-1", "admin-1");

        assertThat(restored.isAdminDeleted()).isFalse();
        assertThat(restored.isEffectiveEnabled()).isTrue();
        verify(chatService).reloadProviderChain();
    }

    @Test
    void unknownProviderId_throws() {
        assertThatThrownBy(() -> service.deleteProvider("unknown-provider", "admin-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown providerId");
        verify(chatService, never()).reloadProviderChain();
    }

    @Test
    void disabledGroqModels_areSkippedWithoutRenumberingRemainingSlots() {
        ReflectionTestUtils.setField(service, "groqModelNames",
                "openai/gpt-oss-120b,llama-3.3-70b-versatile,openai/gpt-oss-20b,llama-3.1-8b-instant");
        ReflectionTestUtils.setField(service, "groqDisabledModelNames",
                "LLAMA-3.3-70B-VERSATILE, llama-3.1-8b-instant");

        assertThat(service.listProviderConfigs())
                .filteredOn(view -> view.getFamily().equals("groq"))
                .extracting(view -> view.getProviderId() + ":" + view.getEffectiveModel())
                .containsExactly(
                        "groq-1:openai/gpt-oss-120b",
                        "groq-3:openai/gpt-oss-20b");
    }
}
