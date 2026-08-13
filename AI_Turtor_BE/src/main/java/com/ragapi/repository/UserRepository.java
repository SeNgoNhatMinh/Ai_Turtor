package com.ragapi.repository;

import com.ragapi.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    
    /**
     * Tìm user theo email
     */
    Optional<User> findByEmail(String email);
    
    /**
     * Check xem email �'ã t�"n tại hay chưa
     */
    boolean existsByEmail(String email);
    
    /**
     * Tìm user active theo email
     */
    Optional<User> findByEmailAndIsActiveTrue(String email);
}






