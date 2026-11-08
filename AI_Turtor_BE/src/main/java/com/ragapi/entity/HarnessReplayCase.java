package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "harness_replay_cases")
@CompoundIndex(name = "harness_case_open", def = "{'courseId': 1, 'questionKey': 1, 'status': 1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HarnessReplayCase {
    @Id
    private String id;
    private String courseId;
    private String classId;
    private String chapter;
    private String question;
    private String questionKey;
    /** ESCALATED, GROUNDING_BLOCKED, WORKER_FAILED, LOW_EVAL. */
    private String reason;
    /** OPEN or REPLAYED. */
    private String status;
    private String sourceTraceId;
    private String replayTraceId;
    /** BETTER, WORSE, or empty while still open. */
    private String verdict;
    private String verdictNote;
    private String sourcePreview;
    private String replayPreview;
    private LocalDateTime createdAt;
    private LocalDateTime replayedAt;
}
