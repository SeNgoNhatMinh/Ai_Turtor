# AI Tutor Education — Bàn giao flow cho Frontend

Tài liệu này mô tả các màn hình, vai trò, trạng thái và API/webhook FE cần dùng. Mục tiêu là để FE triển khai đúng hành trình học tập và quy trình con người kiểm duyệt kiến thức AI.

Chi tiết business logic, validation và state transition của từng nhóm API: `FE_API_BUSINESS_LOGIC_VI.md`.

## 1. Địa chỉ chạy local

- Backend API: `http://localhost:8085`
- Swagger: `http://localhost:8085/swagger-ui/index.html`
- n8n: `http://localhost:5678`
- Production webhook n8n: `http://localhost:5678/webhook/{path}`
- Test webhook n8n chỉ dùng khi bấm Listen for test event: `http://localhost:5678/webhook-test/{path}`

Tất cả request cần đăng nhập phải gửi:

```http
Authorization: Bearer <JWT>
```

Khi gọi webhook n8n, FE có thể gửi JWT trong header `Authorization` hoặc trường `authToken` trong body. Ưu tiên dùng header.

## 2. Vai trò

| Role | Ý nghĩa | Giao diện chính |
|---|---|---|
| `STUDENT` | Học sinh | AI Tutor, quiz, chat mentor, lịch sử học |
| `TEACHER` | Teacher và mentor thông thường là cùng một role | Mentor inbox, chat, tạo quiz, quản lý bài học |
| `SENIOR_MENTOR` | Mentor cấp cao | Toàn bộ chức năng teacher + xử lý review nghiêm trọng + duyệt AI knowledge |
| `ADMIN` | Quản trị | Quản lý tài khoản, role, có thể duyệt knowledge |

Không sử dụng role `MENTOR` riêng. Mentor mặc định là `TEACHER`.

Sau khi admin đổi role, tài khoản phải đăng nhập lại để JWT chứa role mới.

## 3. Danh sách webhook n8n

| Chức năng | Method | Webhook path |
|---|---|---|
| Student hỏi AI | POST | `/webhook/student-chat` |
| Student review câu trả lời | POST | `/webhook/answer-review` |
| Teacher trả lời escalation | POST | `/webhook/teacher-answer-escalation` |
| Senior xử lý review nghiêm trọng | POST | `/webhook/senior-resolve-answer-review` |
| Senior/Admin duyệt candidate | POST | `/webhook/senior-knowledge-approval` |
| Tạo quiz student/teacher | POST | `/webhook/quiz-generate` |
| Nộp quiz | POST | `/webhook/quiz-submit` |

Không gọi `/webhook/teacher-answer`; path đúng là `/webhook/teacher-answer-escalation`.

## 4. Student AI Tutor

### Màn hình

- Danh sách môn/lớp của student.
- Khu vực chat AI.
- Hiển thị answer, nguồn tham khảo, confidence và mode.
- Nút đánh giá sau mỗi answer.
- Nút yêu cầu mentor khi cần.

### Gửi câu hỏi

```http
POST /webhook/student-chat
Authorization: Bearer <STUDENT_JWT>
Content-Type: application/json
```

```json
{
  "studentId": "STUDENT_ID",
  "courseId": "PRO192",
  "classId": "SE1840",
  "conversationId": "optional-conversation-id",
  "question": "Giải thích tính đóng gói trong OOP",
  "suggestionText": ""
}
```

n8n phân loại và trả một trong các mode:

- `RAG`: trả lời dựa trên tài liệu môn học.
- `CODE`: chuyển sang Code Mentor AI.
- `ESCALATE`: tạo yêu cầu hỗ trợ con người.

FE phải giữ lại các ID được trả về, đặc biệt `conversationId` và `questionEscalationId`.

## 5. Student review câu trả lời AI — Flow 2

### Gửi review

```http
POST /webhook/answer-review
Authorization: Bearer <STUDENT_JWT>
Content-Type: application/json
```

```json
{
  "studentId": "STUDENT_ID",
  "courseId": "PRO192",
  "classId": "SE1840",
  "conversationId": "CONVERSATION_ID",
  "questionEscalationId": "optional-escalation-id",
  "mode": "RAG",
  "reviewType": "ANSWER_DISPUTE",
  "question": "Câu hỏi của student",
  "answer": "Câu trả lời của AI",
  "aiConfidence": 0.62,
  "rating": 1,
  "accurate": false,
  "helpful": false,
  "correctnessLevel": "INCORRECT",
  "feedback": "AI giải thích sai khái niệm",
  "suggestedCorrection": "",
  "reviewedBy": "STUDENT_ID",
  "reviewerRole": "STUDENT"
}
```

