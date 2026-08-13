# Đặc tả Frontend Education — AI Tutor

Tài liệu này là nguồn bàn giao chính cho nhóm Frontend xây dựng website và mobile app. FE được tự chọn framework; chỉ cần tuân thủ nghiệp vụ, quyền truy cập, API contract và state transition trong tài liệu này.

## 1. Mô hình hệ thống

```text
Web/Mobile FE
  ├─ REST API ───────────────> Spring Boot Backend
  ├─ AI workflow webhook ────> n8n ──> Spring Boot Backend
  └─ Realtime mentor chat ───> Backend WebSocket /ws/chat
```

- Backend lưu user, course, class, tài liệu, conversation, quiz, điểm, feedback và knowledge candidate.
- n8n chỉ điều phối các luồng AI: chat routing, answer review, mentor/senior workflow và quiz AI.
- MongoDB là dữ liệu nghiệp vụ; Elasticsearch là RAG/vector index.
- FE không gọi trực tiếp OpenRouter, Ollama, MongoDB hoặc Elasticsearch.

## 2. Base URL và bảo mật

Biến môi trường FE:

```env
API_BASE_URL=http://localhost:8085
N8N_BASE_URL=http://localhost:5678
WS_BASE_URL=ws://localhost:8085
```

Production dùng HTTPS/WSS:

```env
API_BASE_URL=https://api-domain
N8N_BASE_URL=https://n8n-domain
WS_BASE_URL=wss://api-domain
```

Request JSON phải dùng:

```http
Content-Type: application/json; charset=utf-8
Authorization: Bearer <JWT>
```

Quy tắc:

- JWT chỉ lưu trong secure storage phù hợp nền tảng; không ghi token vào source/log.
- Không đưa OpenRouter key, JWT secret hoặc Swagger password vào FE.
- FE ưu tiên gửi JWT bằng header. Với webhook n8n hiện tại, gửi thêm `authToken` trong body để workflow gọi backend.
- Tiếng Việt có dấu và không dấu đều hợp lệ. Không encode/decode chuỗi qua Latin-1/Windows-1252.
- Nếu thấy `Ã`, `Ä`, `Â`, `�`, dữ liệu đã bị mojibake; không tự thay ký tự trên UI.

## 3. Role và điều hướng

| Role tài khoản | Ý nghĩa | Trang mặc định |
|---|---|---|
| `STUDENT` | Học sinh | Student Dashboard |
| `TEACHER` | Giáo viên/mentor thông thường | Teacher Dashboard |
| `SENIOR_MENTOR` | Giáo viên cao cấp | Senior Dashboard |
| `ADMIN` | Quản trị viên | Admin Dashboard |

Không có role tài khoản `USER` hoặc `MENTOR`. Trong dữ liệu tin nhắn, `MENTOR` chỉ là nhãn người gửi dành cho tài khoản `TEACHER`/`SENIOR_MENTOR`.

Sau khi admin đổi role, user phải đăng nhập lại để JWT chứa role mới.

## 4. Danh sách màn hình đề xuất

### Student web/mobile

1. Đăng nhập và hồ sơ.
2. Dashboard học tập.
3. Danh sách course/class đã enroll.
4. AI Tutor chat theo từng course.
5. Conversation history, search và pinned messages.
6. Form review câu trả lời AI.
7. Trạng thái câu hỏi đã chuyển mentor.
8. Mentor chat realtime.
9. Quiz tự ôn và kết quả.
10. Quiz assignment được teacher giao.
11. Learning memory và improve suggestions.

### Teacher web/tablet

1. Teacher Dashboard.
2. Danh sách course/class/student.
3. Feedback inbox cần mentor review.
4. Escalation inbox.
5. Chi tiết câu hỏi, AI answer và student feedback.
6. Trả lời student; tùy chọn tạo knowledge candidate.
7. Mentor chat realtime.
8. Upload/quản lý/reindex tài liệu course.
9. Tạo draft quiz bằng AI.
10. Sửa, xóa và publish quiz assignment.
11. Quiz attempts và teacher review điểm cuối.
12. Assignment/submission/review.

### Senior Mentor

Có toàn bộ màn hình Teacher, cộng thêm:

1. Feedback inbox mức nghiêm trọng.
2. Resolve answer review và nhập corrected answer.
3. Knowledge candidate approval queue.
4. Approve hoặc reject kiến thức trước khi vào RAG Brain.

