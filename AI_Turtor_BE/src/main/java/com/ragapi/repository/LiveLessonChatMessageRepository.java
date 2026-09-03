package com.ragapi.repository;

import com.ragapi.entity.LiveLessonChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LiveLessonChatMessageRepository extends MongoRepository<LiveLessonChatMessage, String> {

    List<LiveLessonChatMessage> findByLessonIdOrderByCreatedAtAsc(String lessonId);

    void deleteByLessonId(String lessonId);
}
