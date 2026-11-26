# Business logic API cho Frontend — AI Tutor Education

Tài liệu này là nguồn tham chiếu cho FE về quyền gọi API, điều kiện nghiệp vụ, state transition và cách xử lý lỗi. Danh sách màn hình và payload mẫu đầy đủ nằm trong `FE_EDUCATION_FLOW_HANDOFF_VI.md`.

## 1. Quy ước chung

### Xác thực và phân quyền

- Gửi `Authorization: Bearer <JWT>` với mọi API không public.
- Role hợp lệ: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
- Mentor thông thường chính là `TEACHER`; không có role `MENTOR` ở cấp tài khoản.
- `SENIOR_MENTOR` có toàn bộ quyền teacher và thêm quyền xử lý/duyệt knowledge.
- Role trong body chỉ là dữ liệu nghiệp vụ. Backend vẫn phân quyền bằng JWT.
- Sau khi admin đổi role, người dùng phải đăng nhập lại.

### HTTP status FE cần xử lý

| HTTP | Ý nghĩa | Xử lý FE |
|---:|---|---|
| `200` | Thành công | Cập nhật state từ response |
| `400` | Payload/state không hợp lệ | Hiển thị `message` hoặc `error` |
| `401` | Thiếu/hết hạn JWT | Logout và chuyển login |
| `403` | Không đúng role | Hiển thị không có quyền; không retry |
| `409` | Trùng thao tác | Refresh dữ liệu, không gửi lại |
| `500` | Lỗi hệ thống/AI provider | Cho retry thủ công, không loop tự động |

### ID phải lưu ở FE

- `conversationId`: chuỗi hội thoại AI.
- `questionEscalationId`: yêu cầu hỗ trợ con người.
- `reviewId`: review câu trả lời AI.
- `chatRoomId`: phòng chat student–teacher.
- `candidateId`: kiến thức chờ duyệt.
- `quizSessionId`: lượt làm quiz.
- `assignmentId`: quiz assignment của teacher.

## 2. AI query và conversation

### `POST /webhook/student-chat`

Mục đích: entry point chính để student hỏi AI.

Backend/n8n thực hiện:

1. Chuẩn hóa student, course, class và conversation.
2. Phân loại intent.
3. Route sang `RAG`, `CODE` hoặc `ESCALATE`.
4. Với RAG/CODE: tạo answer, lưu conversation và cập nhật student course memory.
5. Với ESCALATE: tạo `QuestionEscalation`.

FE:

- Lock nút gửi trong khi request chạy.
- Append user message ngay; assistant message chỉ xác nhận sau response.
- Dùng `conversationId` response cho câu hỏi tiếp theo.
- Nếu `mode=ESCALATE`, lưu `questionEscalationId` và mở trạng thái human support.
- Không tự retry AI query nhiều lần vì mỗi retry tiêu quota.

### `POST /api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn`

Mục đích: student bấm một improve suggestion để tiếp tục học trong conversation hiện tại.

Logic:

- Chuyển suggestion thành một learning question.
- Nếu suggestion đã được dùng trong recent questions, trả `409 SUGGESTION_ALREADY_USED`.
- Nếu hợp lệ, gọi Course RAG, lưu interaction/conversation và trả suggestion tiếp theo.

FE phải disable suggestion đã dùng và dùng `conversationId` mới từ response.

## 3. Escalation và chọn teacher

### `POST /api/tutor/escalations`

Tạo escalation khi AI không đủ tự tin hoặc student yêu cầu con người.

Bắt buộc: `studentId`, `courseId`, `question`. Backend lưu câu hỏi, AI response/reason, class và conversation.

State ban đầu do escalation service xác định. Response luôn trả `questionEscalationId`; FE dùng ID này để theo dõi.

### `POST /api/tutor/escalations/offer?questionEscalationId={id}`

Tìm/đề xuất teacher phù hợp dựa trên course, class, trạng thái active và khả năng nhận chat.

FE hiển thị danh sách đề xuất. Không tự chọn teacher nếu UI cho student quyền lựa chọn.