### Admin

1. Dashboard thống kê.
2. Quản lý user/teacher.
3. Đổi role `TEACHER` ↔ `SENIOR_MENTOR`.
4. Quản lý semester/course/class/enrollment.
5. Import student/teacher.
6. Theo dõi escalation, harness log và lỗi workflow.

## 5. Authentication

### Đăng nhập

```http
POST /api/users/login
```

```json
{
  "email": "student@example.com",
  "password": "password"
}
```

Response quan trọng:

```json
{
  "userId": "USER_ID",
  "email": "student@example.com",
  "fullName": "Student Demo",
  "role": "STUDENT",
  "token": "JWT"
}
```

FE lưu `userId`, `role`, `fullName`, `avatarUrl` và `token`. Route guard phải kiểm tra role.

### HTTP error chung

| HTTP | FE xử lý |
|---:|---|
| `400` | Hiện validation từ `message` hoặc `error` |
| `401` | Xóa session và chuyển về login |
| `403` | Hiện không có quyền; không retry |
| `404` | Hiện dữ liệu không tồn tại/đã bị xóa |
| `409` | Refresh dữ liệu; thao tác đã trùng hoặc state đã đổi |
| `429` | AI hết quota/rate limit; cho retry thủ công sau |
| `500/502/503` | Hiện lỗi dịch vụ; không retry vô hạn |

## 6. Student AI Tutor — Flow 1

```http
POST {N8N_BASE_URL}/webhook/student-chat
```

```json
{
  "traceId": "trace-uuid",
  "sessionId": "session-uuid",
  "conversationId": "optional-conversation-id",
  "studentId": "STUDENT_ID",
  "studentName": "Student Demo",
  "studentEmail": "student@example.com",
  "courseId": "PRJ301",
  "classId": "SE1840",
  "message": "JSP là gì và hoạt động như thế nào?",
  "codeSnippet": "",
  "authToken": "JWT"
}
```

Các mode response:

| Mode | Ý nghĩa | UI |
|---|---|---|
| `RAG_TUTOR` | Trả lời theo tài liệu course | Answer + sources + confidence |
| `CODE` | Code Mentor phân tích code/lỗi | Code answer component |
| `ESCALATE` | Không đủ dữ liệu hoặc cần con người | Trạng thái chờ mentor |

Response mẫu:

```json
{
  "success": true,
  "mode": "RAG_TUTOR",
  "answer": "Nội dung trả lời",
  "confidence": 0.82,
  "escalated": false,
  "questionEscalationId": null,
  "conversationId": "CONVERSATION_ID",
  "traceId": "trace-uuid",
  "sources": []
}
```

FE phải lưu `conversationId`, `questionEscalationId`, question, answer, mode, confidence và sources để dùng khi review.

Backend giới hạn tối đa 10 lượt hỏi của student trong một conversation. Khi đạt giới hạn, FE hiển thị New Chat hoặc Branch Here; không tự đếm thay backend.

## 7. Student review AI answer — Flow 2

```http
POST {N8N_BASE_URL}/webhook/answer-review
```

```json
{
  "traceId": "trace-uuid",
  "conversationId": "CONVERSATION_ID",
  "studentId": "STUDENT_ID",
  "courseId": "PRJ301",
  "classId": "SE1840",
  "mode": "RAG_TUTOR",
  "reviewType": "ANSWER_DISPUTE",
  "question": "Câu hỏi của student",
  "answer": "Câu trả lời của AI",
  "aiConfidence": 0.62,
  "rating": 1,
  "accurate": false,
  "helpful": false,
  "correctnessLevel": "INCORRECT",
  "feedback": "AI giải thích sai kiến thức",
  "suggestedCorrection": "",
  "reviewedBy": "STUDENT_ID",
  "reviewerRole": "STUDENT",
  "authToken": "JWT"
}
```

