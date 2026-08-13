package com.ragapi.repository;

import com.ragapi.entity.KnowledgeCandidate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KnowledgeCandidateRepository extends MongoRepository<KnowledgeCandidate, String> {

    List<KnowledgeCandidate> findByStatus(String status);

    List<KnowledgeCandidate> findByCourseId(String courseId);

    Optional<KnowledgeCandidate> findByMentorAnswerId(String mentorAnswerId);

    List<KnowledgeCandidate> findByQuestionEscalationId(String questionEscalationId);
}

