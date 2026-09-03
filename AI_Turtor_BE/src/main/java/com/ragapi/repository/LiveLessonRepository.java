package com.ragapi.repository;

import com.ragapi.entity.LiveLesson;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LiveLessonRepository extends MongoRepository<LiveLesson, String> {

    List<LiveLesson> findByCourseIdAndClassIdOrderByStartsAtDesc(String courseId, String classId);

    List<LiveLesson> findByTeacherIdOrderByStartsAtDesc(String teacherId);

    List<LiveLesson> findByStatus(String status);
}
