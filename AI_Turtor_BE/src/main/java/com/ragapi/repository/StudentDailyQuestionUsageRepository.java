package com.ragapi.repository;

import com.ragapi.entity.StudentDailyQuestionUsage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface StudentDailyQuestionUsageRepository extends MongoRepository<StudentDailyQuestionUsage, String> {
    List<StudentDailyQuestionUsage> findByStudentId(String studentId);
}