### Review type

| `reviewType` | Khi dùng | Có thể trở thành AI knowledge? |
|---|---|---:|
| `QUALITY_FEEDBACK` | Feedback chung | Không |
| `ANSWER_DISPUTE` | Student cho rằng answer sai | Có, sau human correction |
| `SOURCE_CONFLICT` | Answer trái nguồn/tài liệu | Có |
| `MISSING_MATERIAL` | Thiếu tài liệu để trả lời | Có |
| `OPERATIONAL_POLICY`, `GRADING_DECISION`, `CLASS_RULE`, `ASSIGNMENT_SPECIFIC` | Quy định vận hành/lớp | Không |

### Trạng thái review

| Status | Ý nghĩa | UI |
|---|---|---|
| `SUBMITTED` | Feedback được lưu, không cần human review | “Đã ghi nhận” |
| `NEEDS_MENTOR_REVIEW` | Cần teacher/mentor xem | “Đang chờ mentor” |
| `NEEDS_SENIOR_REVIEW` | Sai nghiêm trọng, sai nguồn hoặc rating rất thấp | “Đang chờ senior mentor” |
| `RESOLVED` | Human reviewer đã xử lý | Hiển thị kết quả đã xử lý |

Lưu ý: các node `Respond Sent To Mentor/Senior` chỉ trả status về FE. Chúng không tự gửi notification. FE phải xây inbox bằng các API pending bên dưới.

## 6. Mentor và Senior review inbox

### Mentor inbox

```http
GET /api/tutor/answer-reviews/mentor-pending?courseId=PRO192
Authorization: Bearer <TEACHER_JWT>
```

### Senior inbox

```http
GET /api/tutor/answer-reviews/senior-pending?courseId=PRO192
Authorization: Bearer <SENIOR_MENTOR_JWT>
```

Mỗi item nên hiển thị:

- Student, course và class.
- Câu hỏi.
- Câu trả lời AI.
- Rating, accurate/helpful.
- Feedback và suggested correction.
- Review type, status và thời gian tạo.

## 7. Teacher trả lời escalation và tạo candidate — Flow 3A

Teacher mở escalation, nhập câu trả lời gửi cho student và chọn có đề xuất kiến thức cho AI hay không.

```http
POST /webhook/teacher-answer-escalation
Authorization: Bearer <TEACHER_JWT>
Content-Type: application/json
```

```json
{
  "questionEscalationId": "ESCALATION_ID",
  "teacherId": "TEACHER_ID",
  "teacherName": "Teacher A",
  "answer": "Câu trả lời đã được teacher kiểm tra",
  "createKnowledgeCandidate": true,
  "candidateType": "ACADEMIC_KNOWLEDGE"
}
```

Nếu `createKnowledgeCandidate=false`, answer chỉ gửi cho student. Nếu `true`, backend tạo candidate `PENDING_SENIOR_REVIEW` và trả `candidateId`.

Candidate type hợp lệ:

- `ACADEMIC_KNOWLEDGE`
- `MATERIAL_CORRECTION`
- `FAQ_CLARIFICATION`

## 8. Senior xử lý review nghiêm trọng — Flow 3B

Senior nhập câu trả lời đúng cho review `NEEDS_SENIOR_REVIEW`:

```http
POST /webhook/senior-resolve-answer-review
Authorization: Bearer <SENIOR_MENTOR_JWT>
Content-Type: application/json
```

```json
{
  "reviewId": "REVIEW_ID",
  "seniorReviewerId": "SENIOR_ID",
  "seniorReviewerName": "Senior Mentor A",
  "reviewerRole": "SENIOR_MENTOR",
  "decision": "CREATE_KNOWLEDGE_CANDIDATE",
  "notes": "Đã kiểm tra và sửa answer",
  "createKnowledgeCandidate": true,
  "candidateType": "ACADEMIC_KNOWLEDGE",
  "correctedAnswer": "Nội dung chính xác đã được kiểm tra"
}
```

Response thành công có:

```json
{
  "ok": true,
  "status": "RESOLVED",
  "reviewId": "REVIEW_ID",
  "candidateId": "CANDIDATE_ID",
  "candidateStatus": "PENDING_SENIOR_REVIEW",
  "nextStep": "SEND_TO_FLOW_3"
}
```

