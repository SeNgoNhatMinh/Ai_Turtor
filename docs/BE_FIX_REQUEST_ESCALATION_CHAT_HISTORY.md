# BE Fix Request: Escalation Chat Must Be Saved Into AI Conversation History

## Problem

When a student asks a question that is classified as `ESCALATE`, backend creates a `QuestionEscalation`, but the AI chat exchange is not saved into AI conversation history.

Result in FE:

- Student sees the escalation answer temporarily.
- If the page is refreshed, the chat turn disappears.
- `GET /api/ai/conversations/{conversationId}/messages` returns no messages for that escalation-only turn.
- FE cannot reliably restore the chat because backend did not persist the user/assistant messages.

This should be fixed in BE, not wrapped with FE localStorage.

## Current BE Behavior

File:

```text
src/main/java/com/ragapi/controller/TutorController.java
```

Method:

```java
private ResponseEntity<?> handleEscalationIntent(...)
```

Current flow:

1. Intent classifier returns `ESCALATE`.
2. BE calls:

```java
mentorEscalationService.createQuestionEscalation(...)
```

3. BE returns `AiQueryResponse` with:

```json
{
  "mode": "ESCALATE",
  "escalated": true,
  "questionEscalationId": "..."
}
```

4. But BE does **not** call:

```java
aiConversationService.saveExchangeWithMessages(...)
```

So no AI conversation messages are persisted.

## Expected BE Behavior

For `ESCALATE` mode, backend should persist the chat turn exactly like RAG/CODE flow.

The saved exchange should include:

- user message: original student question
- assistant message: escalation response text
- `questionEscalationId` on assistant message
- `courseId`
- `classId`
- `conversationId`
- `userMessageId`
- `assistantMessageId`

## Required Response Contract

`POST /api/ai/query` when mode is `ESCALATE` should return:

```json
{
  "mode": "ESCALATE",
  "answer": "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.",
  "escalated": true,
  "questionEscalationId": "...",
  "conversationId": "...",
  "userMessageId": "...",
  "assistantMessageId": "...",
  "courseId": "OSG202"
}
```

After that, this endpoint must return the same turn after refresh:

```http
GET /api/ai/conversations/{conversationId}/messages?userId={studentId}
```

Expected messages:

```json
[
  {
    "role": "USER",
    "content": "student question"
  },
  {
    "role": "ASSISTANT",
    "content": "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.",
    "questionEscalationId": "..."
  }
]
```

## Suggested BE Patch

Inside `handleEscalationIntent(...)`, after creating `questionEscalation`, call `aiConversationService.saveExchangeWithMessages(...)`.

Recommended method signature change:

```java
private ResponseEntity<?> handleEscalationIntent(
        AiQueryRequest request,
        String question,
        String courseId,
        String classId,
        String userId,
        String userName,
        String userEmail,
        IntentClassification intent
)
```

Then call:

```java
String answer = questionEscalation != null
        ? "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách."
        : "Câu hỏi này cần giáo viên/mentor hỗ trợ. Vui lòng đăng nhập để tạo phiếu escalation.";

String conversationId = null;
String userMessageId = null;
String assistantMessageId = null;

if (userId != null && !userId.isBlank()) {
    var savedExchange = aiConversationService.saveExchangeWithMessages(
            userId,
            request.getConversationId(),
            courseId,
            classId,
            question,
            answer,
            questionEscalation != null ? questionEscalation.getId() : null
    );
    conversationId = savedExchange.conversationId();
    userMessageId = savedExchange.userMessageId();
    assistantMessageId = savedExchange.assistantMessageId();
}
```

Then set response fields:

```java
response.setConversationId(conversationId);
response.setUserMessageId(userMessageId);
response.setAssistantMessageId(assistantMessageId);
response.setCourseId(courseId);
```

## Acceptance Test

1. Student asks a question that routes to `ESCALATE`.
2. BE returns `questionEscalationId` and `conversationId`.
3. Refresh FE.
4. Open the same conversation.
5. The user question and escalation assistant message still appear.
6. The assistant message still has `questionEscalationId`, so FE can show `Choose who should help`.

## Related FE Note

FE should not store escalation-only chat turns in localStorage. Backend conversation history is the canonical source.
