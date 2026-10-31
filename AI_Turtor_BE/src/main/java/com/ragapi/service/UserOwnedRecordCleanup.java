package com.ragapi.service;

import com.ragapi.entity.AiConversation;
import com.ragapi.entity.ChatRoom;
import com.ragapi.entity.User;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Mongo has no foreign keys. This is the ownership map used when a user is deleted.
 *
 * Owned rows are removed with the account. Shared academic rows stay, and only the
 * user reference is cleared, so courses, classes, materials and assignments remain.
 */
@Service
@RequiredArgsConstructor
public class UserOwnedRecordCleanup {

    /** Personal rows. studentId / userId points at users.id (or a legacy student code / email). */
    static final List<String> OWNED_BY_STUDENT_ID = List.of(
            "course_enrollments",
            "adaptive_learning_reviews",
            "adaptive_support_level_locks",
            "learning_evidence",
            "student_daily_question_usage",
            "quiz_sessions",
            "assignment_submissions",
            "student_course_memories",
            "ai_answer_reviews",
            "tutor_session_summaries",
            "tutor_sessions",
            "improve_plans",
            "pedagogical_directives",
            "harness_logs"
    );

    /** Personal rows keyed by users.id. */
    static final List<String> OWNED_BY_USER_ID = List.of(
            "ai_conversations",
            "ai_messages",
            "question_escalations",
            "user_memories",
            "case_memories",
            "student_llm_usage",
            "student_llm_credentials",
            "auth_refresh_tokens",
            "chat_rooms",
            "chat_messages"
    );

    /**
     * Shared rows. These collections are not deleted with the user.
     * Each entry is collection + field that stores users.id.
     */
    static final List<SharedUserRef> SHARED_USER_REFS = List.of(
            new SharedUserRef("class_sections", "teacherId"),
            new SharedUserRef("class_sections", "teacherEmail"),
            new SharedUserRef("course_materials", "teacherId"),
            new SharedUserRef("assignments", "teacherId"),
            new SharedUserRef("quiz_assignments", "teacherId"),
            new SharedUserRef("quiz_sessions", "teacherId"),
            new SharedUserRef("assignment_submissions", "teacherId"),
            new SharedUserRef("knowledge_candidates", "teacherId"),
            new SharedUserRef("knowledge_candidates", "reviewedBy"),
            new SharedUserRef("mentor_answers", "teacherId"),
            new SharedUserRef("gold_qa", "authorId"),
            new SharedUserRef("gold_qa", "reviewedBy"),
            new SharedUserRef("expert_tasks", "assigneeId"),
            new SharedUserRef("expert_tasks", "createdBy"),
            new SharedUserRef("adaptive_learning_reviews", "teacherId"),
            new SharedUserRef("pedagogical_directives", "teacherId"),
            new SharedUserRef("question_escalations", "assignedMentorId"),
            new SharedUserRef("question_escalations", "mentorId"),
            new SharedUserRef("chat_rooms", "mentorId"),
            new SharedUserRef("canonical_tutor_answers", "seniorReviewerId"),
            new SharedUserRef("eval_runs", "triggeredBy"),
            new SharedUserRef("course_learning_guides", "reviewedBy"),
            new SharedUserRef("ai_answer_reviews", "reviewedBy"),
            new SharedUserRef("ai_answer_reviews", "seniorReviewerId")
    );

    private final MongoTemplate mongoTemplate;
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;

    public void deleteOwnedRecords(User user) {
        if (user == null) {
            return;
        }
        Set<String> keys = identityKeys(user);
        if (keys.isEmpty()) {
            return;
        }

        clearSharedReferences(keys);
        deletePersonalRows(user, keys);
    }

    private void clearSharedReferences(Set<String> keys) {
        for (SharedUserRef ref : SHARED_USER_REFS) {
            Update update = new Update().unset(ref.field()).set("updatedAt", LocalDateTime.now());
            mongoTemplate.updateMulti(Query.query(Criteria.where(ref.field()).in(keys)), update, ref.collection());
        }
        Update pullStudents = new Update().pullAll("targetStudentIds", keys.toArray(String[]::new));
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("targetStudentIds").in(keys)),
                pullStudents,
                "quiz_assignments"
        );
    }

    private void deletePersonalRows(User user, Set<String> keys) {
        for (AiConversation conversation : conversationRepository.findAllByUserId(user.getId())) {
            if (conversation.getId() != null) {
                messageRepository.deleteByConversationId(conversation.getId());
            }
        }

        for (String collection : OWNED_BY_STUDENT_ID) {
            removeByFields(collection, List.of("studentId", "studentCode", "studentEmail"), keys);
        }
        for (String collection : OWNED_BY_USER_ID) {
            if ("chat_messages".equals(collection)) {
                removeByFields(collection, List.of("senderId", "senderEmail"), keys);
                continue;
            }
            if ("student_llm_credentials".equals(collection)) {
                removeByFields(collection, List.of("_id", "userId"), keys);
                continue;
            }
            if ("chat_rooms".equals(collection)) {
                removeChatRooms(keys);
                continue;
            }
            removeByFields(collection, List.of("userId"), keys);
        }
    }

    private void removeChatRooms(Set<String> keys) {
        Query roomQuery = queryMatching(List.of("userId", "userEmail"), keys);
        for (ChatRoom room : mongoTemplate.find(roomQuery, ChatRoom.class)) {
            if (room.getId() != null) {
                mongoTemplate.remove(Query.query(Criteria.where("chatRoomId").is(room.getId())), "chat_messages");
            }
        }
        mongoTemplate.remove(roomQuery, "chat_rooms");
    }

    private void removeByFields(String collection, List<String> fields, Set<String> keys) {
        mongoTemplate.remove(queryMatching(fields, keys), collection);
    }

    private static Query queryMatching(List<String> fields, Set<String> keys) {
        List<Criteria> parts = new ArrayList<>();
        for (String field : fields) {
            parts.add(Criteria.where(field).in(keys));
        }
        return new Query(new Criteria().orOperator(parts.toArray(Criteria[]::new)));
    }

    static Set<String> identityKeys(User user) {
        Set<String> keys = new LinkedHashSet<>();
        addKey(keys, user.getId());
        addKey(keys, user.getEmail());
        addKey(keys, user.getStudentCode());
        return keys;
    }

    private static void addKey(Set<String> keys, String value) {
        if (value != null && !value.isBlank()) {
            keys.add(value.trim());
        }
    }

    record SharedUserRef(String collection, String field) {
    }
}
