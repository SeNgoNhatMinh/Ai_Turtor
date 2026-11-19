package com.ragapi.harness.routing;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TutorQueryTurnTeachingBehaviorEmbeddingTest {

    @Test
    void storedChapterSkipsTheTeachingBehaviorEmbedding() {
        assertFalse(TutorQueryTurn.embedsTeachingBehavior(false, false, false, true));
    }

    @Test
    void unmatchedQuestionStillEmbedsTeachingBehavior() {
        assertTrue(TutorQueryTurn.embedsTeachingBehavior(false, false, false, false));
    }

    @Test
    void guidedLessonAndLearningPathDoNotEmbed() {
        assertFalse(TutorQueryTurn.embedsTeachingBehavior(false, false, true, false));
        assertFalse(TutorQueryTurn.embedsTeachingBehavior(false, true, false, false));
        assertFalse(TutorQueryTurn.embedsTeachingBehavior(true, false, false, false));
    }
}
