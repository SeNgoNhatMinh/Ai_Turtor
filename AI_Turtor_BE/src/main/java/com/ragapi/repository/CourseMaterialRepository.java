package com.ragapi.repository;

import com.ragapi.entity.CourseMaterial;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CourseMaterialRepository
        extends MongoRepository<CourseMaterial, String> {

    List<CourseMaterial> findByCourseId(String courseId);

    long countByCourseIdAndIndexingStatus(String courseId, String indexingStatus);

    List<CourseMaterial> findByTeacherId(String teacherId);

    List<CourseMaterial> findBySourceType(String sourceType);

    Optional<CourseMaterial> findFirstByCourseIdAndContentHash(String courseId, String contentHash);

    Optional<CourseMaterial> findFirstByKnowledgeCandidateId(String knowledgeCandidateId);

    @Query(value = "{ '_id': ?0 }", fields = "{ 'content': 0 }")
    Optional<CourseMaterial> findOneByIdWithoutContent(String id);

    @Query(value = "{ '_id': { $in: ?0 } }", fields = "{ 'content': 0 }")
    List<CourseMaterial> findAllByIdWithoutContent(Collection<String> ids);
}





