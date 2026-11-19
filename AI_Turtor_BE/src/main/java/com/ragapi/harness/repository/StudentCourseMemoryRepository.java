package com.ragapi.harness.repository;

import com.ragapi.harness.entity.StudentCourseMemory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentCourseMemoryRepository extends MongoRepository<StudentCourseMemory, String> {
    Optional<StudentCourseMemory> findByStudentIdAndCourseId(String studentId, String courseId);

    List<StudentCourseMemory> findByCourseId(String courseId);

    List<StudentCourseMemory> findByCourseIdAndClassId(String courseId, String classId);
}





