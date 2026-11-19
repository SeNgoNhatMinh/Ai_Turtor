package com.ragapi.harness.answer.context;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImprovePlanChunkIdTest {

    @Test
    void derivesMaterialIdFromHierarchicalChunkId() {
        assertThat(CourseLessonContextService.materialIdFromChunkId(
                "banker-material:chapter:1:section:1:chunk:0"))
                .isEqualTo("banker-material");
    }

    @Test
    void returnsNullForBlankChunkId() {
        assertThat(CourseLessonContextService.materialIdFromChunkId("  ")).isNull();
        assertThat(CourseLessonContextService.materialIdFromChunkId(null)).isNull();
    }
}
