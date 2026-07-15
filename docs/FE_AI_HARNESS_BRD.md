# Frontend BRD - AI Tutor n8n Harness

## 1. Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Tên | Frontend Business Requirements Document for AI Tutor Harness |
| Phạm vi | React frontend kết nối Spring Boot và n8n AI Harness |
| Phiên bản | 1.0 |
| Ngày xác minh | 2026-07-16 |
| Trạng thái | Ready for implementation |
| Đối tượng đọc | Frontend developer, Codex, QA, backend/n8n developer |

Tài liệu này là đầu vào chuẩn để Codex triển khai hoặc rà soát AI Harness trên frontend. Không tự suy diễn endpoint, role, enum hoặc state ngoài tài liệu này nếu chưa đối chiếu lại backend.

## 2. Nguồn nghiệp vụ và thứ tự ưu tiên

Khi các tài liệu mâu thuẫn, dùng thứ tự ưu tiên sau:

1. Backend source code và DTO/controller hiện tại.
2. `FE_API_BUSINESS_LOGIC_VI.md` và `FE_EDUCATION_FLOW_HANDOFF_VI.md` cập nhật ngày 2026-07-15.
3. `n8n-import/AI-tutor.json` cập nhật ngày 2026-07-15.
4. `FRONTEND_N8N_PROJECT_GUIDE.md`.
5. `FRONTEND_N8N_INTEGRATION_GUIDE.md`.
6. Các README/handoff cũ hơn.

Các quyết định đã khóa:

- Webhook teacher answer đúng là `/webhook/teacher-answer-escalation`, không dùng `/webhook/teacher-answer`.
- Role tài khoản duy nhất là `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`; không có account role `MENTOR`.
- `MENTOR` chỉ là `senderRole` transport cho teacher/senior/admin khi nhắn trong ChatRoom; student dùng `senderRole=STUDENT`.
- Spring Boot là source of truth cho authentication, authorization, business state, persistence và RAG index.
- n8n chỉ điều phối AI/human-learning workflow, không thay Spring Boot làm BFF cho toàn hệ thống.
- Chỉ `KnowledgeCandidate` có status `INDEXED` mới được xem là AI đã học.
- Payment/subscription không thuộc phạm vi frontend demo.

## 3. Mục tiêu nghiệp vụ

Frontend phải cung cấp một learning loop hoàn chỉnh:

```text
Student hỏi AI
  -> n8n phân loại RAG / CODE / ESCALATE
  -> FE hiển thị answer, nguồn, confidence và trạng thái
  -> Student review answer
  -> Teacher/Senior xử lý khi cần
  -> KnowledgeCandidate chờ duyệt
  -> Senior/Admin approve
  -> Backend index vào RAG
  -> FE chỉ thông báo AI đã học khi status = INDEXED
```

Mục tiêu bổ sung:

- Mỗi request AI có thể truy vết bằng `traceId`.
- Không mất `conversationId`, `questionEscalationId`, `reviewId`, `candidateId`, `quizSessionId` hoặc `assignmentId`.
- Không tạo request trùng khi người dùng double click, timeout hoặc n8n trả response không rõ ràng.
- Luồng vẫn có thể chạy backend-direct khi AI Harness được chủ động tắt trong môi trường local.
- UI không hiển thị raw stack trace, node name hoặc lỗi kỹ thuật của n8n cho người dùng cuối.

## 4. Ngoài phạm vi

- FE không gọi OpenRouter, OpenAI hoặc LLM provider trực tiếp.
- FE không tự chunk, embedding hoặc index tài liệu.
- FE không đưa feedback thô hoặc teacher answer thẳng vào RAG.
- FE không tự quyết định quyền dựa vào role trong request body.
- FE không tự sửa mojibake/encoding bằng cách đoán nội dung.
- FE không triển khai payment/subscription.
- n8n không xử lý CRUD user/course/class/material/conversation thay backend.

## 5. Kiến trúc kết nối

### 5.1 Backend-direct

FE gọi Spring Boot trực tiếp cho:

- Auth, profile và password.
- Enrollment, course, class và academic CRUD.
- Conversation list/create/messages/search/rename/delete/pin.
- Escalation history/detail, mentor offer/select/cancel và chat room APIs.
- Student memory, pinned improve suggestions và click-to-learn.
- Material upload, URL TOC/import, list, reindex, update và delete.
- Quiz/history/detail, assignment CRUD/publish/review khi harness tương ứng bị tắt.
- Dashboard, assignment và diagnostics.

