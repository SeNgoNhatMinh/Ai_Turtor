package com.ragapi.service.chat;
import com.ragapi.service.notification.RealtimeEventService;
import com.ragapi.harness.curriculum.CourseCurriculumOverviewService;
import com.ragapi.harness.curriculum.CourseIndexedChunkLoader;
import com.ragapi.harness.review.AdaptiveLearningReviewService;

import com.ragapi.harness.HarnessCollections;
import com.ragapi.dto.AiConversationHistoryResponse;
import com.ragapi.dto.AiConversationListResponse;
import com.ragapi.dto.AiConversationSummary;
import com.ragapi.dto.AiMessageInfo;
import com.ragapi.dto.UnderstandingCheckAttempt;
import com.ragapi.dto.UnderstandingCheckPayload;
import com.ragapi.dto.UnderstandingCheckResultResponse;
import com.ragapi.harness.util.UnderstandingCheckExtractor;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.entity.ClassSection;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import com.ragapi.repository.ClassSectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiConversationService {

    static final String DEFAULT_TITLE = "Cuộc trò chuyện mới";
    static final int MAX_USER_QUESTIONS_PER_CONVERSATION = 10;
    private static final int MAX_PINNED_MESSAGES_PER_CONVERSATION = 3;

    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final CourseCurriculumOverviewService curriculumOverviewService;
    private final AdaptiveLearningReviewService adaptiveLearningReviewService;
    private final ClassSectionRepository classSectionRepository;
    private final RealtimeEventService realtimeEvents;
    private final MongoTemplate mongoTemplate;
    private final CourseIndexedChunkLoader indexedChunkLoader;

    /**
     * Live signals for every persisted student Q&A exchange: the student's
     * own session list, admins watching the AI answer log, and the class
     * teacher watching learning progress refresh immediately.
     */
    private void publishExchangeSaved(AiConversation conversation, String studentId, AiMessage assistantMessage) {
        try {
            String courseId = trimToNull(conversation.getCourseId());
            String classId = trimToNull(conversation.getClassId());
            java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
            data.put("studentId", studentId == null ? "" : studentId);
            data.put("courseId", courseId == null ? "" : courseId);
            data.put("classId", classId == null ? "" : classId);
            data.put("conversationId", conversation.getId());
            data.put("userQuestionCount", studentMessageCount(conversation.getId()));

            if (studentId != null && !studentId.isBlank()) {
                realtimeEvents.publishToUser(
                        studentId, "CHAT_SESSION_UPDATED",
                        "AI_CONVERSATION", conversation.getId(), "UPDATED", data);
            }

            realtimeEvents.publishToRoles(List.of("ADMIN"), "AI_REQUEST_LOGGED",
                    "AI_MESSAGE", assistantMessage.getId(), "CREATED", data);

            if (courseId != null && classId != null) {
                classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                        .map(ClassSection::getTeacherId)
                        .filter(id -> id != null && !id.isBlank())
                        .ifPresent(teacherId -> realtimeEvents.publishToUser(
                                teacherId, "STUDENT_QUESTION_ANSWERED",
                                "AI_CONVERSATION", conversation.getId(), "ANSWERED", data));
            }
        } catch (Exception error) {
            log.warn("Could not publish realtime events for conversation {}: {}",
                    conversation.getId(), error.getMessage());
        }
    }

    public AiConversationListResponse listConversations(String userId, int page, int size) {
        return listConversations(userId, null, page, size);
    }

    public AiConversationListResponse listConversations(String userId, String courseId, int page, int size) {
        String safeCourseId = trimToNull(courseId);
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "lastMessageAt", "createdAt"));
        if (safeCourseId != null) {
            loadChapterExcerpts(safeCourseId);
        }
        Page<AiConversation> pageResult = safeCourseId == null
                ? conversationRepository.findByUserId(userId, pageRequest)
                : conversationRepository.findByUserIdAndCourseId(userId, safeCourseId, pageRequest);

        List<AiConversationSummary> summaries = pageResult.getContent().stream()
                .map(this::toSummary)
                .collect(Collectors.toList());

        return AiConversationListResponse.builder()
                .userId(userId)
                .totalCount((int) pageResult.getTotalElements())
                .pageNumber(page)
                .pageSize(size)
                .conversations(summaries)
                .build();
    }

    private void loadChapterExcerpts(String courseId) {
        try {
            indexedChunkLoader.loadCourse(courseId);
        } catch (RuntimeException exception) {
            log.warn("Could not load chapter excerpts for courseId={}: {}", courseId, exception.getMessage());
        }
    }

    public AiConversationSummary createConversation(String userId) {
        return createConversation(userId, null, null);
    }

    public AiConversationSummary createConversation(String userId, String courseId, String classId) {
        AiConversation conversation = createConversationEntity(userId, UUID.randomUUID().toString(), courseId, classId);
        if (courseId != null && !courseId.isBlank()) {
            loadChapterExcerpts(courseId.trim());
            try {
                String welcome = curriculumOverviewService.newChatWelcomeMarkdown(courseId.trim());
                if (welcome != null && !welcome.isBlank()) {
                    appendProactiveAssistantMessage(
                            conversation.getId(),
                            userId,
                            null,
                            "OPEN",
                            welcome
                    );
                }
            } catch (Exception error) {
                log.warn("Could not seed syllabus welcome for new chat {}: {}",
                        conversation.getId(), error.getMessage());
            }
        }
        return toSummary(conversation);
    }

    public AiConversationSummary createTutorConversation(
            String userId,
            String courseId,
            String classId,
            String tutorSessionId
    ) {
        AiConversation conversation = createConversationEntity(
                userId, UUID.randomUUID().toString(), courseId, classId);
        conversation.setTutorSessionId(trimToNull(tutorSessionId));
        conversation.setSessionType("LESSON");
        conversation.setTitle("Buổi học cùng AI Tutor");
        return toSummary(conversationRepository.save(conversation));
    }

    public boolean existsForUser(String conversationId, String userId) {
        return findOwned(conversationId, userId).isPresent();
    }

    public Optional<AiConversationSummary> findOwnedSummary(String conversationId, String userId) {
        return findOwned(conversationId, userId).map(this::toSummary);
    }

    private Optional<AiConversation> findOwned(String conversationId, String userId) {
        String id = trimToNull(conversationId);
        String owner = trimToNull(userId);
        if (id == null || owner == null) {
            return Optional.empty();
        }
        return conversationRepository.findByIdAndUserId(id, owner);
    }

    public AiMessage appendProactiveAssistantMessage(
            String conversationId,
            String userId,
            String tutorSessionId,
            String sessionPhase,
            String content
    ) {
        AiConversation conversation = requireConversation(conversationId, userId);
        LocalDateTime now = LocalDateTime.now();
        AiMessage message = messageRepository.save(AiMessage.builder()
                .id(UUID.randomUUID().toString())
                .conversationId(conversationId)
                .userId(userId)
                .role("ASSISTANT")
                .content(content)
                .mode("TUTOR")
                .tutorSessionId(trimToNull(tutorSessionId))
                .sessionPhase(trimToNull(sessionPhase))
                .proactive(true)
                .pinned(false)
                .createdAt(now)
                .build());
        if (trimToNull(tutorSessionId) != null) {
            conversation.setTutorSessionId(tutorSessionId.trim());
            conversation.setSessionType("LESSON");
        }
        conversation.setMessageCount((conversation.getMessageCount() == null ? 0 : conversation.getMessageCount()) + 1);
        conversation.setLastMessageAt(now);
        conversation.setUpdatedAt(now);
        conversationRepository.save(conversation);
        return message;
    }

    public void attachExchangeToTutorSession(
            String conversationId,
            String userMessageId,
            String assistantMessageId,
            String tutorSessionId,
            String sessionPhase
    ) {
        String safeSessionId = trimToNull(tutorSessionId);
        if (safeSessionId == null) return;
        conversationRepository.findById(conversationId).ifPresent(conversation -> {
            conversation.setTutorSessionId(safeSessionId);
            conversation.setSessionType("LESSON");
            conversationRepository.save(conversation);
        });
        for (String messageId : new String[]{userMessageId, assistantMessageId}) {
            if (messageId == null || messageId.isBlank()) continue;
            messageRepository.findById(messageId).ifPresent(message -> {
                message.setTutorSessionId(safeSessionId);
                message.setSessionPhase(trimToNull(sessionPhase));
                message.setProactive(false);
                messageRepository.save(message);
            });
        }
    }

    public AiConversationHistoryResponse getMessages(String conversationId, String userId, int page, int size) {
        AiConversation conversation = requireConversation(conversationId, userId);
        refreshOpeningIfStale(conversation);

        Page<AiMessage> messagesPage = messageRepository.findByConversationId(
                conversationId,
                PageRequest.of(page, size, Sort.by("createdAt").ascending())
        );

        List<AiMessageInfo> messages = messagesPage.getContent().stream()
                .map(message -> understanding().toMessageInfo(message))
                .collect(Collectors.toList());

        return AiConversationHistoryResponse.builder()
                .conversationId(conversationId)
                .title(conversation.getTitle())
                .totalMessageCount((int) messagesPage.getTotalElements())
                .pageNumber(page)
                .pageSize(size)
                .messages(messages)
                .build();
    }

    /**
     * The seeded welcome is a system banner, not student content: keep it in
     * sync with the course's current curriculum. Conversations opened before
     * an admin edited the guide (or before template fixes) would otherwise
     * show the old welcome — raw syllabus paragraphs, missing sections —
     * forever.
     */
    private void refreshOpeningIfStale(AiConversation conversation) {
        String courseId = trimToNull(conversation.getCourseId());
        if (courseId == null) {
            return;
        }
        try {
            List<AiMessage> existing = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversation.getId());
            if (existing.isEmpty()) {
                return;
            }
            AiMessage first = existing.get(0);
            boolean isSystemOpening = "ASSISTANT".equalsIgnoreCase(first.getRole())
                    && Boolean.TRUE.equals(first.getProactive());
            if (!isSystemOpening) {
                return;
            }
            String currentWelcome = curriculumOverviewService.newChatWelcomeMarkdown(courseId);
            if (currentWelcome != null && !currentWelcome.isBlank()
                    && !currentWelcome.equals(first.getContent())) {
                first.setContent(currentWelcome);
                messageRepository.save(first);
            }
        } catch (Exception error) {
            log.warn("Could not refresh syllabus welcome for chat {}: {}",
                    conversation.getId(), error.getMessage());
        }
    }

    public AiConversationHistoryResponse searchMessages(String userId, String keyword, int page, int size) {
        return searchMessages(userId, keyword, null, page, size);
    }

    public AiConversationHistoryResponse searchMessages(String userId, String keyword, String courseId, int page, int size) {
        String safeKeyword = trimToNull(keyword);
        if (safeKeyword == null) {
            throw new IllegalArgumentException("keyword is required");
        }
        Page<AiMessage> messagesPage = messageRepository.findByUserIdAndContentContainingIgnoreCase(
                userId,
                safeKeyword,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        );

        String safeCourseId = trimToNull(courseId);
        Set<String> allowedConversationIds = safeCourseId == null
                ? Set.of()
                : conversationRepository.findByUserIdAndCourseId(userId, safeCourseId).stream()
                        .map(AiConversation::getId)
                        .collect(Collectors.toSet());

        List<AiMessageInfo> messages = messagesPage.getContent().stream()
                .filter(message -> safeCourseId == null || allowedConversationIds.contains(message.getConversationId()))
                .map(message -> understanding().toMessageInfo(message))
                .collect(Collectors.toList());

        return AiConversationHistoryResponse.builder()
                .conversationId(null)
                .title("Search: " + safeKeyword)
                .totalMessageCount(messages.size())
                .pageNumber(page)
                .pageSize(size)
                .messages(messages)
                .build();
    }

    public String buildRecentTutorContext(String conversationId, String userId) {
        return understanding().buildRecentTutorContext(conversationId, userId, 6, 500, false);
    }

    /**
     * Latest graded understanding-check answers in this conversation, oldest
     * first, so the tutor can adapt its tone to how the student is doing right
     * now. Skipped items are left out: they are not evidence either way.
     */

    /**
     * Compact history for intent routing. Never throws: missing conversation yields "".
     */
    public String buildRecentTutorContextForClassifier(String conversationId, String userId) {
        return understanding().buildRecentTutorContext(conversationId, userId, 4, 240, true);
    }


    public String saveExchange(
            String userId,
            String conversationId,
            String question,
            String answer,
            String questionEscalationId
    ) {
        return saveExchangeWithMessages(userId, conversationId, null, null, question, answer, questionEscalationId).conversationId();
    }

    public SavedExchange saveExchangeWithMessages(
            String userId,
            String conversationId,
            String courseId,
            String classId,
            String question,
            String answer,
            String questionEscalationId
    ) {
        return saveExchangeWithMessages(userId, conversationId, courseId, classId, question, answer,
                questionEscalationId, null, null, null, null, null);
    }

    public SavedExchange saveExchangeWithMessages(
            String userId,
            String conversationId,
            String courseId,
            String classId,
            String question,
            String answer,
            String questionEscalationId,
            String mode,
            Double confidence,
            List<String> sources,
            List<RagSourceEvidence> sourceEvidence,
            String groundingType
    ) {
        AiConversation conversation = resolveOrCreateConversationForNewExchange(userId, conversationId, courseId, classId);
        LocalDateTime now = LocalDateTime.now();

        AiMessage userMessage = messageRepository.save(AiMessage.builder()
                .id(UUID.randomUUID().toString())
                .conversationId(conversation.getId())
                .userId(userId)
                .role("STUDENT")
                .content(question)
                .pinned(false)
                .createdAt(now)
                .build());

        UnderstandingCheckPayload understandingCheck = UnderstandingCheckExtractor.extract(answer);
        List<UnderstandingCheckPayload> allChecks = UnderstandingCheckExtractor.extractAll(answer);
        String assistantMessageId = UUID.randomUUID().toString();
        String firstAttemptId = understandingCheck == null ? null : UUID.randomUUID().toString();
        List<UnderstandingCheckAttempt> checkAttempts = new java.util.ArrayList<>();
        for (int index = 0; index < allChecks.size(); index++) {
            checkAttempts.add(UnderstandingCheckAttempt.builder()
                    .quizIndex(index)
                    .attemptId(index == 0 ? firstAttemptId : UUID.randomUUID().toString())
                    .check(allChecks.get(index))
                    .build());
        }
        AiMessage assistantMessage = messageRepository.save(AiMessage.builder()
                .id(assistantMessageId)
                .conversationId(conversation.getId())
                .userId(userId)
                .role("ASSISTANT")
                .content(answer)
                .mode(mode)
                .confidence(confidence)
                .sources(sources == null ? List.of() : sources)
                .sourceEvidence(sourceEvidence == null ? List.of() : sourceEvidence)
                .groundingType(groundingType)
                .questionEscalationId(questionEscalationId)
                .understandingCheck(understandingCheck)
                .understandingCheckAttempts(checkAttempts)
                .understandingAttemptId(firstAttemptId)
                .pinned(false)
                .createdAt(now.plusNanos(1))
                .build());

        int newCount = (conversation.getMessageCount() != null ? conversation.getMessageCount() : 0) + 2;
        conversation.setMessageCount(newCount);
        conversation.setUpdatedAt(now);
        conversation.setLastMessageAt(now);
        if (trimToNull(courseId) != null) conversation.setCourseId(trimToNull(courseId));
        if (trimToNull(classId) != null) conversation.setClassId(trimToNull(classId));

        if (DEFAULT_TITLE.equals(conversation.getTitle()) || conversation.getTitle() == null) {
            conversation.setTitle(buildTitle(question));
        }

        conversationRepository.save(conversation);
        log.info("Saved AI exchange in conversation {} ({} messages)", conversation.getId(), newCount);
        publishExchangeSaved(conversation, userId, assistantMessage);
        // Every 10 questions within one course triggers an adaptive review for
        // that student in that course (async, never blocks the chat response).
        String effectiveCourseId = trimToNull(conversation.getCourseId());
        if (effectiveCourseId != null) {
            adaptiveLearningReviewService.onStudentQuestionAnswered(
                    userId, effectiveCourseId, trimToNull(conversation.getClassId()));
        }
        return new SavedExchange(conversation.getId(), userMessage.getId(), assistantMessage.getId());
    }

    public AiMessageInfo saveAssistantMessage(
            String userId,
            String conversationId,
            String courseId,
            String classId,
            String content,
            String questionEscalationId
    ) {
        String safeUserId = trimToNull(userId);
        String safeContent = trimToNull(content);
        if (safeUserId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        if (safeContent == null) {
            throw new IllegalArgumentException("content is required");
        }

        AiConversation conversation = resolveOrCreateConversation(safeUserId, conversationId, courseId, classId);
        LocalDateTime now = LocalDateTime.now();
        AiMessage assistantMessage = messageRepository.save(AiMessage.builder()
                .id(UUID.randomUUID().toString())
                .conversationId(conversation.getId())
                .userId(safeUserId)
                .role("ASSISTANT")
                .content(safeContent)
                .questionEscalationId(questionEscalationId)
                .pinned(false)
                .createdAt(now)
                .build());

        int newCount = (conversation.getMessageCount() != null ? conversation.getMessageCount() : 0) + 1;
        conversation.setMessageCount(newCount);
        conversation.setUpdatedAt(now);
        conversation.setLastMessageAt(now);
        if (trimToNull(courseId) != null) conversation.setCourseId(trimToNull(courseId));
        if (trimToNull(classId) != null) conversation.setClassId(trimToNull(classId));
        conversationRepository.save(conversation);

        log.info("Saved assistant follow-up message in conversation {} for escalation {}", conversation.getId(), questionEscalationId);
        return understanding().toMessageInfo(assistantMessage);
    }
    public AiMessageInfo pinMessage(String conversationId, String messageId, String userId) {
        requireConversation(conversationId, userId);
        AiMessage message = messageRepository.findByIdAndConversationIdAndUserId(messageId, conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin nhắn"));
        if (!Boolean.TRUE.equals(message.getPinned())) {
            long pinnedCount = messageRepository.findByConversationIdAndPinnedTrueOrderByPinnedAtDesc(conversationId).size();
            if (pinnedCount >= MAX_PINNED_MESSAGES_PER_CONVERSATION) {
                throw new IllegalArgumentException("Chỉ được ghim tối đa 3 tin nhắn trong một cuộc trò chuyện");
            }
        }
        message.setPinned(true);
        message.setPinnedAt(LocalDateTime.now());
        return understanding().toMessageInfo(messageRepository.save(message));
    }

    public String buildRecentUnderstandingSignals(String conversationId, String userId) {
        return understanding().buildRecentUnderstandingSignals(conversationId, userId);
    }

    public UnderstandingCheckResultResponse recordUnderstandingCheck(
            String conversationId,
            String messageId,
            String userId,
            String selectedKey
    ) {
        return understanding().recordUnderstandingCheck(conversationId, messageId, userId, selectedKey);
    }

    public UnderstandingCheckResultResponse recordUnderstandingCheck(
            String conversationId,
            String messageId,
            String userId,
            String selectedKey,
            int quizIndex
    ) {
        return understanding().recordUnderstandingCheck(
                conversationId, messageId, userId, selectedKey, quizIndex);
    }

    public RagQueryIntent buildUnderstandingRemediationIntent(
            String messageId,
            String attemptId,
            String userId,
            String fallbackQuestion
    ) {
        return understanding().buildUnderstandingRemediationIntent(
                messageId, attemptId, userId, fallbackQuestion);
    }


    private ConversationUnderstanding understanding() {
        return new ConversationUnderstanding(this, messageRepository, adaptiveLearningReviewService);
    }

    public AiMessageInfo unpinMessage(String conversationId, String messageId, String userId) {
        requireConversation(conversationId, userId);
        AiMessage message = messageRepository.findByIdAndConversationIdAndUserId(messageId, conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin nhắn"));
        message.setPinned(false);
        message.setPinnedAt(null);
        return understanding().toMessageInfo(messageRepository.save(message));
    }

    public List<AiMessageInfo> listPinnedMessages(String conversationId, String userId) {
        requireConversation(conversationId, userId);
        return messageRepository.findByConversationIdAndPinnedTrueOrderByPinnedAtDesc(conversationId).stream()
                .map(message -> understanding().toMessageInfo(message))
                .toList();
    }

    public AiConversationSummary renameConversation(String conversationId, String userId, String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Tiêu đề không được để trống");
        }

        AiConversation conversation = requireConversation(conversationId, userId);
        conversation.setTitle(title.trim());
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);
        return toSummary(conversation);
    }

    public void deleteConversation(String conversationId, String userId) {
        requireConversation(conversationId, userId);
        LocalDateTime deletedAt = LocalDateTime.now();

        // Reviews, escalations and harness traces contain learning/audit
        // snapshots. Keep them, but explicitly detach the deleted chat so no
        // dangling reference is left behind.
        Update detachConversation = new Update()
                .unset("conversationId")
                .set("conversationDeletedAt", deletedAt)
                .set("updatedAt", deletedAt);
        Query linkedConversation = Query.query(Criteria.where("conversationId").is(conversationId));
        mongoTemplate.updateMulti(linkedConversation, detachConversation, HarnessCollections.HANDOFFS);
        mongoTemplate.updateMulti(linkedConversation, detachConversation, HarnessCollections.ANSWER_REVIEWS);
        mongoTemplate.updateMulti(linkedConversation, detachConversation, "harness_logs");

        Update pullConversation = new Update()
                .pull("conversationIds", conversationId)
                .set("updatedAt", deletedAt);
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("conversationIds").is(conversationId)),
                pullConversation,
                HarnessCollections.SESSIONS
        );
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("conversationIds").is(conversationId)),
                pullConversation,
                HarnessCollections.SESSION_SUMMARIES
        );
        messageRepository.deleteByConversationId(conversationId);
        conversationRepository.deleteByIdAndUserId(conversationId, userId);
        log.info("Deleted AI conversation {} for user {} and detached preserved learning records",
                conversationId, userId);
    }

    private AiConversation resolveOrCreateConversationForNewExchange(String userId, String conversationId, String courseId, String classId) {
        AiConversation conversation = resolveOrCreateConversation(userId, conversationId, courseId, classId);
        long userQuestionCount = studentMessageCount(conversation.getId());
        if (userQuestionCount < MAX_USER_QUESTIONS_PER_CONVERSATION) {
            return conversation;
        }
        AiConversation next = createConversationEntity(userId, UUID.randomUUID().toString(), courseId, classId);
        next.setTitle(buildContinuationTitle(conversation.getTitle()));
        next.setParentConversationId(conversation.getId());
        next.setTutorSessionId(conversation.getTutorSessionId());
        next.setSessionType(conversation.getSessionType());
        return conversationRepository.save(next);
    }

    private AiConversation resolveOrCreateConversation(String userId, String conversationId, String courseId, String classId) {
        String requestedId = trimToNull(conversationId);
        String safeCourseId = trimToNull(courseId);
        if (requestedId != null) {
            return conversationRepository.findByIdAndUserId(requestedId, userId)
                    .filter(conversation -> safeCourseId == null || conversation.getCourseId() == null || safeCourseId.equalsIgnoreCase(conversation.getCourseId()))
                    .orElseGet(() -> createConversationEntity(userId, UUID.randomUUID().toString(), courseId, classId));
        }
        return createConversationEntity(userId, UUID.randomUUID().toString(), courseId, classId);
    }

    private AiConversation createConversationEntity(String userId, String conversationId, String courseId, String classId) {
        LocalDateTime now = LocalDateTime.now();
        AiConversation conversation = conversationRepository.save(AiConversation.builder()
                .id(conversationId)
                .userId(userId)
                .courseId(trimToNull(courseId))
                .classId(trimToNull(classId))
                .title(DEFAULT_TITLE)
                .messageCount(0)
                .createdAt(now)
                .updatedAt(now)
                .build());
        log.info("Created AI conversation {} for user {} course {}", conversation.getId(), userId, courseId);
        return conversation;
    }

    String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    AiConversation requireConversation(String conversationId, String userId) {
        return conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy cuộc trò chuyện"));
    }

    public record SavedExchange(String conversationId, String userMessageId, String assistantMessageId) {}


    private String buildContinuationTitle(String title) {
        String base = title == null || title.isBlank() ? DEFAULT_TITLE : title.trim();
        if (base.length() > 48) {
            base = base.substring(0, 45) + "...";
        }
        return base + " (tiếp tục)";
    }

    private String buildTitle(String question) {
        String trimmed = question == null ? DEFAULT_TITLE : question.trim().replaceAll("\\s+", " ");
        if (trimmed.length() <= 60) {
            return trimmed;
        }
        return trimmed.substring(0, 57) + "...";
    }

    private AiConversationSummary toSummary(AiConversation conversation) {
        int userQuestionCount = (int) studentMessageCount(conversation.getId());
        return AiConversationSummary.builder()
                .conversationId(conversation.getId())
                .title(conversation.getTitle())
                .courseId(conversation.getCourseId())
                .classId(conversation.getClassId())
                .tutorSessionId(conversation.getTutorSessionId())
                .parentConversationId(conversation.getParentConversationId())
                .sessionType(conversation.getSessionType())
                .messageCount(conversation.getMessageCount())
                .userQuestionCount(userQuestionCount)
                .maxTurnsReached(userQuestionCount >= MAX_USER_QUESTIONS_PER_CONVERSATION)
                .createdAt(conversation.getCreatedAt())
                .lastMessageAt(conversation.getLastMessageAt())
                .build();
    }


    private long studentMessageCount(String conversationId) {
        // Keep legacy USER messages in the turn count, but all new messages use STUDENT.
        return messageRepository.countByConversationIdAndRole(conversationId, "STUDENT")
                + messageRepository.countByConversationIdAndRole(conversationId, "USER");
    }

}
