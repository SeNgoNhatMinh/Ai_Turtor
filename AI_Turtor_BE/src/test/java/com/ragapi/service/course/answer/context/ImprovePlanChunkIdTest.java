package com.ragapi.service.course.answer.context;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImprovePlanChunkIdTest {

    @Test
    void derivesMaterialIdFromHierarchicalChunkId() {
        assertThat(CourseImprovePlanContextService.materialIdFromChunkId(
                "banker-material:chapter:1:section:1:chunk:0"))
                .isEqualTo("banker-material");
    }

    @Test
    void returnsNullForBlankChunkId() {
        assertThat(CourseImprovePlanContextService.materialIdFromChunkId("  ")).isNull();
        assertThat(CourseImprovePlanContextService.materialIdFromChunkId(null)).isNull();
    }
}
