package com.ragapi.repository;

import com.ragapi.entity.TeachingBehavior;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;

public interface TeachingBehaviorRepository extends MongoRepository<TeachingBehavior, String> {
    List<TeachingBehavior> findBySourceReviewId(String sourceReviewId);

    List<TeachingBehavior> findByScopeAndStudentIdAndCourseIdAndStatusIn(
            String scope, String studentId, String courseId, Collection<String> statuses);

    List<TeachingBehavior> findTop500ByScopeAndCourseIdAndStatus(String scope, String courseId, String status);

    List<TeachingBehavior> findTop500ByScopeAndDomainAndStatus(String scope, String domain, String status);

    List<TeachingBehavior> findTop500ByScopeAndStatus(String scope, String status);

    List<TeachingBehavior> findByScopeAndStatus(String scope, String status);
}
