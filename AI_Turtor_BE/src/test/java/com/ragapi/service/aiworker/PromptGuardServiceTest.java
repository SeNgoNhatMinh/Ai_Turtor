package com.ragapi.service.aiworker;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class PromptGuardServiceTest {

    private AiWorkerOrchestrator orchestrator;
    private PromptGuardService service;

    @BeforeEach
    void setUp() {
        orchestrator = mock(AiWorkerOrchestrator.class);
        service = new PromptGuardService(orchestrator, new ObjectMapper());
    }

    @Test
    void disabledGuardDoesNotCallExternalWorkers() {
        ReflectionTestUtils.setField(service, "enabled", false);
        ReflectionTestUtils.setField(service, "worker2Enabled", true);
        ReflectionTestUtils.setField(service, "worker3Enabled", true);
        ReflectionTestUtils.setField(service, "worker2ApiKey", "test-key");
        ReflectionTestUtils.setField(service, "worker3ApiKey", "test-key");

        assertFalse(service.isPromptAttack("Explain Java loops"));
        verifyNoInteractions(orchestrator);
    }

    @Test
    void workersDisabledFailsOpenWithoutCallingOrchestrator() {
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "worker2Enabled", false);
        ReflectionTestUtils.setField(service, "worker3Enabled", false);
        ReflectionTestUtils.setField(service, "worker2ApiKey", "test-key");
        ReflectionTestUtils.setField(service, "worker3ApiKey", "test-key");

        assertFalse(service.isPromptAttack("Explain Java loops"));
        verifyNoInteractions(orchestrator);
    }

    @Test
    void blankInputIsNotSentToWorkers() {
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "worker2Enabled", true);
        ReflectionTestUtils.setField(service, "worker3Enabled", true);
        ReflectionTestUtils.setField(service, "worker2ApiKey", "test-key");
        ReflectionTestUtils.setField(service, "worker3ApiKey", "test-key");

        assertFalse(service.isPromptAttack("  "));
        verifyNoInteractions(orchestrator);
    }
}
