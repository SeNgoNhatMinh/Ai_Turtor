package com.ragapi.repository;

import com.ragapi.entity.AssignmentSubmission;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssignmentSubmissionRepository extends MongoRepository<AssignmentSubmission, String> {

    Optional<AssignmentSubmission> findByAssignmentIdAndStudentId(String assignmentId, String studentId);

    List<AssignmentSubmission> findByAssignmentId(String assignmentId);

    List<AssignmentSubmission> findByStudentId(String studentId);

    List<AssignmentSubmission> findByCourseIdAndClassId(String courseId, String classId);

    List<AssignmentSubmission> findByTeacherId(String teacherId);
}
