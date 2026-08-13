package com.ragapi.repository;

import com.ragapi.entity.QuestionEscalation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionEscalationRepository extends MongoRepository<QuestionEscalation, String> {
    
    /**
     * Tìm request theo userId
     */
    List<QuestionEscalation> findByUserId(String userId);
    
    /**
     * Tìm request theo mentorId
     */
    List<QuestionEscalation> findByAssignedMentorId(String mentorId);
    
    /**
     * Tìm request theo status
     */
    List<QuestionEscalation> findByStatus(String status);
    
    /**
     * Tìm request theo userId và status
     */
    List<QuestionEscalation> findByUserIdAndStatus(String userId, String status);
    
    /**
     * Tìm request pending offer (status = PENDING_OFFER)
     */
    List<QuestionEscalation> findByStatusAndMentorHelpOfferedAtIsNull(String status);
    
    /**
     * Tìm request theo chatRoomId
     */
    Optional<QuestionEscalation> findByChatRoomId(String chatRoomId);
}






