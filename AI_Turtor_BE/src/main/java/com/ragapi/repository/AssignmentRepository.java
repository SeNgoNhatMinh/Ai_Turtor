package com.ragapi.repository;

import com.ragapi.entity.Assignment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentRepository extends MongoRepository<Assignment, String> {

    List<Assignment> findByCourseIdAndClassId(String courseId, String classId);

    List<Assignment> findByTeacherId(String teacherId);

    List<Assignment> findByCourseIdAndClassIdAndTeacherId(String courseId, String classId, String teacherId);
}
