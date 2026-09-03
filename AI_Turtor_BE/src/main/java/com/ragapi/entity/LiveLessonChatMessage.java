package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "live_lesson_chat_messages")
@CompoundIndex(name = "live_lesson_chat_idx", def = "{'lessonId': 1, 'createdAt': 1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveLessonChatMessage {

    @Id
    private String id;

    private String lessonId;
    private String senderId;
    private String senderName;
    private String senderRole;
    private String content;
    private LocalDateTime createdAt;
}