### 5.2 n8n Harness

FE gọi n8n cho các workflow AI được bật:

| Flow | Webhook |
|---|---|
| Student chat / RAG / Code / Escalate | `POST /webhook/student-chat` |
| Student answer review | `POST /webhook/answer-review` |
| Teacher answer escalation | `POST /webhook/teacher-answer-escalation` |
| Senior resolve answer review | `POST /webhook/senior-resolve-answer-review` |
| Senior/Admin candidate approval | `POST /webhook/senior-knowledge-approval` |
| Student/teacher quiz generation | `POST /webhook/quiz-generate` |
| Quiz submission | `POST /webhook/quiz-submit` |

Production dùng `/webhook`; `/webhook-test` chỉ dùng khi n8n editor đang listen test event.

### 5.3 Runtime modes

Frontend giữ các env hiện có:

```env
VITE_API_BASE_URL=http://localhost:8085/api
VITE_N8N_ENABLED=false
VITE_N8N_STRICT=false
VITE_N8N_BASE_URL=http://localhost:5678
VITE_N8N_WEBHOOK_MODE=production
VITE_N8N_TIMEOUT_MS=60000
```

Quy tắc:

- `VITE_N8N_ENABLED=false`: gọi backend-direct.
- `VITE_N8N_ENABLED=true` và `VITE_N8N_STRICT=true`: n8n là đường đi bắt buộc; lỗi harness không tự replay sang backend.
- `VITE_N8N_ENABLED=true` và strict false: chỉ dùng hybrid cho local/dev.
- Production phải dùng strict để tránh một mutation đã thành công trong backend nhưng FE timeout rồi gửi lại lần hai.
- Quiz generation phải có timeout tối thiểu 180 giây, không dùng timeout chat mặc định.

## 6. Authentication và quyền

- Mọi API/webhook bảo vệ phải có JWT.
- FE gửi token qua cả `Authorization: Bearer <JWT>` và `authToken` trong body webhook để tương thích workflow hiện tại.
- Không log JWT, password hoặc toàn bộ request chứa token.
- UI lấy role từ login/JWT, không lấy role trong body làm nguồn quyền.
- Role hợp lệ: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
- Sau khi admin đổi role, FE yêu cầu người dùng đăng nhập lại.
- `401`: xóa session và chuyển login.
- `403`: hiển thị không có quyền; không retry tự động.

## 7. Request envelope chuẩn cho n8n

Mọi workflow phải nhận được context tối thiểu:

```json
{
  "traceId": "uuid-per-action",
  "sessionId": "uuid-per-browser-tab",
  "conversationId": "optional-canonical-conversation-id",
  "authToken": "jwt",
  "courseId": "PRO192",
  "classId": "SE1833"
}
```

Quy tắc ID:

- `traceId`: tạo mới bằng `crypto.randomUUID()` cho từng user action.
- `sessionId`: tạo một lần cho browser tab và giữ trong `sessionStorage`.
- `conversationId`: luôn dùng ID backend trả về; không thay bằng `sessionId`.
- Response trả ID mới phải cập nhật state và refetch resource tương ứng.
- FE giữ `traceId` trong error details dành cho admin diagnostics, không bắt user ghi nhớ ID trừ khi cần hỗ trợ.

## 8. Functional requirements

### FR-AH-01 - Enrollment-first chat

- Student chỉ chat khi có enrollment thật.
- `courseId` lấy từ enrollment; không có default course giả.
- `classId` hiển thị read-only theo course enrollment, không cho chọn một class không thuộc student.
- Mỗi `studentId + courseId` có conversation history riêng.
- Đổi course phải có confirm và load history của course mới.

### FR-AH-02 - Student chat qua harness

Request chuẩn:

```json
{
  "traceId": "trace-id",
  "sessionId": "tab-session-id",
  "conversationId": "optional",
  "studentId": "student-id",
  "studentName": "Student A",
  "studentEmail": "student@school.local",
  "courseId": "PRO192",
  "classId": "SE1833",
  "message": "OOP là gì?",
  "question": "OOP là gì?",
  "codeSnippet": "",
  "authToken": "jwt"
}
```

Response được normalize về contract FE:

```json
{
  "success": true,
  "mode": "RAG",
  "answer": "markdown",
  "confidence": 0.87,
  "sources": [],
  "escalated": false,
  "conversationId": "conversation-id",
  "questionEscalationId": null,
  "userMessageId": "optional",
  "assistantMessageId": "optional",
  "nextImproveSuggestions": [],
  "traceId": "trace-id"
}
```