| Status | Ý nghĩa | UI student | Inbox |
|---|---|---|---|
| `SUBMITTED` | Ghi nhận feedback (kể cả 1 SV báo sai — chưa đủ đồng thuận) | Đã ghi nhận | Không bắt buộc review |
| `NEEDS_MENTOR_REVIEW` | Đủ ≥ `app.answer-review.negative-student-threshold` (mặc định 2) học sinh khác nhau báo cùng câu trả lời AI sai | Đang chờ mentor | Teacher |
| `NEEDS_SENIOR_REVIEW` | Báo lỗi nguồn/tài liệu (`SOURCE_CONFLICT`, …) — leo thang ngay; hoặc đủ ngưỡng crowd với dispute nghiêm trọng | Đang chờ senior | Senior/Admin |
| `RESOLVED` | Human đã xử lý | Đã có kết quả | Lịch sử |

Gom nhóm theo `answerFingerprint` (hash `courseId + question + answer`).

| Mức | Sao (mặc định) | Hàng đợi khi đủ ngưỡng crowd |
|---|---|---|
| **MODERATE** | 2–3 | `NEEDS_MENTOR_REVIEW` → Teacher (`GET .../mentor-pending` trả thêm `groups[]`) |
| **SEVERE** | 1 | `NEEDS_SENIOR_REVIEW` → Senior (`GET .../senior-pending` trả thêm `groups[]`) |
| **IMMEDIATE** | `SOURCE_CONFLICT`, … | Senior ngay, không chờ crowd |

Ngưỡng mặc định: `app.answer-review.moderate-student-threshold` và `severe-student-threshold` (= 2; demo có thể đặt 5). Một học sinh chỉ lưu `SUBMITTED` cho đến khi đủ số học sinh **khác nhau** cùng tier trên cùng câu trả lời AI.

Flow 2 không tự đưa feedback vào RAG. Nó chỉ tạo review để dashboard đúng role hiển thị.

## 8. Teacher/Senior review inbox

```http
GET /api/tutor/answer-reviews/mentor-pending?courseId=PRJ301
GET /api/tutor/answer-reviews/senior-pending?courseId=PRJ301
GET /api/tutor/answer-reviews?status=RESOLVED&courseId=PRJ301
```

Response mentor/senior pending:

```json
{
  "count": 4,
  "groupCount": 1,
  "groups": [
    {
      "answerFingerprint": "...",
      "question": "JSP là gì?",
      "answer": "...",
      "queueStatus": "NEEDS_MENTOR_REVIEW",
      "escalationTier": "MODERATE",
      "distinctStudentCount": 4,
      "reviewCount": 4,
      "averageRating": 2.5,
      "representativeReviewId": "uuid-for-flow-3",
      "reviews": [
        { "reviewId": "...", "studentId": "...", "rating": 3, "feedback": "..." }
      ]
    }
  ],
  "reviews": [ "... flat legacy items ..." ]
}
```

Web dashboard nên render **`groups[]`** (1 card = 1 câu trả lời AI bị phản hồi), không list từng học sinh rời.

Card/list item cần hiện:

- student, course, class, thời gian;
- original question và AI answer;
- mode/confidence/source;
- rating, accurate, helpful, correctnessLevel;
- feedback và suggestedCorrection;
- reviewType và status.

## 9. Teacher trả lời escalation — Flow 3A

```http
POST {N8N_BASE_URL}/webhook/teacher-answer-escalation
```

```json
{
  "traceId": "trace-uuid",
  "conversationId": "CONVERSATION_ID",
  "questionEscalationId": "ESCALATION_ID",
  "teacherId": "TEACHER_ID",
  "teacherName": "Teacher Demo",
  "answer": "Câu trả lời đã được teacher kiểm tra",
  "createKnowledgeCandidate": true,
  "candidateType": "ACADEMIC_KNOWLEDGE",
  "authToken": "JWT"
}
```

- `createKnowledgeCandidate=false`: chỉ gửi answer cho student.
- `true`: đồng thời tạo candidate `PENDING_SENIOR_REVIEW`.
- Không phải mọi câu trả lời teacher đều nên dạy AI.

## 10. Senior resolve review — Flow 3B

```http
POST {N8N_BASE_URL}/webhook/senior-resolve-answer-review
```

```json
{
  "reviewId": "REVIEW_ID",
  "seniorReviewerId": "SENIOR_ID",
  "seniorReviewerName": "Senior Demo",
  "reviewerRole": "SENIOR_MENTOR",
  "decision": "CREATE_KNOWLEDGE_CANDIDATE",
  "notes": "Đã xác minh theo tài liệu",
  "correctedAnswer": "Nội dung chính xác",
  "createKnowledgeCandidate": true,
  "candidateType": "ACADEMIC_KNOWLEDGE",
  "authToken": "JWT"
}
```

