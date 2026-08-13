package com.ragapi.repository;

import com.ragapi.entity.ImprovePlan;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ImprovePlanRepository extends MongoRepository<ImprovePlan, String> {

    List<ImprovePlan> findByStudentId(String studentId);

    List<ImprovePlan> findByStudentIdAndCourseId(String studentId, String courseId);

    Optional<ImprovePlan> findFirstByStudentIdAndCourseIdAndStatusOrderByGeneratedAtDesc(String studentId, String courseId, String status);

    List<ImprovePlan> findByCourseId(String courseId);

    List<ImprovePlan> findByCourseIdAndClassId(String courseId, String classId);
}