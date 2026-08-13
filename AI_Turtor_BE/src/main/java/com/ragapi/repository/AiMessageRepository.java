package com.ragapi.repository;

import com.ragapi.entity.AiMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AiMessageRepository extends MongoRepository<AiMessage, String> {

    Page<AiMessage> findByConversationId(String conversationId, Pageable pageable);

    long countByConversationId(String conversationId);

    long countByConversationIdAndRole(String conversationId, String role);

    Optional<AiMessage> findByIdAndConversationIdAndUserId(String id, String conversationId, String userId);

    List<AiMessage> findByConversationIdAndPinnedTrueOrderByPinnedAtDesc(String conversationId);

    Page<AiMessage> findByUserIdAndContentContainingIgnoreCase(String userId, String keyword, Pageable pageable);

    void deleteByConversationId(String conversationId);
}