package com.ragapi.repository;

import com.ragapi.entity.ExpertTask;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ExpertTaskRepository extends MongoRepository<ExpertTask, String> {
    List<ExpertTask> findByStatusOrderByPriorityDescCreatedAtAsc(String status);
    List<ExpertTask> findByAssigneeIdOrderByCreatedAtDesc(String assigneeId);
    List<ExpertTask> findByCourseIdOrderByCreatedAtDesc(String courseId);
    List<ExpertTask> findByCourseIdAndChapterOrderByCreatedAtDesc(String courseId, String chapter);
}
