package com.ragapi.harness.curriculum;

import com.ragapi.infrastructure.elasticsearch.ElasticsearchCourseSearchAdapter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Copies chapter chunk text that indexing already stored into the shared memory map. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseIndexedChunkLoader {

    private final ElasticsearchCourseSearchAdapter searchAdapter;
    private final CourseChapterExcerptCache chapterExcerptCache;

    public void loadCourse(String courseId) {
        if (courseId == null || courseId.isBlank() || chapterExcerptCache.isLoaded(courseId)) {
            return;
        }
        replace(courseId.trim());
    }

    public void reloadCourse(String courseId) {
        if (courseId == null || courseId.isBlank()) {
            return;
        }
        chapterExcerptCache.evictCourse(courseId);
        replace(courseId.trim());
    }

    private void replace(String courseId) {
        chapterExcerptCache.replaceFromChunks(courseId, searchAdapter.listStoredChunks(courseId));
    }
}
