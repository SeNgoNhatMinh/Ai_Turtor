package com.ragapi.harness.repository;

import com.ragapi.harness.entity.StudentTeachingProfile;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface StudentTeachingProfileRepository extends MongoRepository<StudentTeachingProfile, String> {
    Optional<StudentTeachingProfile> findByStudentIdAndCourseId(String studentId, String courseId);
}
