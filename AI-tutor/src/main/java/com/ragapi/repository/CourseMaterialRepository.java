package com.ragapi.repository;

import com.ragapi.entity.CourseMaterial;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CourseMaterialRepository
        extends MongoRepository<CourseMaterial, String> {

    List<CourseMaterial> findByCourseId(String courseId);

    List<CourseMaterial> findByTeacherId(String teacherId);

    Optional<CourseMaterial> findFirstByCourseIdAndContentHash(String courseId, String contentHash);
}