Normalization:

- `RAG_TUTOR` và `COURSE_AI` -> `RAG`.
- `CODE_MENTOR` -> `CODE`.
- Confidence dạng string phải đổi sang number nếu hợp lệ.
- `sources` luôn là array và phải deduplicate.
- Material source hiển thị filename/title, không hiển thị raw material ID nếu metadata resolve được.
- Không lặp source trong markdown answer và evidence block.

UX:

- Append user message optimistic một lần.
- Lock send trong lúc chạy; hỗ trợ Stop bằng `AbortSignal`.
- Stop chỉ hủy chờ ở client, không khẳng định workflow backend đã dừng.
- Render loading steps và lỗi trong assistant bubble.
- `RAG`: Course AI answer.
- `CODE`: Code review/hint; không quảng bá là full assignment solution.
- `ESCALATE`: ticket state, không render như answer chắc chắn.

### FR-AH-03 - Conversation limit và continuity

- Một conversation tối đa 10 câu hỏi của student.
- Hiển thị `Questions x/10` từ `userQuestionCount`.
- Nếu response trả `conversationId` khác ID đang mở, FE chuyển sang conversation mới và thông báo rõ.
- Conversation cũ vẫn mở read-only từ sidebar.
- Không mất pending exchange khi chuyển conversation.
- Pin message dùng backend, tối đa 3 item, không dùng localStorage làm source of truth.

### FR-AH-04 - Answer review

UI mapping:

| UI action | `reviewType` | Quy tắc |
|---|---|---|
| Helpful | `QUALITY_FEEDBACK` | `accurate=true`, `helpful=true`, rating 4-5 |
| Not correct | `ANSWER_DISPUTE` | `accurate=false`, yêu cầu feedback |
| Source conflict | `SOURCE_CONFLICT` | feedback bắt buộc |
| Missing material | `MISSING_MATERIAL` | feedback mô tả phần thiếu |

Payload phải có student/course/class/conversation, mode `RAG|CODE|ESCALATE`, question, answer, rating, accurate/helpful, feedback và reviewer identity.

Response state:

- `SUBMITTED`: recorded only.
- `NEEDS_MENTOR_REVIEW`: teacher queue.
- `NEEDS_SENIOR_REVIEW`: senior queue.
- `RESOLVED`: human review completed.

Sau submit luôn giải thích: feedback chưa làm AI học cho đến khi human review và candidate được approve/index.

### FR-AH-05 - Escalation và human support

Khi chat trả `mode=ESCALATE`:

- Lưu `questionEscalationId` và `conversationId`.
- Hiển thị ticket ID, original question, course/class và `studentVisibleStatus`.
- Detail phải gọi `GET /api/tutor/escalations/{id}` và ưu tiên `originalQuestion`.
- Poll/refetch detail theo trạng thái; dừng poll khi terminal.
- FE gọi `POST /api/tutor/escalations/offer?questionEscalationId=...` để lấy `suggestedMentors`.
- Student chọn teacher bằng `POST /api/tutor/escalations/select`; backend trả `chatRoomId` và chuyển escalation sang `IN_CHAT`.
- Chat hai chiều dùng `/api/chat/history`, `/api/chat/detail`, `/api/chat/send`, `/api/chat/mark-read`, `/api/chat/close` và `/ws/chat` theo participant JWT.
- WebSocket URL là `/ws/chat?chatRoomId=...&token=...`; payload gửi không tự khai báo user ID/role vì backend lấy từ JWT.
- REST student chat payload dùng `senderRole=STUDENT`; teacher/senior/admin dùng transport label `senderRole=MENTOR`.
- Nếu không có teacher phù hợp, FE giữ request và hiển thị lỗi matching; không giả lập teacher hoặc ChatRoom.
- Khi escalation `RESOLVED_INDEXED`, refetch conversation messages vì backend có thể append answer đã duyệt.

### FR-AH-06 - Teacher answer escalation

Teacher có hai mode:

1. `Reply to student only`: `createKnowledgeCandidate=false`.
2. `Propose reusable AI knowledge`: `createKnowledgeCandidate=true` và candidate type bắt buộc.

Candidate type được phép đề xuất để học:

- `ACADEMIC_KNOWLEDGE`
- `MATERIAL_CORRECTION`
- `FAQ_CLARIFICATION`

