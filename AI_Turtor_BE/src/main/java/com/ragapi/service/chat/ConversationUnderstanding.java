package com.ragapi.service.chat;

import com.ragapi.dto.AiMessageInfo;
import com.ragapi.dto.RagQueryIntent;
import com.ragapi.dto.RagSourceEvidence;
import com.ragapi.dto.UnderstandingCheckAttempt;
import com.ragapi.dto.UnderstandingCheckPayload;
import com.ragapi.dto.UnderstandingCheckResultResponse;
import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.harness.review.AdaptiveLearningReviewService;
import com.ragapi.harness.util.UnderstandingCheckExtractor;
import com.ragapi.repository.AiMessageRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Understanding checks and the short history the tutor reads from a conversation. */
@Slf4j
@RequiredArgsConstructor
class ConversationUnderstanding {

    private final AiConversationService conversations;
    private final AiMessageRepository messageRepository;
    private final AdaptiveLearningReviewService adaptiveLearningReviewService;

    public String buildRecentUnderstandingSignals(String conversationId, String userId) {
        String safeConversationId = conversations.trimToNull(conversationId);
        String safeUserId = conversations.trimToNull(userId);
        if (safeConversationId == null || safeUserId == null) return "";
        List<String> lines = new java.util.ArrayList<>();
        for (AiMessage message : messageRepository.findByConversationIdOrderByCreatedAtAsc(safeConversationId)) {
            if (!"ASSISTANT".equalsIgnoreCase(message.getRole()) || !safeUserId.equals(message.getUserId())) continue;
            for (UnderstandingCheckAttempt attempt : ensureCheckAttempts(message)) {
                if (attempt.getSelectedKey() == null || attempt.getSelectedKey().isBlank()
                        || attempt.getCorrect() == null) {
                    continue;
                }
                String question = attempt.getCheck() == null || attempt.getCheck().getQuestion() == null
                        ? "" : attempt.getCheck().getQuestion().trim().replaceAll("\\s+", " ");
                if (question.length() > 160) question = question.substring(0, 160) + "...";
                lines.add("- " + (attempt.getCorrect() ? "Correct" : "Wrong") + ": " + question);
            }
        }
        return String.join("\n", lines.subList(Math.max(0, lines.size() - 6), lines.size()));
    }

    String buildRecentTutorContext(
            String conversationId,
            String userId,
            int maxMessages,
            int maxCharsPerMessage,
            boolean swallowMissing
    ) {
        String safeConversationId = conversations.trimToNull(conversationId);
        String safeUserId = conversations.trimToNull(userId);
        if (safeConversationId == null || safeUserId == null) return "";
        try {
            conversations.requireConversation(safeConversationId, safeUserId);
        } catch (RuntimeException exception) {
            if (swallowMissing) {
                log.debug("Classifier history skipped: {}", exception.getMessage());
                return "";
            }
            throw exception;
        }
        List<AiMessage> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(safeConversationId);
        int fromIndex = Math.max(0, messages.size() - maxMessages);
        return messages.subList(fromIndex, messages.size()).stream()
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .map(message -> {
                    String content = message.getContent().trim().replaceAll("\\s+", " ");
                    if (content.length() > maxCharsPerMessage) {
                        content = content.substring(0, maxCharsPerMessage) + "...";
                    }
                    return "- " + ("STUDENT".equalsIgnoreCase(message.getRole()) ? "Student" : "Tutor")
                            + ": " + content;
                })
                .collect(Collectors.joining("\n"));
    }

    List<UnderstandingCheckAttempt> ensureCheckAttempts(AiMessage message) {
        List<UnderstandingCheckAttempt> attempts = message.getUnderstandingCheckAttempts();
        if (attempts != null && !attempts.isEmpty()) {
            return attempts;
        }
        List<UnderstandingCheckPayload> checks = UnderstandingCheckExtractor.extractAll(message.getContent());
        if (checks.isEmpty() && message.getUnderstandingCheck() != null) {
            checks = List.of(message.getUnderstandingCheck());
        }
        List<UnderstandingCheckAttempt> built = new java.util.ArrayList<>();
        for (int index = 0; index < checks.size(); index++) {
            UnderstandingCheckAttempt attempt = UnderstandingCheckAttempt.builder()
                    .quizIndex(index)
                    .attemptId(index == 0 && message.getUnderstandingAttemptId() != null
                            ? message.getUnderstandingAttemptId() : UUID.randomUUID().toString())
                    .check(checks.get(index))
                    .build();
            if (index == 0 && message.getUnderstandingSelectedKey() != null
                    && !message.getUnderstandingSelectedKey().isBlank()) {
                attempt.setSelectedKey(message.getUnderstandingSelectedKey());
                attempt.setCorrect(message.getUnderstandingCorrect());
                attempt.setAnsweredAt(message.getUnderstandingAnsweredAt());
            }
            built.add(attempt);
        }
        message.setUnderstandingCheckAttempts(built);
        return built;
    }

