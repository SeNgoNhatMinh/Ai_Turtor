package com.ragapi.repository;

import com.ragapi.entity.Mentor;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentorRepository extends MongoRepository<Mentor, String> {
    
    /**
     * Tìm mentor theo category
     */
    List<Mentor> findByCategories(String category);
    
    /**
     * Tìm mentor theo specialization
     */
    List<Mentor> findBySpecializations(String specialization);
    
    /**
     * Tìm mentor theo code
     */
    Optional<Mentor> findByMentorCode(String code);
    
    /**
     * Tìm mentor theo email
     */
    Optional<Mentor> findByEmail(String email);
    
    /**
     * Tìm mentor active (�'ang hoạt �'�Tng)
     */
    List<Mentor> findByIsActiveTrue();
    
    /**
     * Tìm mentor theo category và active
     */
    List<Mentor> findByIsActiveTrueAndCategoriesIn(List<String> categories);
    
    /**
     * Tìm mentor verified
     */
    List<Mentor> findByVerifiedTrue();
    
    /**
     * Tìm mentor theo keyword (full text search)
     */
    @Query("{ 'keywords': { $in: ?0 }, 'isActive': true }")
    List<Mentor> searchByKeywords(List<String> keywords);
    
    /**
     * Tìm mentor có rating >= minRating
     */
    List<Mentor> findByAverageRatingGreaterThanEqual(Double minRating);
    
    /**
     * Tìm mentor v�>i s�' chat hi�?n tại < max
     */
    @Query("{ 'currentActiveChatSessions': { $lt: $max_concurrent_chats }, 'isActive': true }")
    List<Mentor> findAvailableMentors();
}