### `POST /api/tutor/escalations/select`

Student chọn teacher. Backend kiểm tra escalation/user/teacher và tạo chat room.

Kết quả quan trọng: `chatRoomId`. Sau thành công, FE chuyển sang màn hình chat.

### `POST /api/tutor/escalations/cancel`

Hủy offer khi student chưa muốn tiếp tục. FE đóng modal/offer và refresh escalation.

### `GET /api/tutor/escalations/history?userId={studentId}`

Trả lịch sử escalation của student. Dùng cho trang lịch sử hỗ trợ.

### `GET /api/tutor/escalations/{id}`

Nguồn sự thật của trạng thái escalation, mentor answer, candidates và `aiBrainUpdated`.

FE nên dùng endpoint này sau khi teacher trả lời hoặc candidate được duyệt.

## 4. Chat student–teacher

### `POST /api/chat/send`

Lưu một message và cập nhật message count, last message, unread state của room.

Giá trị `senderRole` ở message:

- Student gửi: `STUDENT`.
- Teacher gửi: `MENTOR`.

Đây là role hiển thị trong chat, khác role tài khoản JWT (`STUDENT`/`TEACHER`). Backend không tin `senderId`/`senderRole` từ body: hai trường phải khớp JWT và participant của room, nếu không trả `403`.

Quy tắc bảo mật áp dụng cho mọi chat API:

- Student chỉ truy cập room có `room.userId` trùng JWT user ID.
- `TEACHER`/`SENIOR_MENTOR` chỉ truy cập room có `room.mentorId` trùng JWT user ID.
- `ADMIN` có thể kiểm tra mọi room.
- Người ngoài room không được xem history/detail, gửi, mark-read hoặc đóng room.
- Room khác `ACTIVE` không nhận message mới.
- `content` bắt buộc, tối đa 10.000 ký tự.

### `GET /api/chat/history`

Trả message phân trang, mới nhất trước. FE cần đảo thứ tự nếu UI hiển thị cũ → mới.

### `GET /api/chat/detail`

Trả thông tin participant, original question, AI response, room status và unread.

### `POST /api/chat/mark-read`

Đặt room `isUnread=false`. `userId` trong body cũ không còn được tin cậy; backend lấy user ID từ JWT. Gọi khi người dùng mở room hoặc đã render message mới.

### `GET /api/chat/unread`

- Không truyền `userId` hoặc `role` trên query.
- Backend tự lấy participant và role từ JWT.

Dùng cho badge inbox. REST vẫn là fallback và dùng để tải history phân trang.

### `WS /ws/chat` — realtime

Kết nối native WebSocket:

```text
ws://localhost:8085/ws/chat?chatRoomId={ROOM_ID}&token={JWT}
```

Production bắt buộc dùng `wss://`. Handshake kiểm tra JWT, role và participant; sai hoặc hết hạn sẽ từ chối kết nối.

Gửi message:

```json
{
  "type": "SEND_MESSAGE",
  "senderName": "Nguyen Van A",
  "content": "Em chưa hiểu phần này",
  "messageType": "TEXT",
  "attachmentUrl": null,
  "attachmentName": null
}
```

Không gửi `senderId`, `senderRole` hoặc `chatRoomId` trong WebSocket message; backend lấy từ session đã xác thực.

Server events:

- `CONNECTED`: kết nối thành công.
- `NEW_MESSAGE`: message đã lưu và broadcast cho hai participant đang online.
- `PONG`: response cho `{ "type": "PING" }`.
- `ERROR`: message bị từ chối, ví dụ room đã đóng hoặc content rỗng.

Sau reconnect, FE gọi REST history để lấy message có thể đã bỏ lỡ. WebSocket server hiện lưu session trong memory nên chạy phù hợp một API instance; khi scale nhiều instance cần Redis pub/sub hoặc message broker.

### `POST /api/chat/close`

Đóng room, lưu rating/feedback, cập nhật escalation `COMPLETED`, duration và giảm active chat count của teacher.

