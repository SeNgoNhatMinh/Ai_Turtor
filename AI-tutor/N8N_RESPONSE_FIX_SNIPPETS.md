# N8N Response Body Fix Snippets

Copy từng block dưới đây vào đúng node `Respond to Webhook` trong n8n.

## Respond ESCALATE

```js
={{ JSON.stringify({
  success: true,
  mode: "ESCALATE",
  escalated: true,
  answer: "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.",
  questionEscalationId: $node["Create Escalation"].json.questionEscalationId,
  conversationId: $node["Set - Trace Context"].json.conversationId,
  traceId: $node["Set - Trace Context"].json.traceId
}) }}
```

## Respond Review Saved

```js
={{ JSON.stringify({
  ok: true,
  status: "SUBMITTED",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback đã được ghi nhận để phân tích chất lượng câu trả lời."
}) }}
```

## Respond Review Saved1

```js
={{ JSON.stringify({
  ok: true,
  status: "SUBMITTED",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback đã được ghi nhận để phân tích chất lượng câu trả lời."
}) }}
```

## Respond Sent To Mentor

```js
={{ JSON.stringify({
  ok: true,
  status: "NEEDS_MENTOR_REVIEW",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback đã được gửi cho mentor kiểm tra. AI chưa học từ feedback này."
}) }}
```

## Respond Sent To Senior

```js
={{ JSON.stringify({
  ok: true,
  status: "NEEDS_SENIOR_REVIEW",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback cần senior mentor xác nhận trước khi AI được học."
}) }}
```

## Respond Approved

```js
={{ JSON.stringify({
  ok: true,
  decision: "APPROVE",
  candidateId: $node["Set Approval Input"].json.candidateId,
  message: "KnowledgeCandidate đã được approve và index vào RAG Brain."
}) }}
```

## Respond Candidate Created

```js
={{ JSON.stringify({
  ok: true,
  knowledgeCandidateCreated: true,
  candidateId: $node["Answer Escalation"].json.knowledgeCandidate?.id || null,
  candidateStatus: $node["Answer Escalation"].json.knowledgeCandidate?.status || "PENDING_SENIOR_REVIEW",
  message: "Câu trả lời đã tạo KnowledgeCandidate và đang chờ Senior Mentor/Admin duyệt trước khi AI học."
}) }}
```

## Respond Answer Only

```js
={{ JSON.stringify({
  ok: true,
  knowledgeCandidateCreated: false,
  message: "Câu trả lời của mentor đã được lưu và gửi cho học sinh. Không tạo tri thức mới cho AI."
}) }}
```

## Respond Rejected

```js
={{ JSON.stringify({
  ok: true,
  decision: "REJECT",
  candidateId: $node["Set Approval Input"].json.candidateId,
  message: "KnowledgeCandidate đã bị reject. AI không học nội dung này."
}) }}
```

## Respond Answer Failed

```js
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  message: "Không thể lưu câu trả lời của mentor. Vui lòng thử lại sau.",
  traceId: $node["Set Teacher Answer Input"].json.traceId || "",
  conversationId: $node["Set Teacher Answer Input"].json.conversationId || "",
  questionEscalationId: $node["Set Teacher Answer Input"].json.questionEscalationId,
  error: "TEACHER_ANSWER_FAILED"
}) }}
```

## Respond Review Failed

```js
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  message: "Không thể lưu đánh giá câu trả lời AI. Vui lòng thử lại sau.",
  traceId: $node["Set Normalize Review Input"].json.traceId,
  conversationId: $node["Set Normalize Review Input"].json.conversationId,
  error: "ANSWER_REVIEW_FAILED"
}) }}
```

## Respond Failed

```js
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  message: "Không thể nộp quiz lúc này. Vui lòng thử lại sau.",
  traceId: $node["Set: Normalize Quiz Submit"].json.traceId,
  quizSessionId: $node["Set: Normalize Quiz Submit"].json.quizSessionId
}) }}
```

## Respond Submitted Waiting Teacher Review

```js
={{ JSON.stringify({
  success: true,
  status: "SUBMITTED_WAITING_TEACHER_REVIEW",
  quizType: "ASSIGNED",
  quizSessionId: $json.id || $node["Set: Normalize Quiz Submit"].json.quizSessionId,
  score: $json.score,
  maxScore: $json.maxScore,
  percentage: $json.percentage,
  teacherReviewStatus: $json.teacherReviewStatus || "PENDING_REVIEW",
  message: "Bài quiz đã được nộp và chấm tạm thời. Mentor sẽ review lại điểm/bài làm.",
  traceId: $node["Set: Normalize Quiz Submit"].json.traceId
}) }}
```

## Respond Self Practice Score

```js
={{ JSON.stringify({
  success: true,
  status: "SUBMITTED",
  quizType: $json.quizType || "SELF_PRACTICE",
  quizSessionId: $json.id || $node["Set: Normalize Quiz Submit"].json.quizSessionId,
  score: $json.score,
  maxScore: $json.maxScore,
  percentage: $json.percentage,
  message: "Quiz đã được chấm. Kết quả đã cập nhật vào memory học tập.",
  traceId: $node["Set: Normalize Quiz Submit"].json.traceId
}) }}
```

## Respond Failed1

```js
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  quizType: "SELF_PRACTICE",
  message: "Không thể tạo quiz tự ôn lúc này.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId,
  error: "QUIZ_GENERATE_FAILED"
}) }}
```

## Respond Failed3

```js
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  quizType: "TEACHER_ASSIGNMENT",
  message: "Không thể tạo draft quiz cho giáo viên lúc này.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId
}) }}
```

## Respond Teacher Draft Created

```js
={{ JSON.stringify({
  success: true,
  status: "DRAFT_CREATED",
  quizType: "TEACHER_ASSIGNMENT",
  assignmentId: $node["Generate Teacher Assignment Draft"].json.id,
  assignment: $node["Generate Teacher Assignment Draft"].json,
  message: "Draft quiz đã được tạo từ tài liệu. Mentor có thể review, sửa, xóa hoặc publish.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId
}) }}
```
