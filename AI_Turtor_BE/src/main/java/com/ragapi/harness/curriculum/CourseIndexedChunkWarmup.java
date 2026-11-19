package com.ragapi.harness.curriculum;

import com.ragapi.entity.Course;
import com.ragapi.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Restores indexed chapter chunks into memory after a restart. Does not reindex. */
@Slf4j
@Component
@Order
@RequiredArgsConstructor
public class CourseIndexedChunkWarmup implements ApplicationRunner {

    private final CourseRepository courseRepository;
    private final CourseIndexedChunkLoader chunkLoader;

    @Override
    public void run(ApplicationArguments args) {
        for (Course course : courseRepository.findAll()) {
            String courseId = course == null ? null : course.getCourseId();
            if (courseId == null || courseId.isBlank()) {
                continue;
            }
            try {
                chunkLoader.loadCourse(courseId);
            } catch (RuntimeException exception) {
                log.warn("Could not warm indexed chapter chunks for courseId={}: {}",
                        courseId, exception.getMessage());
            }
        }
    }
}