Sau khi `CLOSED`, FE phải disable gửi message và hiển thị rating/result.

## 5. Review câu trả lời AI

### `POST /webhook/answer-review`

Backend lưu `AiAnswerReview` rồi tự phân loại:

```text
Operational review → SUBMITTED
Source conflict/missing material/severe rating → NEEDS_SENIOR_REVIEW
Negative review → NEEDS_MENTOR_REVIEW
Review bình thường → SUBMITTED
```

Quy tắc chính:

- Rating `<=1`, sai nguồn/tài liệu hoặc review nghiêm trọng → senior.
- `accurate=false`, rating `<=3`, correctness LOW/INCORRECT/WRONG → mentor nếu chưa thuộc senior.
- Review vận hành/lớp/điểm số không được dùng để dạy AI.
- Review nghiêm trọng phải có `feedback`.

FE không được hiểu `Respond Sent To Mentor/Senior` là notification đã gửi. Response chỉ báo routing status.

### `GET /api/tutor/answer-reviews`

Filter bằng `status`, `courseId`, `studentId`. Dùng cho dashboard/history.

### `GET /api/tutor/answer-reviews/mentor-pending`

Trả review `NEEDS_MENTOR_REVIEW`. Chỉ hiển thị trong teacher inbox.

### `GET /api/tutor/answer-reviews/senior-pending`

Trả review `NEEDS_SENIOR_REVIEW`. Chỉ hiển thị trong senior/admin inbox.

### `POST /webhook/senior-resolve-answer-review`

Chỉ `SENIOR_MENTOR`/`ADMIN`.

Logic:

1. Ghi reviewer, decision, notes và thời gian xử lý.
2. Chuyển review thành `RESOLVED`.
3. Nếu `createKnowledgeCandidate=true`, bắt buộc có corrected content và candidate type hợp lệ.
4. Tạo candidate `PENDING_SENIOR_REVIEW`, source `AI_ANSWER_REVIEW`.
5. Gắn `linkedKnowledgeCandidateId` vào review.

Candidate chỉ được tạo từ learning dispute/source conflict/missing material; feedback vận hành không được vào AI brain.

## 6. Teacher answer và human learning

### `POST /webhook/teacher-answer-escalation`

Teacher trả lời một escalation.

Nếu `createKnowledgeCandidate=false`:

```text
Lưu MentorAnswer
→ escalation = ANSWERED_NO_KNOWLEDGE_CANDIDATE
→ student nhận answer
```

Nếu `true`:

```text
Lưu MentorAnswer
→ tạo KnowledgeCandidate
→ candidate = PENDING_SENIOR_REVIEW
→ escalation = ANSWERED_PENDING_SENIOR_REVIEW
```

Chỉ chọn tạo candidate khi answer chứa kiến thức học thuật tái sử dụng được. Quy định lớp, grading hoặc nội dung riêng một assignment không nên vào RAG.

## 7. Knowledge candidate và RAG brain

### `GET /api/tutor/knowledge-candidates/senior-pending`

Trả candidate `PENDING_SENIOR_REVIEW`. FE senior queue hiển thị source, question, answer/content, course và người tạo.

### `POST /webhook/senior-knowledge-approval` — APPROVE

Chỉ `SENIOR_MENTOR`/`ADMIN`.

Backend:

1. Kiểm tra candidate đang pending.
2. Kiểm tra reviewer role.
3. Kiểm tra quy tắc người tạo/tự duyệt hiện hành.
4. Tạo `CourseMaterial` dạng senior-approved knowledge.
5. Chunk content và index vector vào Elasticsearch.
6. Candidate chuyển `INDEXED`.
7. Nếu candidate đến từ escalation, cập nhật escalation `RESOLVED_INDEXED`.

Chỉ khi status `INDEXED` thì kiến thức mới nằm trong AI brain.

### `POST /webhook/senior-knowledge-approval` — REJECT

Bắt buộc `rejectionReason`. Candidate chuyển `REJECTED`, không index RAG; escalation liên quan cũng được cập nhật.

State machine:

