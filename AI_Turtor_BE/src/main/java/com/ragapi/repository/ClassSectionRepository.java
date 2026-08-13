package com.ragapi.repository;

import com.ragapi.entity.ClassSection;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassSectionRepository extends MongoRepository<ClassSection, String> {

    Optional<ClassSection> findByCourseIdAndClassId(String courseId, String classId);

    List<ClassSection> findByCourseId(String courseId);

    List<ClassSection> findByTeacherId(String teacherId);
}
