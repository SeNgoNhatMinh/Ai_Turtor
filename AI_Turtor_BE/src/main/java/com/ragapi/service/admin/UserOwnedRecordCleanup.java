package com.ragapi.service.admin;

import com.ragapi.harness.HarnessCollections;
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
 * user reference is cleared, so courses, classes and materials remain.
 */
@Service
@RequiredArgsConstructor
public class UserOwnedRecordCleanup {

    /**
     * Security-only records that must disappear as soon as an account is
     * deactivated. Academic and teaching records are deliberately excluded.
     */
    static final List<String> ACCESS_RECORDS = List.of(
            "auth_refresh_tokens",
            "student_llm_credentials",
            "user_notifications",
            "user_subscriptions"
    );

    /** Personal rows. studentId / userId points at users.id (or a legacy student code / email). */
    static final List<String> OWNED_BY_STUDENT_ID = List.of(
            "course_enrollments",
            HarnessCollections.ADAPTIVE_REVIEWS,
            HarnessCollections.SUPPORT_LOCKS,
            HarnessCollections.LEARNING_EVIDENCE,
            "student_daily_question_usage",
            HarnessCollections.QUIZ_SESSIONS,
            HarnessCollections.COURSE_MEMORIES,
            HarnessCollections.ANSWER_REVIEWS,
            HarnessCollections.SESSION_SUMMARIES,
            HarnessCollections.SESSIONS,
            HarnessCollections.IMPROVE_PLANS,
            "pedagogical_directives",
            "harness_logs"
    );

    /** Personal rows keyed by users.id. */
    static final List<String> OWNED_BY_USER_ID = List.of(
            "ai_conversations",
            "ai_messages",
            HarnessCollections.HANDOFFS,
            HarnessCollections.LEARNER_MEMORIES,
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
            new SharedUserRef(HarnessCollections.QUIZ_RUNS, "teacherId"),
            new SharedUserRef(HarnessCollections.QUIZ_SESSIONS, "teacherId"),
            new SharedUserRef(HarnessCollections.KNOWLEDGE, "teacherId"),
            new SharedUserRef(HarnessCollections.KNOWLEDGE, "reviewedBy"),
            new SharedUserRef(HarnessCollections.MENTOR_ANSWERS, "teacherId"),
            new SharedUserRef(HarnessCollections.GOLD_QA, "authorId"),
            new SharedUserRef(HarnessCollections.GOLD_QA, "reviewedBy"),
            new SharedUserRef(HarnessCollections.EXPERT_TASKS, "assigneeId"),
            new SharedUserRef(HarnessCollections.EXPERT_TASKS, "createdBy"),
            new SharedUserRef(HarnessCollections.ADAPTIVE_REVIEWS, "teacherId"),
            new SharedUserRef(HarnessCollections.DIRECTIVES, "teacherId"),
            new SharedUserRef(HarnessCollections.HANDOFFS, "assignedMentorId"),
            new SharedUserRef(HarnessCollections.HANDOFFS, "mentorId"),
            new SharedUserRef("chat_rooms", "mentorId"),
            new SharedUserRef(HarnessCollections.ANSWER_CACHE, "seniorReviewerId"),
            new SharedUserRef("eval_runs", "triggeredBy"),
            new SharedUserRef(HarnessCollections.CURRICULA, "reviewedBy"),
            new SharedUserRef(HarnessCollections.ANSWER_REVIEWS, "reviewedBy"),
            new SharedUserRef(HarnessCollections.ANSWER_REVIEWS, "seniorReviewerId")
    );

    private final MongoTemplate mongoTemplate;
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;

    /**
     * Revoke login/session state without removing learning evidence. This is
     * the operation used by the normal admin Delete User endpoint.
     */
    public void revokeAccessRecords(User user) {
        if (user == null) {
            return;
        }
        Set<String> keys = identityKeys(user);
        if (keys.isEmpty()) {
            return;
        }
        removeByFields("auth_refresh_tokens", List.of("userId", "email"), keys);
        removeByFields("student_llm_credentials", List.of("_id", "userId"), keys);
        removeByFields("user_notifications", List.of("userId", "recipientId", "recipientEmail"), keys);
        removeByFields("user_subscriptions", List.of("userId", "studentId", "email"), keys);
    }

    /**
     * Irreversible purge retained for an explicit retention/privacy job only.
     * Do not call this method from the regular CRUD endpoint.
     */
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
                HarnessCollections.QUIZ_RUNS
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
