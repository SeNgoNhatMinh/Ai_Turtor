package com.ragapi.repository;

import com.ragapi.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    
    /**
     * Tìm tin nhắn theo chatRoomId
     */
    List<ChatMessage> findByChatRoomId(String chatRoomId);
    
    /**
     * Tìm tin nhắn theo chatRoomId có pagination
     */
    Page<ChatMessage> findByChatRoomId(String chatRoomId, Pageable pageable);
    
    /**
     * Tìm tin nhắn theo senderId
     */
    List<ChatMessage> findBySenderId(String senderId);
    
    /**
     * Tìm tin nhắn theo status (SENT, DELIVERED, READ)
     */
    List<ChatMessage> findByChatRoomIdAndStatus(String chatRoomId, String status);
    
    /**
     * Đếm s�' tin nhắn trong phòng chat
     */
    Integer countByChatRoomId(String chatRoomId);
    
    /**
     * Đếm s�' tin nhắn từ user trong phòng
     */
    Integer countByChatRoomIdAndSenderRole(String chatRoomId, String senderRole);
}






