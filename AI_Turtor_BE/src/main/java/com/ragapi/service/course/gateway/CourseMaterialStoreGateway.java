package com.ragapi.service.course.gateway;

import com.ragapi.entity.CourseMaterial;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Persistence operations required by the course RAG module. */
public interface CourseMaterialStoreGateway {

    CourseMaterial save(CourseMaterial material);

    Optional<CourseMaterial> findById(String materialId);

    List<CourseMaterial> findAllById(Collection<String> materialIds);

    List<CourseMaterial> findByCourseId(String courseId);

    List<CourseMaterial> findBySourceType(String sourceType);

    Optional<CourseMaterial> findFirstByCourseIdAndContentHash(String courseId, String contentHash);

    void deleteById(String materialId);
}
