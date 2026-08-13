package com.ragapi.repository;

import com.ragapi.entity.CourseEnrollment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseEnrollmentRepository extends MongoRepository<CourseEnrollment, String> {

    Optional<CourseEnrollment> findByStudentIdAndCourseIdAndClassId(String studentId, String courseId, String classId);

    List<CourseEnrollment> findByStudentId(String studentId);

    List<CourseEnrollment> findByCourseIdAndClassId(String courseId, String classId);

    List<CourseEnrollment> findByCourseId(String courseId);

    List<CourseEnrollment> findByStudentIdAndStatus(String studentId, String status);
}