Không tạo candidate cho deadline, grading, policy lớp hoặc assignment-specific answer.

Sau response:

- Không candidate: reload escalation detail và hiển thị mentor answer.
- Có candidate: lưu `candidateId`, hiển thị `Pending senior approval`.
- Không được nói AI đã học ở bước này.

### FR-AH-07 - Senior resolve answer review

- Chỉ `SENIOR_MENTOR` hoặc `ADMIN` được thao tác.
- FE gửi `reviewId`, reviewer identity, decision, notes, corrected answer và candidate options.
- `createKnowledgeCandidate=true` yêu cầu corrected answer và candidate type học thuật.
- Sau thành công reload review queue và candidate queue.

### FR-AH-08 - Knowledge approval

- Approve/reject chỉ hiện cho `SENIOR_MENTOR` hoặc `ADMIN`.
- Approve yêu cầu `candidateId`, reviewer identity và review note.
- Reject yêu cầu `rejectionReason`.
- Chặn double submit.
- `INDEXED`: Approved into AI knowledge.
- `REJECTED`: Not added to AI knowledge.
- Người tạo candidate không được tự approve nếu backend policy chặn.

### FR-AH-09 - Improve suggestions và memory

- `nextImproveSuggestions` nằm dưới answer và là learning action, không phải pinned chat message.
- `Study now` gọi backend `/suggestions/learn`, gửi current conversation và append response vào chat.
- Suggestion đã dùng trả `409 SUGGESTION_ALREADY_USED`; FE disable item và refresh memory.
- Pin/unpin suggestion dùng memory pinned-suggestions API.
- Memory scope luôn là `studentId + courseId`.
- Không đưa answer lỗi LLM/server vào recent learning answer.

### FR-AH-10 - Quiz harness

Hai route:

- `STUDENT`: tạo `SELF_PRACTICE` quiz.
- `TEACHER`: tạo `TEACHER_ASSIGNMENT` draft.

Generate payload gồm identity phù hợp, course/class, topic, suggestion, title và `questionCount` 3-10.

Quy tắc:

- Timeout tối thiểu 180 giây.
- Không auto retry.
- Không hiển thị `correctAnswer` hoặc `explanation` trước submit.
- Student submit thành công phải reload quiz detail/history và memory.
- Teacher draft phải được review/edit trước publish.
- Assigned quiz có auto-grade tạm thời; teacher-reviewed score là kết quả cuối.
- Thiếu tài liệu/index phải hiển thị hướng dẫn upload/reindex, không hiển thị lỗi node kỹ thuật.

### FR-AH-11 - Harness diagnostics

Admin diagnostics dùng backend-direct:

- `GET /api/harness/logs`
- `GET /api/harness/error-logs`
- `GET /api/harness/traces/{traceId}`

UI cần filter theo trace/student/conversation/course/status/event type, hiển thị timeline node, status và sanitized error. Không hiển thị auth token hoặc secrets.

## 9. State mapping bắt buộc

| Backend state | UI label | Terminal |
|---|---|---:|
| `SUBMITTED` | Feedback recorded | Có |
| `NEEDS_MENTOR_REVIEW` | Pending mentor review | Không |
| `NEEDS_SENIOR_REVIEW` | Pending senior review | Không |
| `RESOLVED` | Review resolved | Có |
| `PENDING_OFFER` | Waiting for teacher support | Không |
| `ANSWERED` | Mentor answered | Có/đợi candidate |
| `ANSWERED_PENDING_SENIOR_REVIEW` | Answered, pending senior approval | Không |
| `ANSWERED_NO_KNOWLEDGE_CANDIDATE` | Mentor answered | Có |
| `PENDING_SENIOR_REVIEW` | Pending senior approval | Không |
| `INDEXED` | Approved into AI knowledge | Có |
| `REJECTED` | Not added to AI knowledge | Có |
| `RESOLVED_INDEXED` | Answered and AI knowledge updated | Có |
| `DRAFT` | Draft | Không |
| `PUBLISHED` | Published | Không |
| `GENERATED` | Ready to start | Không |
| `SUBMITTED_WAITING_TEACHER_REVIEW` | Waiting for teacher review | Không |
| `CLOSED` | Support chat closed | Có |

FE phải lấy state mới từ backend sau mutation, không tự suy đoán state cuối.

## 10. Error và fallback requirements

### 10.1 Response handling

n8n có thể trả HTTP 200 nhưng body báo lỗi. FE coi là lỗi nếu:

- `success === false`
- `ok === false`
- `status === "FAILED"`
- body rỗng hoặc JSON malformed

### 10.2 User-facing mapping

| Technical condition | User message |
|---|---|
| Network/n8n unavailable | AI Tutor is temporarily unavailable. Please try again. |
| LLM timeout/provider 5xx | AI Tutor is taking longer than usual. Please retry once or request teacher support. |
| Missing indexed material | Not enough indexed course material is available for this request. |
| `401` | Your session has expired. Please sign in again. |
| `403` | You do not have permission to perform this action. |
| `409` | This action was already completed. The latest data has been refreshed. |
| Malformed response | AI Tutor returned an invalid response. Please retry. |

Không đưa raw backend/n8n message, stack trace, node expression hoặc mojibake vào answer bubble.

### 10.3 Retry safety

- Không auto retry chat, quiz generation, answer review, teacher answer, senior resolve hoặc candidate approval.
- Timeout là trạng thái không chắc chắn; refetch resource bằng canonical ID trước khi cho gửi lại.
- Chỉ fallback backend tự động trong local hybrid mode.
- Production strict không replay mutation sang backend sau n8n timeout.
- `409` phải trigger refetch thay vì submit lại.

## 11. Non-functional requirements

### Security

- Không dùng `dangerouslySetInnerHTML` cho AI answer.
- Markdown không cho raw HTML; link mở ngoài có `rel="noopener noreferrer"`.
- Validate độ dài chat/feedback trước request.
- Không lưu API key hoặc n8n credential trong `VITE_*`.
- JWT chỉ đi đến backend/n8n được cấu hình, không gửi vào source/material URL.

### Performance

- Memoize markdown answer renderer.
- Lazy-load syntax highlighting/quiz renderer khi cần.
- Abort request khi user bấm Stop hoặc unmount.
- Conversation dài phải giữ scroll ổn định; cân nhắc virtualization sau khi vượt ngưỡng đo thực tế.
- Poll escalation/material status có backoff và dừng ở terminal state.

### Accessibility

- Icon-only action có tooltip và `aria-label`.
- Loading dùng `aria-live`; error và completion phải được screen reader thông báo.
- Focus quay về chat input sau response; modal đóng phải trả focus về trigger.
- Respect `prefers-reduced-motion`.

## 12. Target frontend modules

```text
src/
  config/
    env.js
    aiHarness.js
  services/
    n8nClient.js
    n8nService.js
    harnessApi.js
    conversationApi.js
    teacherReviewApi.js
    quizApi.js
  features/
    ai-harness/
      contracts.js
      normalizers.js
      errors.js
      trace.js
    student/chat/
    student/learning/
    student/quizzes/
    teacher/review-queue/
    admin/diagnostics/
```

Không bắt buộc move toàn bộ UI ngay. Tạo module mới rồi migrate từng flow; giữ compatibility facade cho đến khi không còn import cũ.

## 13. Current FE audit và backlog

### Đã có

- `n8nClient` hỗ trợ enabled/strict/base URL/webhook mode/timeout.
- `n8nService` có student chat, answer review, teacher answer và senior approval.
- Chat response normalize `RAG_TUTOR/CODE/ESCALATE`.
- Local có backend fallback.
- Student chat xử lý response `conversationId` mới.
- Friendly error và diagnostics API đã tồn tại.

### Harness implementation status (2026-07-16)

1. `Done` - Mọi request n8n gửi `authToken` trong body và Bearer token trong header khi có session.
2. `Done` - Mọi request có `traceId`; mỗi browser tab có stable `sessionId` trong `sessionStorage`.
3. `Done` - `postN8n` nhận external `AbortSignal`; chat và quiz có timeout riêng.
4. `Done` - Senior review resolution dùng `/senior-resolve-answer-review` và canonical backend fallback ở local hybrid mode.
5. `Done, feature flagged` - Quiz generate/submit có gateway n8n; mặc định `VITE_N8N_QUIZ_ENABLED=false` cho tới khi workflow quiz trả response đầy đủ.
6. `Done` - Response normalizer xử lý array/data wrapper, `ok/success/status`, confidence dạng số, canonical IDs, sources và suggestions.
7. `Done` - `VITE_N8N_STRICT=true` không replay mutation sang backend sau lỗi/timeout.
8. `Done for teacher/senior/candidate` - Queue và candidate list được refetch cả sau success lẫn timeout/error không chắc chắn.
9. `Done` - Admin diagnostics hiển thị backend-direct hoặc trạng thái n8n harness.
10. `Done` - Source evidence và improve suggestions được deduplicate trước khi render.
11. `Done` - Conversation history nhận cả role message canonical `STUDENT` và legacy `USER`.
12. `Done` - `nextImproveSuggestions` từ AI response được render thành action `Study now` / `Create quiz`.

