package com.ragapi.infrastructure.mongodb;

import com.ragapi.entity.CourseMaterial;
import com.ragapi.repository.CourseMaterialRepository;
import com.ragapi.service.course.gateway.CourseMaterialStoreGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** MongoDB adapter for course material persistence. */
@Component
@RequiredArgsConstructor
public class MongoCourseMaterialAdapter implements CourseMaterialStoreGateway {

    private final CourseMaterialRepository repository;

    @Override
    public CourseMaterial save(CourseMaterial material) {
        return repository.save(material);
    }

    @Override
    public Optional<CourseMaterial> findById(String materialId) {
        return repository.findById(materialId);
    }

    @Override
    public List<CourseMaterial> findAllById(Collection<String> materialIds) {
        return repository.findAllById(materialIds);
    }

    @Override
    public List<CourseMaterial> findByCourseId(String courseId) {
        return repository.findByCourseId(courseId);
    }

    @Override
    public List<CourseMaterial> findBySourceType(String sourceType) {
        return repository.findBySourceType(sourceType);
    }

    @Override
    public Optional<CourseMaterial> findFirstByCourseIdAndContentHash(String courseId, String contentHash) {
        return repository.findFirstByCourseIdAndContentHash(courseId, contentHash);
    }

    @Override
    public void deleteById(String materialId) {
        repository.deleteById(materialId);
    }
}