FE chỉ hiện nút này cho `SENIOR_MENTOR`/`ADMIN`.

## 11. Knowledge approval — Flow 4

Hàng chờ:

```http
GET /api/tutor/knowledge-candidates/senior-pending?courseId=PRJ301
```

Approve/reject:

```http
POST {N8N_BASE_URL}/webhook/senior-knowledge-approval
```

```json
{
  "candidateId": "CANDIDATE_ID",
  "decision": "APPROVE",
  "reviewerId": "SENIOR_ID",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewerName": "Senior Demo",
  "reviewNote": "Đúng với giáo trình",
  "rejectionReason": "Bắt buộc khi REJECT",
  "authToken": "JWT"
}
```

Chỉ candidate approve và index thành công mới vào RAG Brain. UI không được hiển thị “AI đã học” khi candidate vẫn pending hoặc bị reject.

## 12. Student–mentor chat realtime

REST:

```text
POST /api/chat/send
GET  /api/chat/history
GET  /api/chat/detail
POST /api/chat/mark-read
GET  /api/chat/unread
POST /api/chat/close
```

WebSocket:

```text
{WS_BASE_URL}/ws/chat?token={JWT}&chatRoomId={CHAT_ROOM_ID}
```

Client gửi:

```json
{
  "type": "SEND_MESSAGE",
  "senderName": "Student Demo",
  "content": "Em cần mentor giải thích thêm phần này.",
  "messageType": "TEXT"
}
```

Server event: `CONNECTED`, `NEW_MESSAGE`, `PONG`, `ERROR`.

Sau reconnect, FE phải gọi REST history để lấy message có thể bị bỏ lỡ. Khi room `CLOSED`, disable ô gửi tin nhắn.

## 13. Quiz education workflow

### Student tạo quiz tự ôn

```http
POST {N8N_BASE_URL}/webhook/quiz-generate
```

```json
{
  "traceId": "trace-uuid",
  "studentId": "STUDENT_ID",
  "courseId": "PRJ301",
  "classId": "SE1840",
  "topic": "Spring Boot cơ bản",
  "suggestionText": "Ôn tập kiến thức Spring Boot",
  "questionCount": 3,
  "authToken": "JWT"
}
```

Response thành công: `status=GENERATED`, có `quizSessionId`.

Lấy quiz:

```http
GET /api/tutor/quizzes/{quizSessionId}
```

Không hiển thị `correctAnswer` trước khi nộp.

### Submit quiz

```http
POST {N8N_BASE_URL}/webhook/quiz-submit
```

```json
{
  "traceId": "trace-uuid",
  "quizSessionId": "QUIZ_SESSION_ID",
  "studentId": "STUDENT_ID",
  "courseId": "PRJ301",
  "classId": "SE1840",
  "answers": [
    {
      "questionId": "QUESTION_ID",
      "selectedAnswer": "Đúng"
    }
  ],
  "authToken": "JWT"
}
```

Không tự chuyển `selectedAnswer` sang ASCII. Phải giữ đúng chuỗi option FE nhận từ API.

Response self-practice: `SUBMITTED`. Assignment: `SUBMITTED_WAITING_TEACHER_REVIEW`.

### Teacher tạo và quản lý quiz

Teacher gọi cùng webhook `quiz-generate` nhưng gửi `teacherId`, `title`, course/class/topic. Response là `DRAFT_CREATED`.

```text
PUT    /api/tutor/quiz-assignments/{assignmentId}
DELETE /api/tutor/quiz-assignments/{assignmentId}
POST   /api/tutor/quiz-assignments/{assignmentId}/publish
GET    /api/tutor/teachers/{teacherId}/quiz-assignments
GET    /api/tutor/teachers/{teacherId}/quiz-attempts
PUT    /api/tutor/quizzes/{quizSessionId}/teacher-review
```

Backend lưu điểm auto-grade và điểm cuối teacher review. FE không tự tính điểm cuối.

## 14. Course, class và materials

Các nhóm API chính:

```text
GET/POST/PUT/DELETE /api/admin/semesters/**
GET/POST/PUT/DELETE /api/admin/courses/**
GET/POST/PUT/DELETE /api/admin/class-sections/**
GET /api/students/{studentId}/courses
GET /api/teachers/{teacherId}/classes
```

Materials:

```text
POST   /api/courses/{courseId}/materials
GET    /api/courses/{courseId}/materials
GET    /api/courses/{courseId}/materials/{materialId}
GET    /api/courses/{courseId}/materials/{materialId}/pdf
PUT    /api/courses/{courseId}/materials/{materialId}
DELETE /api/courses/{courseId}/materials/{materialId}
POST   /api/courses/{courseId}/materials/{materialId}/reindex
POST   /api/courses/{courseId}/materials/reindex
```

UI cần hiện trạng thái upload/index. Chỉ báo “sẵn sàng cho AI” khi material đã `INDEXED`.

## 15. Dashboard và learning data

```text
GET /api/students/{studentId}/dashboard
GET /api/teachers/{teacherId}/dashboard
GET /api/admin/dashboard/stats
GET /api/tutor/students/{studentId}/courses/{courseId}/memory
GET /api/students/{studentId}/improve-plans
GET /api/students/{studentId}/courses/{courseId}/improve-plan
```

Dashboard nên có loading skeleton, empty state, error state và pull-to-refresh trên mobile.

## 16. State FE nên lưu

Các ID nghiệp vụ:

```text
userId
courseId
classId
conversationId
questionEscalationId
reviewId
chatRoomId
candidateId
quizSessionId
assignmentId
traceId
```

Không dùng array index làm ID. Khi response trả ID mới, FE phải cập nhật state từ response backend/n8n.

## 17. Loading, retry và chống thao tác trùng

- Disable nút khi request đang chạy.
- Mỗi submit tạo `traceId` mới; double-click không dùng lại hai request khác nhau.
- AI chat/quiz có thể chậm 30–180 giây; hiển thị progress thay vì timeout UI quá ngắn.
- Cho phép cancel UI bằng AbortController/cơ chế tương đương, nhưng hiểu rằng backend có thể vẫn hoàn tất request.
- Không auto-retry chat hoặc quiz generate nhiều lần vì tiêu tốn quota.
- GET có thể retry có backoff; mutation chỉ retry khi user xác nhận.

## 18. Responsive website và mobile

### Website

- Desktop: sidebar course/conversation + content + inspector/context panel.
- Teacher/Senior: ưu tiên table, filter, pagination và split-view detail.
- Mobile web: sidebar chuyển thành drawer; table chuyển card list.

### Mobile app

- Bottom navigation theo role.
- Chat và quiz tối ưu thao tác một tay.
- Giữ draft feedback/mentor answer cục bộ khi app background.
- WebSocket reconnect có backoff; refetch history sau reconnect.
- Không cache JWT hoặc student data trong log/crash report.

## 19. Acceptance checklist cho FE

- [ ] Route và menu đúng role; không có role `USER`/`MENTOR`.
- [ ] Login, refresh session và logout khi 401.
- [ ] JSON gửi UTF-8; quiz option tiếng Việt giữ nguyên.
- [ ] Student chat xử lý đủ `RAG_TUTOR`, `CODE`, `ESCALATE`.
- [ ] Giữ conversation/escalation/review/candidate/quiz IDs.
- [ ] Review status xuất hiện đúng dashboard teacher/senior.
- [ ] Teacher answer có lựa chọn tạo candidate hoặc chỉ trả lời student.
- [ ] Candidate pending không được hiển thị là AI đã học.
- [ ] Senior approve/reject có confirm dialog.
- [ ] Quiz không lộ correct answer trước submit.
- [ ] Teacher review điểm cuối lấy từ backend.
- [ ] Mentor chat kiểm tra room/JWT và reconnect an toàn.
- [ ] Có loading, empty, error và retry state.
- [ ] Không chứa secret hoặc dữ liệu sinh viên thật trong source/demo.

## 20. Dữ liệu demo

Dùng dữ liệu tổng hợp trong:

```text
demo-data/education-demo-data.json
```

Không dùng email, bài làm, điểm hoặc nội dung chat của sinh viên thật trong screenshot/demo public.

Swagger chỉ dùng để đối chiếu schema trong môi trường nội bộ và được bảo vệ bằng HTTP Basic. FE không gọi Swagger trong runtime.