### Verification still required

- Chạy end-to-end với workflow n8n active để xác nhận các node đọc body envelope và trả canonical IDs.
- Test malformed JSON, business `FAILED` body và timeout bằng workflow test; build/lint chỉ xác nhận tính đúng của FE code.
- Bật `VITE_N8N_QUIZ_ENABLED=true` chỉ sau khi `/quiz-generate` và `/quiz-submit` trả quiz session đầy đủ.

## 14. Known integration risks cần xác minh

1. Workflow `Set - Trace Context` của student chat hiện đọc một số field ở root trong khi các webhook khác đọc `$json.body`; cần test workflow active bằng request thật.
2. Một tài liệu cũ ghi `/teacher-answer`; endpoint chuẩn đã khóa là `/teacher-answer-escalation`.
3. n8n Respond nodes thường trả HTTP 200 cả khi business flow failed; FE bắt buộc đọc body.
4. `Respond RAG` trong workflow export chưa luôn trả `sources`, message IDs và improve suggestions; n8n cần forward các field này để UI đầy đủ.
5. Escalation không có `conversationId` sẽ không thể append mentor-approved answer về đúng AI chat; FE chỉ có thể hiển thị trong ticket detail.
6. Backend hiện đã xác nhận offer/select/chat/WebSocket là luồng chính; FE phải giữ `questionEscalationId` và `chatRoomId` để resume sau refresh.
7. Hybrid fallback sau timeout có nguy cơ duplicate mutation; chỉ dùng trong local/dev.

## 15. Implementation phases for Codex

### Phase 1 - Harness foundation

- Tạo request envelope, trace/session helper, per-flow timeout và external abort.
- Chuẩn hóa authToken/header, response normalizer và error model.
- Viết unit tests cho malformed/failed/success response.

### Phase 2 - Student learning loop

- Student chat, response evidence, conversation rollover, escalation ticket.
- Answer review và improve suggestion click-to-learn.
- Verify source metadata và no-duplicate rendering.

### Phase 3 - Human learning loop

- Teacher answer-only/candidate mode.
- Senior resolve review.
- Candidate approve/reject và canonical refetch.

### Phase 4 - Quiz harness

- Feature-flag quiz generate/submit.
- 180-second timeout, no retry, safe resume/detail.
- Teacher draft and assigned quiz status handling.

### Phase 5 - Diagnostics and hardening

- Trace timeline UI.
- Production strict mode.
- E2E tests with n8n on/off/failure/malformed response.

## 16. Acceptance criteria

### Student chat

- RAG, CODE và ESCALATE render đúng mode.
- Response giữ canonical conversation/ticket/message IDs.
- Course history không trộn lẫn.
- Conversation rollover sau 10 câu không mất exchange.
- Stop không tạo thêm optimistic message hoặc retry tự động.

### Review and knowledge

- Student feedback đi đúng review state.
- Teacher reply không tự cập nhật AI knowledge.
- Candidate chỉ hiển thị AI learned khi `INDEXED`.
- Role không đủ quyền không thể approve/reject.

### Quiz

- Generate không double-submit và chờ tối thiểu 180 giây.
- Đáp án đúng không lộ trước submit.
- Submit/refetch cập nhật score, memory và teacher-review state.

### Reliability

- n8n HTTP 200 + failed body được xử lý như lỗi.
- Malformed/empty response không crash React tree.
- Production không tự replay mutation khi timeout.
- Admin tra được request theo `traceId` mà không thấy secret.

## 17. Definition of Done

- `npm run build` pass.
- `npm run lint` không có error.
- Test đủ n8n disabled, enabled strict, n8n offline, malformed JSON và business failed body.
- Test JWT `401/403`, duplicate `409`, missing material và LLM timeout.
- Test các role Student, Teacher, Senior Mentor và Admin.
- Không có direct LLM/provider URL hoặc API key trong frontend bundle.
- Cập nhật `docs/FE_API_COVERAGE.md` và `docs/FE_UPDATE_LOG.md` sau mỗi phase.