```text
PENDING_SENIOR_REVIEW
  ├─ APPROVE → INDEXED
  └─ REJECT  → REJECTED
```

Không cho approve/reject lần hai khi candidate không còn pending.

## 8. Student self-practice quiz

### `POST /webhook/quiz-generate` với `studentId`

Backend:

1. Validate student/course.
2. Clamp `questionCount` trong khoảng 3–10, mặc định 5.
3. Tìm tài liệu course/class từ vector store, fallback search và rerank.
4. Nếu không đủ tài liệu, trả `NOT_ENOUGH_INDEXED_MATERIAL`.
5. Gọi AI tạo câu hỏi grounded theo tài liệu.
6. Lưu `QuizSession` loại `SELF_PRACTICE`, status `GENERATED`.

FE không hiển thị đáp án đúng trước khi submit. Model free có thể chờ 2–3 phút; không auto retry.

### `GET /api/tutor/quizzes/{quizSessionId}`

Trả student view của quiz. Dùng khi resume/refresh.

### `POST /webhook/quiz-submit`

Backend đối chiếu answer, tính score/percentage và cập nhật memory. Self-practice trả điểm ngay.

FE phải gửi đúng question/selected answer theo DTO response, disable submit lần hai sau thành công.

### `GET /api/tutor/students/{studentId}/courses/{courseId}/quizzes`

Trả lịch sử quiz course của student để hiển thị progress.

## 9. Teacher quiz assignment

### `POST /webhook/quiz-generate` với `teacherId`

Route sang teacher assignment generation.

Backend tái sử dụng engine tạo quiz, sau đó:

- Xóa quiz session tạm.
- Tạo `QuizAssignment` status `DRAFT`.
- Teacher phải review/edit trước khi publish.

### `PUT /api/tutor/quiz-assignments/{assignmentId}`

Chỉ sửa được `DRAFT`. Assignment `PUBLISHED` không sửa được.

### `DELETE /api/tutor/quiz-assignments/{assignmentId}`

Chỉ xóa được `DRAFT`. Published assignment không xóa bằng endpoint này.

### `POST /api/tutor/quiz-assignments/{assignmentId}/publish`

Điều kiện:

- Assignment có questions.
- `targetType=CLASS` hoặc `SELECTED_STUDENTS`.
- Nếu selected students, FE gửi danh sách student IDs.

Sau publish, assignment xuất hiện trong danh sách student phù hợp.

### `GET /api/tutor/teachers/{teacherId}/quiz-assignments`

Danh sách draft/published của teacher. FE dùng status để bật/tắt Edit/Delete/Publish.

### `GET /api/tutor/teachers/{teacherId}/quiz-attempts`

Danh sách bài làm quiz được giao thuộc teacher đang đăng nhập. Backend kiểm tra `{teacherId}` phải trùng user ID trong JWT; `ADMIN` có thể xem thay teacher. Teacher khác nhận `403`.

Query hỗ trợ:

```text
status=SUBMITTED
reviewStatus=PENDING|REVIEWED
courseId=PRO192
classId=SE1840
assignmentId=...
studentId=...
page=0
size=20
```

`size` được giới hạn 1–100. Response:

```json
{
  "teacherId": "TEACHER_ID",
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "attempts": [
    {
      "quizSessionId": "QUIZ_ID",
      "assignmentId": "ASSIGNMENT_ID",
      "studentId": "STUDENT_ID",
      "courseId": "PRO192",
      "classId": "SE1840",
      "status": "SUBMITTED",
      "teacherReviewStatus": "PENDING",
      "autoScore": 3,
      "teacherReviewedScore": null,
      "finalScore": 3,
      "maxScore": 5,
      "autoPercentage": 60.0,
      "finalPercentage": 60.0,
      "submittedAt": "..."
    }
  ]
}
```

FE dùng `finalScore/finalPercentage` để hiển thị kết quả chính thức. Trước review, final score bằng auto score; sau review, final score bằng teacher reviewed score.

### `GET /api/tutor/students/{studentId}/courses/{courseId}/quiz-assignments`

