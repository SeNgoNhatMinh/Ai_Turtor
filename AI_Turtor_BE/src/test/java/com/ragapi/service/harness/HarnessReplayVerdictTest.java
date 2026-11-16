package com.ragapi.service.harness;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HarnessReplayVerdictTest {
    @Test
    void recoveredAnswerIsBetter() {
        assertEquals("BETTER", HarnessReplayVerdict.decide(false, "A".repeat(40)));
    }

    @Test
    void escalationOrShortAnswerIsWorse() {
        assertEquals("WORSE", HarnessReplayVerdict.decide(true, "A".repeat(80)));
        assertEquals("WORSE", HarnessReplayVerdict.decide(false, "ngắn"));
    }
}
