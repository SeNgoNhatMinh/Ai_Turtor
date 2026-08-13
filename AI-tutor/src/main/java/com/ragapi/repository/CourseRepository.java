package com.ragapi.repository;

import com.ragapi.entity.Course;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends MongoRepository<Course, String> {

    Optional<Course> findByCourseId(String courseId);

    List<Course> findBySemesterId(String semesterId);
}
