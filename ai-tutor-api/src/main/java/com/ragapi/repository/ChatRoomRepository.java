package com.ragapi.repository;

import com.ragapi.entity.ChatRoom;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {

    /**
     * Tìm chat room theo userId
     */
    List<ChatRoom> findByUserId(String userId);

    /**
     * Tìm chat room theo mentorId
     */
    List<ChatRoom> findByMentorId(String mentorId);

    /**
     * Tìm chat room hoạt �'�Tng giữa user và mentor
     */
    Optional<ChatRoom> findByUserIdAndMentorIdAndStatus(String userId, String mentorId, String status);

    /**
     * Tìm chat room theo status
     */
    List<ChatRoom> findByStatus(String status);

    /**
     * Tìm chat room theo questionEscalationId
     */
    Optional<ChatRoom> findByQuestionEscalationId(String questionEscalationId);

    /**
     * Tìm chat room có tin nhắn chưa �'ọc
     */
    List<ChatRoom> findByUserIdAndIsUnreadTrue(String userId);

    /**
     * Tìm chat room có tin nhắn chưa �'ọc cho mentor
     */
    List<ChatRoom> findByMentorIdAndIsUnreadTrue(String mentorId);
}
