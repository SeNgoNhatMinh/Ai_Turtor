package com.ragapi.repository;

import com.ragapi.entity.StudentCourseMemory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentCourseMemoryRepository extends MongoRepository<StudentCourseMemory, String> {
    Optional<StudentCourseMemory> findByStudentIdAndCourseId(String studentId, String courseId);

    List<StudentCourseMemory> findByCourseId(String courseId);

    List<StudentCourseMemory> findByCourseIdAndClassId(String courseId, String classId);
}
