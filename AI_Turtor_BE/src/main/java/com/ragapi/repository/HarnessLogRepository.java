package com.ragapi.repository;

import com.ragapi.entity.HarnessLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface HarnessLogRepository extends MongoRepository<HarnessLog, String> {

    List<HarnessLog> findByTraceIdOrderByCreatedAtAsc(String traceId);

    List<HarnessLog> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    List<HarnessLog> findByStudentIdOrderByCreatedAtDesc(String studentId);

    List<HarnessLog> findByStatusOrderByCreatedAtDesc(String status);

    List<HarnessLog> findByEventTypeOrderByCreatedAtDesc(String eventType);
}