Tên `nextStep` trong response là tên kỹ thuật cũ; về nghiệp vụ candidate tiếp tục sang bước approval/index RAG.

## 9. Knowledge candidate approval — Flow 4

### Lấy hàng chờ

```http
GET /api/tutor/knowledge-candidates/senior-pending?courseId=PRO192
Authorization: Bearer <SENIOR_MENTOR_JWT>
```

### Approve

```http
POST /webhook/senior-knowledge-approval
Authorization: Bearer <SENIOR_MENTOR_JWT>
Content-Type: application/json
```

```json
{
  "candidateId": "CANDIDATE_ID",
  "decision": "APPROVE",
  "reviewerId": "SENIOR_ID",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewerName": "Senior Mentor A",
  "reviewNote": "Kiến thức chính xác"
}
```

### Reject

```json
{
  "candidateId": "CANDIDATE_ID",
  "decision": "REJECT",
  "reviewerId": "SENIOR_ID",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewerName": "Senior Mentor A",
  "reviewNote": "Nội dung chưa đủ căn cứ",
  "rejectionReason": "Thiếu nguồn học liệu xác nhận"
}
```

Trạng thái:

- `PENDING_SENIOR_REVIEW`: chờ duyệt.
- `INDEXED`: đã approve và index vào RAG/AI brain.
- `REJECTED`: bị từ chối, không vào RAG.

Candidate do teacher tạo không được chính teacher đó approve. Code backend hiện cũng chặn cùng ID tạo và approve candidate; nếu nghiệp vụ muốn senior tự approve candidate từ `AI_ANSWER_REVIEW`, backend cần điều chỉnh riêng.

## 10. Chat Student — Mentor

Chat hỗ trợ WebSocket realtime; REST được giữ để tải history, unread, detail, mark-read và làm fallback khi mất kết nối.

Kết nối:

```text
ws://localhost:8085/ws/chat?chatRoomId={ROOM_ID}&token={JWT}
```

Production dùng `wss://`. Backend từ chối handshake nếu JWT không thuộc student/teacher của room.

### Gửi tin nhắn

```http
POST /api/chat/send
```

Student:

```json
{
  "chatRoomId": "ROOM_ID",
  "senderId": "STUDENT_ID",
  "senderName": "Student A",
  "senderRole": "STUDENT",
  "content": "Em chưa hiểu phần này",
  "messageType": "TEXT"
}
```

Teacher:

```json
{
  "chatRoomId": "ROOM_ID",
  "senderId": "TEACHER_ID",
  "senderName": "Teacher A",
  "senderRole": "MENTOR",
  "content": "Thầy giải thích lại như sau",
  "messageType": "TEXT"
}
```

Các API UI cần dùng:

```http
GET  /api/chat/history?chatRoomId={id}&page=0&size=50
GET  /api/chat/detail?chatRoomId={id}
GET  /api/chat/unread
POST /api/chat/mark-read
POST /api/chat/close
```

FE ưu tiên WebSocket để nhận `NEW_MESSAGE`. Khi reconnect, gọi history để đồng bộ message bị bỏ lỡ; nếu WebSocket không kết nối được mới polling mỗi 3–5 giây.

WebSocket payload gửi:

```json
{
  "type": "SEND_MESSAGE",
  "senderName": "Student A",
  "content": "Em chưa hiểu phần này",
  "messageType": "TEXT"
}
```

Không gửi `senderId`, `senderRole` hay `chatRoomId` trong WebSocket payload. Backend lấy các giá trị này từ JWT và handshake session.

## 11. Quiz

### Tạo quiz chung qua n8n

```http
POST /webhook/quiz-generate
Authorization: Bearer <JWT>
```

Student tự ôn:

```json
{
  "studentId": "STUDENT_ID",
  "courseId": "PRO192",
  "classId": "SE1840",
  "topic": "Java OOP",
  "suggestionText": "Ôn lại tính kế thừa",
  "questionCount": 5
}
```

Teacher tạo draft:

```json
{
  "teacherId": "TEACHER_ID",
  "courseId": "PRO192",
  "classId": "SE1840",
  "title": "Quiz OOP tuần 3",
  "topic": "Java OOP",
  "suggestionText": "Tập trung inheritance và polymorphism",
  "questionCount": 5
}
```

