package com.ragapi.repository;

import com.ragapi.entity.KnowledgeCandidate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface KnowledgeCandidateRepository extends MongoRepository<KnowledgeCandidate, String> {

    List<KnowledgeCandidate> findByStatus(String status);

    List<KnowledgeCandidate> findByCourseId(String courseId);

    List<KnowledgeCandidate> findByCourseIdAndStatus(String courseId, String status);

    List<KnowledgeCandidate> findByStatusInOrderByIndexedAtDesc(Collection<String> statuses);

    List<KnowledgeCandidate> findByCourseIdAndStatusInOrderByIndexedAtDesc(String courseId, Collection<String> statuses);

    Optional<KnowledgeCandidate> findByMentorAnswerId(String mentorAnswerId);

    List<KnowledgeCandidate> findByQuestionEscalationId(String questionEscalationId);

    Optional<KnowledgeCandidate> findByMaterialId(String materialId);
}

