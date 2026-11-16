package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class HarnessRoutingTest {

    @Test
    void mapsN8nAndBackendModeNames() {
        assertEquals("RAG", HarnessRouting.normalizeMode("RAG"));
        assertEquals("RAG", HarnessRouting.normalizeMode("RAG_TUTOR"));
        assertEquals("CODE", HarnessRouting.normalizeMode("CODE"));
        assertEquals("CODE", HarnessRouting.normalizeMode("code_mentor"));
        assertEquals("ESCALATE", HarnessRouting.normalizeMode("ESCALATE"));
        assertEquals("REFUSE", HarnessRouting.normalizeMode("REFUSE"));
        assertEquals("REFUSE", HarnessRouting.normalizeMode("LOCAL"));
        assertEquals("CURRICULUM", HarnessRouting.normalizeMode("curriculum"));
    }

    @Test
    void ignoresBlankOrUnknownSoQueryKeepsInternalClassifier() {
        assertNull(HarnessRouting.normalizeMode(null));
        assertNull(HarnessRouting.normalizeMode(""));
        assertNull(HarnessRouting.normalizeMode("CHAT"));
    }
}
