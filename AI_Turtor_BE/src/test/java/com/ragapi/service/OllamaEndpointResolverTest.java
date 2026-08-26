package com.ragapi.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OllamaEndpointResolverTest {

    @Test
    void candidates_preferConfiguredThenLocalFallbacks() {
        List<String> candidates = OllamaEndpointResolver.candidates("http://host.docker.internal:11434");

        assertThat(candidates.get(0)).isEqualTo("http://host.docker.internal:11434");
        assertThat(candidates).contains("http://127.0.0.1:11434", "http://localhost:11434");
    }

    @Test
    void candidates_includeLocalDefaultsWhenConfiguredBlank() {
        List<String> candidates = OllamaEndpointResolver.candidates(" ");

        assertThat(candidates).containsExactly("http://127.0.0.1:11434", "http://localhost:11434");
    }
}
