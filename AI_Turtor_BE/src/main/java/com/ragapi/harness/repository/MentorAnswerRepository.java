package com.ragapi.harness.repository;

import com.ragapi.harness.entity.MentorAnswer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MentorAnswerRepository extends MongoRepository<MentorAnswer, String> {

    List<MentorAnswer> findByQuestionEscalationId(String questionEscalationId);

    List<MentorAnswer> findByTeacherId(String teacherId);
}
