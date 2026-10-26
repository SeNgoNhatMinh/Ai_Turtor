package com.ragapi.service.adaptive;

import com.ragapi.entity.AiConversation;
import com.ragapi.entity.AiMessage;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static com.ragapi.service.adaptive.AdaptiveReviewPolicy.CYCLE_SIZE;

/** Slices a course's chat history into review cycles. Pure: callers load the messages. */
public final class AdaptiveCycleWindows {
    private static final Set<String> CHAT_ROLES = Set.of("STUDENT", "ASSISTANT");

    private AdaptiveCycleWindows() {}

    /** Student and assistant messages with content, oldest first. */
    public static List<AiMessage> chronologicalChat(List<AiMessage> messages) {
        return messages.stream()
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .filter(message -> CHAT_ROLES.contains(
                        message.getRole() == null ? "" : message.getRole().toUpperCase(Locale.ROOT)))
                .sorted(Comparator.comparing(AiMessage::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /** Messages of the current (possibly incomplete) cycle, after the last completed milestone. */
    public static List<AiMessage> openCycle(List<AiMessage> chronological, long totalQuestions) {
        long skipQuestions = totalQuestions - (totalQuestions % CYCLE_SIZE);
        if (skipQuestions <= 0) return chronological;
        int studentSeen = 0;
        int start = 0;
        for (int index = 0; index < chronological.size(); index++) {
            if (!"STUDENT".equalsIgnoreCase(chronological.get(index).getRole())) continue;
            studentSeen++;
            if (studentSeen == skipQuestions + 1) {
                start = index;
                break;
            }
        }
        return chronological.subList(start, chronological.size());
    }

    /** Messages from the start of the latest block of {@link AdaptiveReviewPolicy#CYCLE_SIZE} student questions. */
    public static List<AiMessage> latestCycle(List<AiMessage> chronological) {
        int studentSeen = 0;
        int cycleStart = 0;
        for (int index = chronological.size() - 1; index >= 0; index--) {
            if (!"STUDENT".equalsIgnoreCase(chronological.get(index).getRole())) continue;
            studentSeen++;
            if (studentSeen == CYCLE_SIZE) {
                cycleStart = index;
                break;
            }
        }
        return chronological.subList(cycleStart, chronological.size());
    }

    public static String latestClassId(List<AiConversation> conversations) {
        return conversations.stream()
                .filter(conversation -> conversation.getClassId() != null && !conversation.getClassId().isBlank())
                .max(Comparator.comparing(
                        AiConversation::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(conversation -> conversation.getClassId().trim())
                .orElse(null);
    }
}
