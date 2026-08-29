package com.ragapi.repository;

import com.ragapi.entity.PedagogicalDirective;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PedagogicalDirectiveRepository extends MongoRepository<PedagogicalDirective, String> {
    List<PedagogicalDirective> findByCourseIdAndClassIdOrderByPriorityDescUpdatedAtDesc(String courseId, String classId);
    List<PedagogicalDirective> findByStudentIdAndCourseIdAndStatusOrderByPriorityDescUpdatedAtDesc(
            String studentId, String courseId, String status);
    List<PedagogicalDirective> findByCourseIdAndClassIdAndStatusOrderByPriorityDescUpdatedAtDesc(
            String courseId, String classId, String status);
}
