package com.ragapi.harness.curriculum;

import com.ragapi.harness.entity.CourseChapterOutline;
import com.ragapi.harness.repository.CourseChapterOutlineRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseChapterExcerptCacheTest {

    @Test
    void oneCourseIsLoadedOnceAndSharedUntilTheMaterialIsReindexed() {
        CourseChapterOutlineRepository repository = mock(CourseChapterOutlineRepository.class);
        when(repository.findByCourseIdOrderByTitleAsc("PRJ301")).thenReturn(List.of(
                CourseChapterOutline.builder()
                        .courseId("PRJ301")
                        .chapterKey("servlet")
                        .title("Servlet lifecycle")
                        .mentorExcerpt("x".repeat(12_050))
                        .build(),
                CourseChapterOutline.builder()
                        .courseId("PRJ301")
                        .chapterKey("empty")
                        .title("Empty")
                        .mentorExcerpt("  ")
                        .build()
        ));
        CourseChapterExcerptCache cache = new CourseChapterExcerptCache(repository);

        cache.loadCourse("PRJ301");
        cache.loadCourse(" PRJ301 ");

        assertTrue(cache.isLoaded("PRJ301"));
        assertEquals(12_000, cache.excerpt("PRJ301", "servlet").orElseThrow().length());
        assertFalse(cache.excerpt("PRJ301", "empty").isPresent());
        assertEquals("servlet", cache.match("PRJ301", "Giải thích Servlet lifecycle").orElseThrow().chapterKey());
        verify(repository, times(1)).findByCourseIdOrderByTitleAsc("PRJ301");

        cache.evictCourse("PRJ301");
        assertFalse(cache.isLoaded("PRJ301"));
        cache.loadCourse("PRJ301");
        verify(repository, times(2)).findByCourseIdOrderByTitleAsc("PRJ301");
    }

    @Test
    void indexedChunksReplaceTheCourseWithoutReadingMongo() {
        CourseChapterOutlineRepository repository = mock(CourseChapterOutlineRepository.class);
        CourseChapterExcerptCache cache = new CourseChapterExcerptCache(repository);
        cache.replaceFromChunks("CSD203", List.of(
                new com.ragapi.harness.model.RetrievedCourseChunk(
                        "loop body", 1.0, "material-1", "CSD203", null, null, null,
                        "PDF", "material-1", "algorithm-analysis", "Algorithm Analysis",
                        null, null, null, 0, "CHUNK", "en", List.of()),
                new com.ragapi.harness.model.RetrievedCourseChunk(
                        "vietnamese duplicate", 1.0, "material-1", "CSD203", null, null, null,
                        "PDF", "material-1", "algorithm-analysis", "Algorithm Analysis",
                        null, null, null, 1, "CHUNK", "vi", List.of())
        ));

        assertTrue(cache.isLoaded("CSD203"));
        assertEquals(1, cache.chapters("CSD203").size());
        assertEquals("loop body", cache.excerpt("CSD203", "algorithm-analysis").orElseThrow());
        verify(repository, times(0)).findByCourseIdOrderByTitleAsc("CSD203");
    }
}
