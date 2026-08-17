package com.ragapi.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CanonicalTutorAnswerCacheServiceTest {

    @Test
    void buildKeyIsStableForSameQuestionRegardlessOfAccents() {
        String first = CanonicalTutorAnswerCacheService.buildKey("CEA201", "CEA201-01", "RAG", "JVM là gì?", null);
        String second = CanonicalTutorAnswerCacheService.buildKey("CEA201", "CEA201-01", "RAG", "jvm la gi", null);
        assertEquals(first, second);
    }

    @Test
    void buildKeyDiffersWhenCourseChanges() {
        String first = CanonicalTutorAnswerCacheService.buildKey("CEA201", null, "RAG", "JVM là gì?", null);
        String second = CanonicalTutorAnswerCacheService.buildKey("PRO192", null, "RAG", "JVM là gì?", null);
        org.junit.jupiter.api.Assertions.assertNotEquals(first, second);
    }
}
