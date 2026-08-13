package com.ragapi.repository;

import com.ragapi.entity.AiConversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AiConversationRepository extends MongoRepository<AiConversation, String> {

    Page<AiConversation> findByUserId(String userId, Pageable pageable);

    Page<AiConversation> findByUserIdAndCourseId(String userId, String courseId, Pageable pageable);

    List<AiConversation> findByUserIdAndCourseId(String userId, String courseId);

    Optional<AiConversation> findByIdAndUserId(String id, String userId);

    void deleteByIdAndUserId(String id, String userId);
}