Nếu body có `teacherId`, n8n route sang teacher assignment; nếu không thì route student practice.

Model OpenRouter miễn phí có thể mất 2–3 phút. FE cần:

- Disable nút Create trong lúc chờ.
- Hiển thị loading “AI đang tạo quiz”.
- Không tự retry liên tục.
- Timeout phía FE tối thiểu 180 giây.
- Cho phép teacher chỉnh draft trước khi publish.

### Teacher quiz APIs

```http
POST   /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate
GET    /api/tutor/teachers/{teacherId}/quiz-assignments
GET    /api/tutor/teachers/{teacherId}/quiz-attempts?reviewStatus=PENDING&page=0&size=20
PUT    /api/tutor/quiz-assignments/{assignmentId}
DELETE /api/tutor/quiz-assignments/{assignmentId}
POST   /api/tutor/quiz-assignments/{assignmentId}/publish
```

### Student assignment APIs

```http
GET  /api/tutor/students/{studentId}/courses/{courseId}/quiz-assignments
POST /api/tutor/quiz-assignments/{assignmentId}/attempts
POST /webhook/quiz-submit
GET  /api/tutor/quizzes/{quizSessionId}
```

Quiz tự luyện trả điểm ngay. Quiz được teacher giao có thể ở trạng thái chờ teacher review tùy cấu hình assignment.

Quiz được giao sau khi nộp luôn có `teacherReviewStatus=PENDING`. Màn Teacher Review dùng API `quiz-attempts`, hiển thị `autoScore` và gọi:

```http
PUT /api/tutor/quizzes/{quizSessionId}/teacher-review
```

Sau review, UI dùng `finalScore` và `finalPercentage` từ danh sách attempts; backend không cho teacher khác review bài không thuộc mình.

## 12. Admin đổi cấp teacher

```http
PATCH /api/admin/teachers/{teacherId}/role
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

Nâng cấp:

```json
{ "role": "SENIOR_MENTOR" }
```

Hạ cấp:

```json
{ "role": "TEACHER" }
```

UI admin nên hiển thị nút `Promote to Senior` hoặc `Change to Teacher`, sau đó nhắc tài khoản đăng nhập lại.

## 13. Màn hình FE tối thiểu

### Student

1. AI Tutor chat.
2. Review answer modal.
3. Trạng thái escalation/human review.
4. Mentor chat room.
5. Quiz tự luyện.
6. Quiz được giao và lịch sử điểm.

### Teacher

1. Mentor pending inbox.
2. Escalation detail và answer editor.
3. Student chat rooms.
4. AI quiz draft generator/editor.
5. Quiz assignment list, publish và review submission.

### Senior Mentor

1. Toàn bộ màn hình Teacher.
2. Senior review pending inbox.
3. Corrected answer editor và Create Candidate.
4. Knowledge candidate approval queue.

### Admin

1. Teacher/mentor management.
2. Promote/demote `TEACHER ↔ SENIOR_MENTOR`.
3. Candidate approval dự phòng.

## 14. Quy tắc UI quan trọng

- Không đưa feedback thô của student trực tiếp vào RAG.
- Chỉ candidate có status `INDEXED` mới nằm trong AI brain.
- Luôn giữ `reviewId`, `questionEscalationId`, `candidateId`, `chatRoomId`, `quizSessionId` từ response.
- Không tin role trong body để phân quyền giao diện; role thật lấy từ login/JWT.
- Khi API trả `401/403`, yêu cầu đăng nhập lại, đặc biệt sau khi admin đổi role.
- Khi AI generate lâu, không gửi request lặp do double click.
- Hiển thị trạng thái nghiệp vụ bằng tiếng Việt nhưng giữ nguyên enum khi gửi backend.

## 15. Workflow education tổng thể

```text
Student hỏi AI
  → RAG/CODE trả lời
  → Student review
      → SUBMITTED: kết thúc
      → NEEDS_MENTOR_REVIEW: teacher sửa/trả lời
      → NEEDS_SENIOR_REVIEW: senior sửa/trả lời
          → tạo KnowledgeCandidate
          → PENDING_SENIOR_REVIEW
          → Senior/Admin APPROVE
          → INDEXED vào RAG/AI brain

Teacher tạo quiz bằng AI
  → DRAFT
  → Teacher chỉnh sửa
  → PUBLISH
  → Student làm bài
  → chấm điểm hoặc chờ teacher review
```
