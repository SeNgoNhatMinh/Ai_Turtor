package com.ragapi.service;

import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;
import com.ragapi.repository.AiConversationRepository;
import com.ragapi.repository.AiMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminAiLogService {
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;

    public List<Map<String, Object>> list(String studentId, String courseId, String query,
                                           LocalDateTime from, LocalDateTime to) {
        Map<String, AiConversation> conversations = conversationRepository.findAll().stream()
                .collect(Collectors.toMap(AiConversation::getId, Function.identity(), (a, b) -> a));
        Map<String, List<AiMessage>> grouped = messageRepository.findAll().stream()
                .sorted(Comparator.comparing(AiMessage::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.groupingBy(AiMessage::getConversationId));
        List<Map<String, Object>> logs = new ArrayList<>();
        grouped.forEach((conversationId, messages) -> {
            AiConversation conversation = conversations.get(conversationId);
            if (conversation == null || !matches(conversation.getUserId(), studentId)
                    || !matches(conversation.getCourseId(), courseId)) return;
            for (int i = 0; i < messages.size(); i++) {
                AiMessage question = messages.get(i);
                if (!"STUDENT".equalsIgnoreCase(question.getRole())) continue;
                AiMessage answer = i + 1 < messages.size() && "ASSISTANT".equalsIgnoreCase(messages.get(i + 1).getRole())
                        ? messages.get(i + 1) : null;
                if (!within(question.getCreatedAt(), from, to)
                        || !contains(query, question.getContent(), answer == null ? null : answer.getContent())) continue;
                int inputTokens = estimateTokens(question.getContent());
                int outputTokens = estimateTokens(answer == null ? null : answer.getContent());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("conversationId", conversationId);
                row.put("studentId", conversation.getUserId());
                row.put("courseId", conversation.getCourseId());
                row.put("classId", conversation.getClassId());
                row.put("question", question.getContent());
                row.put("answer", answer == null ? "" : answer.getContent());
                row.put("status", answer == null ? "IN_PROGRESS" : "COMPLETED");
                row.put("inputTokensEstimated", inputTokens);
                row.put("outputTokensEstimated", outputTokens);
                row.put("totalTokensEstimated", inputTokens + outputTokens);
                row.put("actualCost", null);
                row.put("costNote", "Provider usage/cost is not returned by the current LLM client; token values are estimates.");
                row.put("createdAt", question.getCreatedAt());
                logs.add(row);
            }
        });
        return logs.stream().sorted((a, b) -> compareDates((LocalDateTime) b.get("createdAt"),
                (LocalDateTime) a.get("createdAt"))).toList();
    }

    public Map<String, Object> summary(List<Map<String, Object>> logs) {
        long tokens = logs.stream().mapToLong(row -> ((Number) row.get("totalTokensEstimated")).longValue()).sum();
        return Map.of("requestCount", logs.size(), "estimatedTokenCount", tokens,
                "completedCount", logs.stream().filter(row -> "COMPLETED".equals(row.get("status"))).count(),
                "inProgressCount", logs.stream().filter(row -> "IN_PROGRESS".equals(row.get("status"))).count());
    }

    private int estimateTokens(String text) { return text == null ? 0 : (int) Math.ceil(text.length() / 4.0); }
    private boolean matches(String actual, String expected) { return expected == null || expected.isBlank() || expected.equals(actual); }
    private boolean within(LocalDateTime value, LocalDateTime from, LocalDateTime to) {
        return value != null && (from == null || !value.isBefore(from)) && (to == null || !value.isAfter(to));
    }
    private boolean contains(String query, String... values) {
        if (query == null || query.isBlank()) return true;
        String q = query.toLowerCase();
        for (String value : values) if (value != null && value.toLowerCase().contains(q)) return true;
        return false;
    }
    private int compareDates(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b == null ? 0 : -1;
        return b == null ? 1 : a.compareTo(b);
    }
}
