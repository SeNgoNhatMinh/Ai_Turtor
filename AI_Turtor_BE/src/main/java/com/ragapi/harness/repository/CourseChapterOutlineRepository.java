package com.ragapi.harness.repository;

import com.ragapi.harness.entity.CourseChapterOutline;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CourseChapterOutlineRepository extends MongoRepository<CourseChapterOutline, String> {
    List<CourseChapterOutline> findByCourseIdOrderByTitleAsc(String courseId);

    List<CourseChapterOutline> findByCourseIdAndStatusOrderByTitleAsc(String courseId, String status);

    Optional<CourseChapterOutline> findByCourseIdAndChapterKey(String courseId, String chapterKey);
}