Chỉ trả published assignment dành cho cả class hoặc student được chọn.

### `POST /api/tutor/quiz-assignments/{assignmentId}/attempts?studentId={id}`

Kiểm tra assignment đã publish và student thuộc target. Nếu hợp lệ, tạo quiz attempt gắn `assignmentId`.

### `PUT /api/tutor/quizzes/{quizSessionId}/teacher-review`

Teacher xác nhận/chỉnh kết quả quiz được giao. Backend chỉ cho phép khi:

- `quizType=ASSIGNED`.
- `status=SUBMITTED`.
- `teacherReviewStatus=PENDING`.
- Teacher trong JWT chính là owner của attempt.
- `reviewedScore` từ 0 đến `maxScore`.

Thành công chuyển `teacherReviewStatus=REVIEWED`. FE chỉ hiển thị action Review cho item `PENDING`; sau thành công refresh danh sách.

Submit state:

```text
ASSIGNED + submit → status=SUBMITTED, teacherReviewStatus=PENDING
SELF_PRACTICE + submit → status=SUBMITTED, teacherReviewStatus=NOT_REQUIRED
```

Một quiz session chỉ được submit một lần; submit lại trả `400`.

## 10. Student course memory

Memory được cập nhật qua các tương tác học tập, không phải AI global brain.

Phân biệt:

- `StudentCourseMemory`: tiến độ/cá nhân hóa riêng student + course.
- Elasticsearch RAG: knowledge dùng chung của course.
- Knowledge candidate chỉ đi vào RAG sau `INDEXED`.

FE không gọi update memory để “dạy AI” kiến thức mới; quy trình candidate approval mới làm việc đó.

## 11. Admin role management

### `PATCH /api/admin/teachers/{teacherId}/role`

Chỉ `ADMIN`.

Role body chỉ chấp nhận:

- `TEACHER`
- `SENIOR_MENTOR`

Backend tìm teacher trong collection mentors, sau đó cập nhật role ở login user. Nếu chưa có login account đồng bộ, trả `400`.

Sau thành công:

- Database có role mới.
- JWT cũ không đổi.
- FE phải yêu cầu teacher đăng nhập lại.

Initializer khi backend restart giữ nguyên `SENIOR_MENTOR`, không reset về `TEACHER`.

## 12. Mapping state sang UI

| Backend state | Nhãn UI đề xuất | Action |
|---|---|---|
| `SUBMITTED` | Đã ghi nhận | Không action |
| `NEEDS_MENTOR_REVIEW` | Chờ mentor xử lý | Teacher mở review |
| `NEEDS_SENIOR_REVIEW` | Chờ senior xử lý | Senior sửa answer |
| `RESOLVED` | Đã xử lý | Xem kết quả/candidate |
| `PENDING_SENIOR_REVIEW` | Chờ duyệt kiến thức | Approve/Reject |
| `INDEXED` | Đã cập nhật AI | Read-only |
| `REJECTED` | Không được chấp nhận | Xem lý do |
| `DRAFT` | Bản nháp | Edit/Delete/Publish |
| `PUBLISHED` | Đã giao | Không edit/delete |
| `GENERATED` | Sẵn sàng làm bài | Start/Submit |
| `CLOSED` | Chat đã đóng | Không gửi message |

## 13. Checklist tích hợp FE

- Dùng JWT role để quyết định route/menu/action.
- Không hard-code role `MENTOR`; tài khoản mentor là `TEACHER`.
- Refresh pending lists sau resolve/approve/reject.
- Lấy state mới từ backend, không tự suy đoán state ở client.
- Chặn double submit cho AI query, quiz generation, quiz submit và approval.
- Hiển thị error message backend nhưng không lộ stack trace.
- Log `traceId` cho request qua n8n để đối chiếu khi lỗi.
- Dùng timeout tối thiểu 180 giây cho AI quiz generation.
- Không đưa student feedback trực tiếp vào RAG.
- Chỉ hiển thị “AI đã học” khi candidate có status `INDEXED`.