    public UnderstandingCheckResultResponse recordUnderstandingCheck(
            String conversationId,
            String messageId,
            String userId,
            String selectedKey
    ) {
        return recordUnderstandingCheck(conversationId, messageId, userId, selectedKey, 0);
    }

    public UnderstandingCheckResultResponse recordUnderstandingCheck(
            String conversationId,
            String messageId,
            String userId,
            String selectedKey,
            int quizIndex
    ) {
        AiConversation conversation = conversations.requireConversation(conversationId, userId);
        String key = selectedKey == null ? "" : selectedKey.trim().toUpperCase();
        if (!key.matches("[A-D]")) {
            throw new IllegalArgumentException("Đáp án kiểm tra hiểu phải là A, B, C hoặc D");
        }
        AiMessage message = messageRepository.findByIdAndConversationIdAndUserId(messageId, conversationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin nhắn"));
        String role = message.getRole() == null ? "" : message.getRole().trim().toUpperCase();
        if (!"ASSISTANT".equals(role)) {
            throw new IllegalArgumentException("Chỉ lưu đáp án trên câu trả lời của AI Tutor");
        }
        List<UnderstandingCheckAttempt> attempts = ensureCheckAttempts(message);
        if (quizIndex < 0 || quizIndex >= attempts.size()) {
            throw new IllegalArgumentException("Câu kiểm tra hiểu không tồn tại");
        }
        UnderstandingCheckAttempt attempt = attempts.get(quizIndex);
        UnderstandingCheckPayload check = attempt.getCheck();
        if (check == null || check.getCorrectKey() == null || check.getCorrectKey().isBlank()) {
            throw new IllegalArgumentException("Câu kiểm tra hiểu chưa có đáp án hợp lệ");
        }
        if (message.getUnderstandingCheck() == null) {
            message.setUnderstandingCheck(attempts.get(0).getCheck());
        }
        boolean newlyAnswered = attempt.getSelectedKey() == null || attempt.getSelectedKey().isBlank();
        if (newlyAnswered) {
            attempt.setSelectedKey(key);
            attempt.setCorrect(key.equalsIgnoreCase(check.getCorrectKey()));
            attempt.setAnsweredAt(LocalDateTime.now());
            if (quizIndex == 0) {
                // Legacy singular fields stay in sync with the first item.
                message.setUnderstandingAttemptId(attempt.getAttemptId());
                message.setUnderstandingSelectedKey(key);
                message.setUnderstandingCorrect(attempt.getCorrect());
                message.setUnderstandingAnsweredAt(attempt.getAnsweredAt());
            }
            message = messageRepository.save(message);
            // Event-based detection: every newly recorded quiz answer may
            // complete a repeated-mistake pattern (async, never blocks chat).
            adaptiveLearningReviewService.onUnderstandingCheckRecorded(
                    userId,
                    conversations.trimToNull(conversation.getCourseId()),
                    conversations.trimToNull(conversation.getClassId()));
        }
        String correctKey = check.getCorrectKey().trim().toUpperCase();
        String correctOptionText = check.getOptions() == null ? "" : check.getOptions().stream()
                .filter(option -> correctKey.equalsIgnoreCase(option.getKey()))
                .map(UnderstandingCheckPayload.Option::getText)
                .findFirst()
                .orElse("");
        return UnderstandingCheckResultResponse.builder()
                .status(Boolean.TRUE.equals(attempt.getCorrect()) ? "CORRECT" : "INCORRECT")
                .attemptId(attempt.getAttemptId())
                .messageId(message.getId())
                .quizIndex(quizIndex)
                .selectedKey(attempt.getSelectedKey())
                .correct(Boolean.TRUE.equals(attempt.getCorrect()))
                .correctKey(correctKey)
                .correctOptionText(correctOptionText)
                .explanation(check.getExplanation())
                .answeredAt(attempt.getAnsweredAt())
                .build();
    }

    public RagQueryIntent buildUnderstandingRemediationIntent(
            String messageId,
            String attemptId,
            String userId,
            String fallbackQuestion
    ) {
        String safeMessageId = conversations.trimToNull(messageId);
        String safeAttemptId = conversations.trimToNull(attemptId);
        String safeUserId = conversations.trimToNull(userId);
        if (safeMessageId == null || safeAttemptId == null || safeUserId == null) {
            throw new IllegalArgumentException("Thiếu ngữ cảnh lần kiểm tra hiểu");
        }
        AiMessage message = messageRepository.findById(safeMessageId)
                .filter(value -> safeUserId.equals(value.getUserId()))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin nhắn kiểm tra hiểu"));
        UnderstandingCheckAttempt attempt = ensureCheckAttempts(message).stream()
                .filter(value -> safeAttemptId.equals(value.getAttemptId()))
                .findFirst()
                .orElse(null);
        if (attempt == null || !Boolean.FALSE.equals(attempt.getCorrect())) {
            throw new IllegalArgumentException("Lần kiểm tra hiểu không hợp lệ hoặc không cần giảng lại");
        }

        UnderstandingCheckPayload check = attempt.getCheck();
        if (check == null) {
            check = UnderstandingCheckExtractor.extract(message.getContent());
        }
        String retrievalQuestion = check != null && check.getQuestion() != null && !check.getQuestion().isBlank()
                ? check.getQuestion().trim()
                : fallbackQuestion;
        // The student re-learns every wrong item of the quiz in one turn, so
        // retrieval must cover all of them, not only the first one.
        List<String> retrievalTerms = new java.util.ArrayList<>();
        retrievalTerms.add(retrievalQuestion);
        ensureCheckAttempts(message).stream()
                .filter(value -> Boolean.FALSE.equals(value.getCorrect()))
                .map(UnderstandingCheckAttempt::getCheck)
                .filter(value -> value != null && value.getQuestion() != null && !value.getQuestion().isBlank())
                .map(value -> value.getQuestion().trim())
                .filter(value -> !retrievalTerms.contains(value))
                .limit(4)
                .forEach(retrievalTerms::add);
        List<RagSourceEvidence> evidence = message.getSourceEvidence() == null
                ? List.of()
                : message.getSourceEvidence();
        List<String> materialIds = evidence.stream()
                .map(RagSourceEvidence::getMaterialId)
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .limit(12)
                .toList();
        List<String> chunkIds = evidence.stream()
                .map(RagSourceEvidence::getChunkId)
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .limit(12)
                .toList();
        log.info(
                "Understanding remediation context resolved: originMessageId={}, attemptId={}, materialCount={}, chunkCount={}, wrongItems={}",
                safeMessageId, safeAttemptId, materialIds.size(), chunkIds.size(), retrievalTerms.size());
        return RagQueryIntent.builder()
                .learningObjective(retrievalQuestion)
                .retrievalQuery(String.join("\n", retrievalTerms))
                .retrievalTerms(List.copyOf(retrievalTerms))
                .teachingMode("EXPLAIN_CONCEPT")
                .sourceMaterialIds(materialIds)
                .sourceChunkIds(chunkIds)
                .sourceTerms(List.copyOf(retrievalTerms))
                .build();
    }

    AiMessageInfo toMessageInfo(AiMessage message) {
        UnderstandingCheckPayload storedCheck = message.getUnderstandingCheck() == null
                ? UnderstandingCheckExtractor.extract(message.getContent())
                : message.getUnderstandingCheck();
        boolean revealUnderstandingResult = message.getUnderstandingSelectedKey() != null
                && !message.getUnderstandingSelectedKey().isBlank();
        return AiMessageInfo.builder()
                .messageId(message.getId())
                .role(message.getRole())
                .content(revealUnderstandingResult
                        ? message.getContent()
                        : UnderstandingCheckExtractor.stripHiddenAnswerMetadata(message.getContent()))
                .mode(message.getMode())
                .confidence(message.getConfidence())
                .sources(message.getSources())
                .sourceEvidence(message.getSourceEvidence())
                .groundingType(message.getGroundingType())
                .questionEscalationId(message.getQuestionEscalationId())
                .tutorSessionId(message.getTutorSessionId())
                .sessionPhase(message.getSessionPhase())
                .proactive(message.getProactive())
                .pinned(Boolean.TRUE.equals(message.getPinned()))
                .pinnedAt(message.getPinnedAt())
                .understandingAttemptId(message.getUnderstandingAttemptId())
                .understandingSelectedKey(message.getUnderstandingSelectedKey())
                .understandingCorrect(message.getUnderstandingCorrect())
                .understandingAnsweredAt(message.getUnderstandingAnsweredAt())
                .understandingCheck(UnderstandingCheckExtractor.studentView(
                        storedCheck,
                        revealUnderstandingResult
                ))
                .understandingCheckAttempts(ensureCheckAttempts(message).stream()
                        .map(attempt -> UnderstandingCheckAttempt.builder()
                                .quizIndex(attempt.getQuizIndex())
                                .attemptId(attempt.getAttemptId())
                                .check(UnderstandingCheckExtractor.studentView(
                                        attempt.getCheck(),
                                        attempt.getSelectedKey() != null
                                                && !attempt.getSelectedKey().isBlank()))
                                .selectedKey(attempt.getSelectedKey())
                                .correct(attempt.getCorrect())
                                .answeredAt(attempt.getAnsweredAt())
                                .build())
                        .toList())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
