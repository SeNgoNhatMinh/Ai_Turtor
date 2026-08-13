# Backend API Handoff Cho Frontend

Cập nhật sau smoke test local. Backend đang chạy tại `http://localhost:8085`, n8n tại `http://localhost:5678`.


## JWT & Role Authorization Update

Backend hiện dùng JWT Bearer token.

1. FE gọi `POST /api/users/login` hoặc `POST /api/users/register`.
2. Response có field `token`.
3. Các API nghiệp vụ sau đó phải gửi header:

```http
Authorization: Bearer <token>
```

Swagger: mở Swagger UI, bấm `Authorize`, dán token theo dạng `Bearer <token>`.

Role chính:

| Role | Dùng cho |
|---|---|
| `STUDENT` | chat AI, code mentor, memory của sinh viên, dashboard sinh viên, quiz tự ôn, submit bài |
| `TEACHER` | upload tài liệu lớp/môn, quản lý bài tập/quiz, trả lời escalation, review bài/quiz |
| `ADMIN` | quản lý user, mentor, kỳ học, môn học, lớp học, enrollment, system logs |

n8n cần thay đổi: các HTTP Request node gọi backend nghiệp vụ phải forward header `Authorization` từ FE webhook input sang backend. Riêng `POST /api/harness/logs` và `POST /api/harness/error-logs` vẫn public để trace không bị chết khi token hết hạn.
## 1. Kết Quả Test Nhanh

| Test | Endpoint | Status | Kết quả | Ghi chú |
|---|---|---:|---|---|
| OpenAPI docs | GET /v3/api-docs | 200 | OK | Swagger JSON lên được |
| Swagger UI | GET /swagger-ui/index.html | 200 | OK | Swagger UI lên được |
| CORS login preflight | OPTIONS /api/users/login | 200 | OK | FE localhost:5173 được CORS |
| Admin login | POST /api/users/login | 200 | OK | Account admin mặc định login được |
| List semesters | GET /api/admin/semesters | 200 | OK | Admin semester list |
| List courses | GET /api/courses | 200 | OK | FE dropdown môn học |
| List PRO192 materials | GET /api/courses/PRO192/materials | 200 | OK | FE xem tài liệu môn |
| Get student memory | GET /api/tutor/students/SE1840001/courses/PRO192/memory | 200 | OK | Memory scoped theo student/course |
| Pin/unpin improve suggestion | POST + DELETE pinned-suggestions | 200 | OK | Ghim và bỏ ghim suggestion |
| Intent classify RAG | POST /api/tutor/intent-classify | 200 | OK | Nhận dạng câu hỏi lý thuyết |
| Intent classify CODE | POST /api/tutor/intent-classify | 200 | OK | Nhận dạng câu hỏi code |
| Improve suggestions | POST /api/tutor/improve-suggestions | 200 | OK | Sinh gợi ý cải thiện không gọi AI extra |
| Click suggestion learn | POST /api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn | 200 | OK | Click improve suggestion thành một lượt chat học tập |
| Duplicate suggestion click | POST suggestions/learn cùng prompt đã học | 409 | Expected | Backend chặn click lặp |
| Student dashboard | GET /api/students/SE1840001/dashboard | 200 | OK | FE dashboard học sinh |
| Teacher dashboard | GET /api/teachers/TEACHER_A/dashboard | 200 | OK | FE dashboard mentor |
| Harness log create | POST /api/harness/logs | 200 | OK | n8n trace log |
| Harness trace lookup | GET /api/harness/traces/trace-api-smoke | 200 | OK | FE/dev xem trace |
| Answer reviews list | GET /api/tutor/answer-reviews | 200 | OK | Review queue |
| Knowledge candidates pending | GET /api/tutor/knowledge-candidates/pending | 200 | OK | Senior approval queue |
| Escalation history | GET /api/tutor/escalations/history?userId=SE1840001 | 200 | OK | Lưu ý param là userId, không phải studentId |
| n8n health | GET http://localhost:5678/healthz | 200 | OK | n8n container sống |
| n8n active workflows | GET /rest/active-workflows | 401 | Expected | n8n REST cần auth; không phải lỗi workflow |

Không chạy destructive test cho `DELETE`, approve/reject thật, publish thật, upload file thật hoặc payment thật để tránh phá dữ liệu hiện có. Các API đó có trong catalog bên dưới và cần test bằng data riêng khi FE làm màn hình tương ứng.

## 2. Flow FE Nên Nắm

### Student AI Chat Qua n8n
FE gọi `POST http://localhost:5678/webhook/student-chat` khi workflow active. Trong n8n editor thì dùng `/webhook-test/student-chat`. Payload cần có `studentId`, `courseId`, `classId`, `conversationId`, `message`, optional `codeSnippet`, `traceId`, `sessionId`.

Flow: FE -> n8n Student Chat -> Get Memory -> Intent Classifier -> RAG/CODE/ESCALATE -> Update Memory -> Respond.

### Improve Suggestion Click-To-Learn
Sau khi AI trả lời và FE render improve suggestions, nút `Học ngay` gọi trực tiếp backend:

```http
POST /api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn
```

Body:

```json
{
  "classId": "SE1840",
  "conversationId": "conv-current-chat-id",
  "suggestionKey": "improve-oop",
  "suggestionText": "Ôn tập OOP",
  "topic": "OOP"
}
```

Backend lưu thành một lượt chat thật và trả `conversationId`, `userMessageId`, `assistantMessageId`, `suggestionConsumed=true`, `nextImproveSuggestions`. FE disable suggestion đã click. Nếu trả `409 SUGGESTION_ALREADY_USED`, hiển thị đã học gợi ý này rồi.

### Human Review Và AI Learning
FE gọi n8n `/webhook/answer-review`. Rating 5 là feedback tốt, rating 2-3 đi mentor, rating 0-1 hoặc dispute/source conflict đi senior. AI không tự học từ feedback; chỉ `KnowledgeCandidate` được senior/admin approve mới index vào Elasticsearch/RAG brain.

### Teacher Answer Và Senior Approval
Teacher trả lời escalation qua `/webhook/teacher-answer` hoặc backend `/api/tutor/escalations/{id}/answer`. Nếu tạo tri thức mới thì sinh `KnowledgeCandidate`. Senior duyệt qua `/webhook/senior-knowledge-approval` hoặc backend `/api/tutor/knowledge-candidates/{id}/approve`.

### Quiz
Quiz tự ôn và quiz giáo viên giao đều tạo từ tài liệu đã indexed. Student self practice dùng `/api/tutor/students/{studentId}/courses/{courseId}/quizzes/generate`. Teacher draft quiz dùng `/api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate`, sau đó mentor sửa/xóa/publish. Submit quiz dùng `/api/tutor/quizzes/{quizSessionId}/submit`; mentor review điểm bằng `/api/tutor/quizzes/{quizSessionId}/teacher-review`.

### Course Materials Và RAG
Admin upload tài liệu dùng chung môn học; mentor upload tài liệu cho lớp. RAG search theo `courseId`, có xét `classId` khi tài liệu thuộc lớp. Nếu Elasticsearch mới drop hoặc index thiếu, chạy reindex course/material trước khi test RAG/quiz.

## 3. n8n Webhook FE Gọi

| Flow | Test URL | Production URL | FE dùng khi nào |
|---|---|---|---|
| Student Chat | `http://localhost:5678/webhook-test/student-chat` | `http://localhost:5678/webhook/student-chat` | Hỏi AI Tutor, hỏi code, escalation tự động |
| Answer Review | `http://localhost:5678/webhook-test/answer-review` | `http://localhost:5678/webhook/answer-review` | Student đánh giá đúng/sai/hữu ích/góp ý |
| Teacher Answer | `http://localhost:5678/webhook-test/teacher-answer` | `http://localhost:5678/webhook/teacher-answer` | Mentor trả lời câu hỏi AI không chắc |
| Senior Approval | `http://localhost:5678/webhook-test/senior-knowledge-approval` | `http://localhost:5678/webhook/senior-knowledge-approval` | Senior approve/reject knowledge candidate |
| Quiz Generate | `http://localhost:5678/webhook-test/quiz-generate` | `http://localhost:5678/webhook/quiz-generate` | Nếu FE muốn đi qua n8n khi tạo quiz |
| Quiz Submit | `http://localhost:5678/webhook-test/quiz-submit` | `http://localhost:5678/webhook/quiz-submit` | Nếu FE muốn log/trace n8n khi student submit quiz |
| Teacher Quiz Review | `http://localhost:5678/webhook-test/teacher-quiz-review` | `http://localhost:5678/webhook/teacher-quiz-review` | Nếu FE muốn mentor review quiz qua n8n |

## 4. Backend API Catalog Từ Swagger

| Nhóm | Method | Path | Tác dụng | FE flow |
|---|---|---|---|---|
| Class Sections | POST | `/api/academic/class-sections` | Create or update a class section for one teacher | Admin lớp/enroll |
| Courses | GET | `/api/academic/courses` | List courses | Admin học kỳ/môn |
| Courses | POST | `/api/academic/courses` | Create or update a course | Admin học kỳ/môn |
| Courses | GET | `/api/academic/courses/{courseId}` | Get course detail | Admin học kỳ/môn |
| Courses | PUT | `/api/academic/courses/{courseId}` | Update a course | Admin học kỳ/môn |
| Courses | DELETE | `/api/academic/courses/{courseId}` | Delete a course when it has no class sections or enrollments | Admin học kỳ/môn |
| Class Sections | GET | `/api/academic/courses/{courseId}/class-sections` | List class sections by course | Admin lớp/enroll |
| Class Sections | GET | `/api/academic/courses/{courseId}/class-sections/{classId}` | Get class section detail | Admin lớp/enroll |
| Class Sections | PUT | `/api/academic/courses/{courseId}/class-sections/{classId}` | Update class section detail | Admin lớp/enroll |
| Class Sections | DELETE | `/api/academic/courses/{courseId}/class-sections/{classId}` | Delete a class section when no students are enrolled | Admin lớp/enroll |
| Class Sections | GET | `/api/academic/courses/{courseId}/class-sections/{classId}/students` | List students enrolled in a class section | Admin lớp/enroll |
| Class Sections | POST | `/api/academic/enrollments` | Create or update one student enrollment | Admin lớp/enroll |
| Class Sections | GET | `/api/academic/enrollments/{enrollmentId}` | Get one student enrollment | Admin lớp/enroll |
| Class Sections | PUT | `/api/academic/enrollments/{enrollmentId}` | Update one student enrollment | Admin lớp/enroll |
| Class Sections | DELETE | `/api/academic/enrollments/{enrollmentId}` | Delete one student enrollment | Admin lớp/enroll |
| Class Sections | GET | `/api/academic/mentors/{teacherId}/class-sections` | List class sections managed by one teacher or mentor | Admin lớp/enroll |
| Courses | GET | `/api/academic/mentors/{teacherId}/courses` | List courses taught by one teacher or mentor | Admin học kỳ/môn |
| Courses | GET | `/api/academic/semesters` | List semesters | Admin học kỳ/môn |
| Courses | POST | `/api/academic/semesters` | Create or update a semester | Admin học kỳ/môn |
| Courses | GET | `/api/academic/semesters/{semesterCode}` | Get semester detail | Admin học kỳ/môn |
| Courses | PUT | `/api/academic/semesters/{semesterCode}` | Update a semester | Admin học kỳ/môn |
| Courses | DELETE | `/api/academic/semesters/{semesterCode}` | Delete a semester when no course is attached | Admin học kỳ/môn |
| Class Sections | GET | `/api/academic/students/{studentId}/enrollments` | List courses and class sections enrolled by one student | Admin lớp/enroll |
| Class Sections | POST | `/api/admin/class-sections` | Create or update a class section for one teacher | Admin lớp/enroll |
| Class Sections | POST | `/api/admin/class-sections/{courseId}/{classId}/students` | Enroll multiple students into a class section from JSON | Admin lớp/enroll |
| Class Sections | DELETE | `/api/admin/class-sections/{courseId}/{classId}/students/{studentId}` | Remove one student from a class section | Admin lớp/enroll |
| Class Sections | POST | `/api/admin/class-sections/{courseId}/{classId}/students/import` | Import students into a class section from Excel .xlsx | Admin lớp/enroll |
| Class Sections | GET | `/api/admin/class-sections/students/import/template` | Get student enrollment Excel template specification | Admin lớp/enroll |
| Class Sections | GET | `/api/admin/class-sections/students/import/template.xlsx` | Download generated student enrollment Excel template | Admin lớp/enroll |
| Courses | GET | `/api/admin/courses` | List courses | Admin học kỳ/môn |
| Courses | POST | `/api/admin/courses` | Create or update a course | Admin học kỳ/môn |
| Courses | GET | `/api/admin/courses/{courseId}` | Get course detail | Admin học kỳ/môn |
| Courses | PUT | `/api/admin/courses/{courseId}` | Update a course | Admin học kỳ/môn |
| Courses | DELETE | `/api/admin/courses/{courseId}` | Delete a course when it has no class sections or enrollments | Admin học kỳ/môn |
| Class Sections | POST | `/api/admin/courses/{courseId}/class-sections` | Create or update a class section for one course | Admin lớp/enroll |
| Class Sections | GET | `/api/admin/courses/{courseId}/class-sections/{classId}` | Get class section detail | Admin lớp/enroll |
| Class Sections | PUT | `/api/admin/courses/{courseId}/class-sections/{classId}` | Update class section detail | Admin lớp/enroll |
| Class Sections | DELETE | `/api/admin/courses/{courseId}/class-sections/{classId}` | Delete a class section when no students are enrolled | Admin lớp/enroll |
| Courses | PATCH | `/api/admin/courses/{courseId}/class-sections/{classId}/complete` | Mark a class section and its enrollments as completed | Admin học kỳ/môn |
| Courses | PATCH | `/api/admin/courses/{courseId}/complete` | Mark a course, its class sections and enrollments as completed | Admin học kỳ/môn |
| admin-dashboard-controller | GET | `/api/admin/dashboard/stats` | getDashboardStats | API phụ/legacy |
| Class Sections | POST | `/api/admin/enrollments` | Create or update one student enrollment | Admin lớp/enroll |
| Class Sections | GET | `/api/admin/enrollments/{enrollmentId}` | Get one student enrollment | Admin lớp/enroll |
| Class Sections | PUT | `/api/admin/enrollments/{enrollmentId}` | Update one student enrollment | Admin lớp/enroll |
| Class Sections | DELETE | `/api/admin/enrollments/{enrollmentId}` | Delete one student enrollment | Admin lớp/enroll |
| admin-dashboard-controller | GET | `/api/admin/mentor-escalations` | listMentorEscalations | API phụ/legacy |
| admin-dashboard-controller | DELETE | `/api/admin/mentor-escalations/{escalationId}` | deleteMentorEscalation | API phụ/legacy |
| admin-dashboard-controller | GET | `/api/admin/mentors` | listMentors | API phụ/legacy |
| admin-dashboard-controller | PATCH | `/api/admin/mentors/{mentorId}` | updateMentor | API phụ/legacy |
| admin-dashboard-controller | DELETE | `/api/admin/mentors/{mentorId}` | deleteMentor | API phụ/legacy |
| Courses | GET | `/api/admin/semesters` | List semesters | Admin học kỳ/môn |
| Courses | POST | `/api/admin/semesters` | Create or update a semester | Admin học kỳ/môn |
| Courses | GET | `/api/admin/semesters/{semesterCode}` | Get semester detail | Admin học kỳ/môn |
| Courses | PUT | `/api/admin/semesters/{semesterCode}` | Update a semester | Admin học kỳ/môn |
| Courses | DELETE | `/api/admin/semesters/{semesterCode}` | Delete a semester when no course is attached | Admin học kỳ/môn |
| admin-dashboard-controller | GET | `/api/admin/subscription-plans` | listPlans | API phụ/legacy |
| admin-dashboard-controller | PUT | `/api/admin/subscription-plans/{planId}` | updatePlan | API phụ/legacy |
| admin-dashboard-controller | DELETE | `/api/admin/subscription-plans/{planId}` | deletePlan | API phụ/legacy |
| admin-dashboard-controller | GET | `/api/admin/subscriptions` | listSubscriptions | API phụ/legacy |
| admin-dashboard-controller | DELETE | `/api/admin/subscriptions/{subscriptionId}` | deleteSubscription | API phụ/legacy |
| admin-dashboard-controller | PATCH | `/api/admin/subscriptions/{subscriptionId}/status` | updateSubscriptionStatus | API phụ/legacy |
| admin-dashboard-controller | POST | `/api/admin/subscriptions/assign` | assignSubscription | API phụ/legacy |
| admin-dashboard-controller | GET | `/api/admin/users` | listUsers | API phụ/legacy |
| admin-dashboard-controller | PATCH | `/api/admin/users/{userId}` | updateUser | API phụ/legacy |
| admin-dashboard-controller | DELETE | `/api/admin/users/{userId}` | deleteUser | API phụ/legacy |
| AI Conversation History | GET | `/api/ai/conversations` | List AI tutor conversations | Conversation history |
| AI Conversation History | POST | `/api/ai/conversations` | Create a new AI tutor conversation | Conversation history |
| AI Conversation History | PATCH | `/api/ai/conversations/{conversationId}` | Rename an AI tutor conversation | Conversation history |
| AI Conversation History | DELETE | `/api/ai/conversations/{conversationId}` | Delete an AI tutor conversation | Conversation history |
| AI Conversation History | GET | `/api/ai/conversations/{conversationId}/messages` | Get messages in an AI tutor conversation | Conversation history |
| AI Conversation History | PATCH | `/api/ai/conversations/{conversationId}/messages/{messageId}/pin` | Pin a message inside an AI tutor conversation | Conversation history |
| AI Conversation History | DELETE | `/api/ai/conversations/{conversationId}/messages/{messageId}/pin` | Unpin a message inside an AI tutor conversation | Conversation history |
| AI Conversation History | GET | `/api/ai/conversations/{conversationId}/pinned-messages` | List pinned messages in an AI tutor conversation | Conversation history |
| AI Conversation History | GET | `/api/ai/conversations/search` | Search messages across a student's AI conversations | Conversation history |
| Tutor | POST | `/api/ai/query` | Ask the AI tutor using intent classification | AI route RAG/CODE/ESCALATE |
| Assignments | GET | `/api/assignments/{assignmentId}` | Get assignment detail | Bài tập mentor giao |
| Assignments | GET | `/api/assignments/{assignmentId}/file` | Download assignment attachment | Bài tập mentor giao |
| chat-controller | POST | `/api/chat/close` | closeChatRoom | API phụ/legacy |
| chat-controller | GET | `/api/chat/detail` | getChatRoomDetail | API phụ/legacy |
| chat-controller | GET | `/api/chat/history` | getChatHistory | API phụ/legacy |
| chat-controller | POST | `/api/chat/mark-read` | markChatAsRead | API phụ/legacy |
| chat-controller | POST | `/api/chat/send` | sendMessage | API phụ/legacy |
| chat-controller | GET | `/api/chat/unread` | getUnreadChats | API phụ/legacy |
| Code Mentor | POST | `/api/code-mentor/query` | Ask the dedicated Code Mentor | Debug code |
| Code Mentor | POST | `/api/code-mentor/upload` | Upload a code file and ask the dedicated Code Mentor | Debug code |
| Courses | GET | `/api/courses` | List courses | Admin học kỳ/môn |
| Courses | GET | `/api/courses/{courseId}` | Get course detail | Admin học kỳ/môn |
| Class Sections | GET | `/api/courses/{courseId}/class-sections` | List class sections by course | Admin lớp/enroll |
| Class Sections | GET | `/api/courses/{courseId}/class-sections/{classId}` | Get class section detail | Admin lớp/enroll |
| Class Sections | GET | `/api/courses/{courseId}/class-sections/{classId}/students` | List students enrolled in a class section | Admin lớp/enroll |
| Class Sections | POST | `/api/courses/{courseId}/class-sections/{classId}/students` | Enroll multiple students into a class section from JSON | Admin lớp/enroll |
| Class Sections | DELETE | `/api/courses/{courseId}/class-sections/{classId}/students/{studentId}` | Remove one student from a class section | Admin lớp/enroll |
| Class Sections | POST | `/api/courses/{courseId}/class-sections/{classId}/students/import` | Import students into a class section from Excel .xlsx | Admin lớp/enroll |
| Course Materials | GET | `/api/courses/{courseId}/materials` | List course materials by course and optional class scope | Upload/index tài liệu RAG |
| Course Materials | GET | `/api/courses/{courseId}/materials/{materialId}` | Get course material detail | Upload/index tài liệu RAG |
| Course Materials | PUT | `/api/courses/{courseId}/materials/{materialId}` | Update course material metadata | Upload/index tài liệu RAG |
| Course Materials | DELETE | `/api/courses/{courseId}/materials/{materialId}` | Delete one course material and its indexed chunks | Upload/index tài liệu RAG |
| Course Materials | GET | `/api/courses/{courseId}/materials/{materialId}/pdf` | Download stored course material PDF | Upload/index tài liệu RAG |
| Course Materials | POST | `/api/courses/{courseId}/materials/{materialId}/reindex` | Reindex one course material into Elasticsearch | Upload/index tài liệu RAG |
| Course Materials | POST | `/api/courses/{courseId}/materials/reindex` | Reindex all course materials into Elasticsearch | Upload/index tài liệu RAG |
| Course Materials | POST | `/api/courses/{courseId}/materials/upload` | Upload course material and index it by course scope | Upload/index tài liệu RAG |
| Class Sections | GET | `/api/courses/class-sections/students/import/template` | Get student enrollment Excel template specification | Admin lớp/enroll |
| Class Sections | GET | `/api/courses/class-sections/students/import/template.xlsx` | Download generated student enrollment Excel template | Admin lớp/enroll |
| Learning Dashboards | GET | `/api/dashboards/students/{studentId}` | Get student dashboard | Dashboard |
| Learning Dashboards | GET | `/api/dashboards/teachers/{teacherId}` | Get teacher or mentor dashboard | Dashboard |
| AI Harness Logs | GET | `/api/harness/error-logs` | List AI Harness error logs | Trace n8n |
| AI Harness Logs | POST | `/api/harness/error-logs` | Create an AI Harness error log | Trace n8n |
| AI Harness Logs | GET | `/api/harness/logs` | List AI Harness logs | Trace n8n |
| AI Harness Logs | POST | `/api/harness/logs` | Create an AI Harness trace log | Trace n8n |
| AI Harness Logs | GET | `/api/harness/traces/{traceId}` | Get all logs for one AI Harness trace | Trace n8n |
| Improve | GET | `/api/improve/students/{studentId}/courses/{courseId}/latest` | Get latest active improve plan for a student course | Improve plan |
| Improve | PUT | `/api/improve-plans/{planId}/complete` | Mark improve plan as completed | Improve plan |
| Assignments | PUT | `/api/mentor/assignments/{assignmentId}` | Teacher updates assignment metadata before submissions exist | Bài tập mentor giao |
| Assignments | DELETE | `/api/mentor/assignments/{assignmentId}` | Teacher deletes an assignment that has no submissions | Bài tập mentor giao |
| Assignments | GET | `/api/mentor/assignments/{assignmentId}/submissions` | Teacher lists submissions for an assignment | Bài tập mentor giao |
| Assignments | GET | `/api/mentor/courses/{courseId}/classes/{classId}/assignments` | Teacher lists assignments for one class | Bài tập mentor giao |
| Assignments | POST | `/api/mentor/courses/{courseId}/classes/{classId}/assignments/upload` | Teacher uploads an assignment file and sends it to class or selected students | Bài tập mentor giao |
| Assignments | GET | `/api/mentor/courses/{courseId}/classes/{classId}/submissions` | Teacher lists submissions, scores and feedback for a class | Bài tập mentor giao |
| Assignments | PUT | `/api/mentor/submissions/{submissionId}/review` | Teacher manually reviews a submission and records score/feedback | Bài tập mentor giao |
| Teacher Import | GET | `/api/mentors` | List all active mentors | Import mentor |
| Teacher Import | GET | `/api/mentors/{id}` | Get mentor details by ID | Import mentor |
| Class Sections | GET | `/api/mentors/{teacherId}/class-sections` | List class sections managed by one teacher or mentor | Admin lớp/enroll |
| Courses | GET | `/api/mentors/{teacherId}/courses` | List courses taught by one teacher or mentor | Admin học kỳ/môn |
| Learning Dashboards | GET | `/api/mentors/{teacherId}/dashboard` | Get teacher or mentor dashboard | Dashboard |
| Learning Dashboards | GET | `/api/mentors/{teacherId}/escalations/inbox` | Get teacher escalation inbox | Dashboard |
| Teacher Import | POST | `/api/mentors/import` | Import teachers from CSV or Excel | Import mentor |
| Teacher Import | GET | `/api/mentors/import/template` | Get mentor import template specifications | Import mentor |
| Teacher Import | GET | `/api/mentors/import/template.csv` | Download teacher import CSV template | Import mentor |
| Teacher Import | GET | `/api/mentors/import/template.xlsx` | Download generated mentor import template | Import mentor |
| Teacher Import | GET | `/api/mentors/import/template/download` | Download generated mentor import template | Import mentor |
| Assignments | GET | `/api/students/{studentId}/assignments` | Student lists assignments assigned to them | Bài tập mentor giao |
| Class Sections | GET | `/api/students/{studentId}/courses` | List courses and class sections enrolled by one student | Admin lớp/enroll |
| Improve | GET | `/api/students/{studentId}/courses/{courseId}/improve-plan` | Get latest active improve plan for a student course | Improve plan |
| Learning Dashboards | GET | `/api/students/{studentId}/dashboard` | Get student dashboard | Dashboard |
| Class Sections | GET | `/api/students/{studentId}/enrollments` | List courses and class sections enrolled by one student | Admin lớp/enroll |
| Improve | GET | `/api/students/{studentId}/improve-plans` | List persisted improve plans for a student | Improve plan |
| Assignments | GET | `/api/students/{studentId}/submissions` | Student lists their submissions, scores and teacher feedback | Bài tập mentor giao |
| Assignments | POST | `/api/students/assignments/{assignmentId}/submit` | Student submits an assignment file | Bài tập mentor giao |
| Assignments | GET | `/api/submissions/{submissionId}/file` | Download student submission file | Bài tập mentor giao |
| Class Sections | GET | `/api/teachers/{teacherId}/classes` | List class sections managed by one teacher or mentor | Admin lớp/enroll |
| Learning Dashboards | GET | `/api/teachers/{teacherId}/dashboard` | Get teacher or mentor dashboard | Dashboard |
| Learning Dashboards | GET | `/api/teachers/{teacherId}/escalations/inbox` | Get teacher escalation inbox | Dashboard |
| AI Answer Reviews | GET | `/api/tutor/answer-reviews` | List AI answer reviews | Review câu trả lời AI |
| AI Answer Reviews | POST | `/api/tutor/answer-reviews` | Submit a human review for an AI answer | Review câu trả lời AI |
| AI Answer Reviews | POST | `/api/tutor/answer-reviews/{id}/senior-resolve` | Resolve an AI answer review as senior mentor | Review câu trả lời AI |
| AI Answer Reviews | GET | `/api/tutor/answer-reviews/mentor-pending` | List reviews waiting for mentor review | Review câu trả lời AI |
| AI Answer Reviews | GET | `/api/tutor/answer-reviews/senior-pending` | List reviews waiting for senior mentor validation | Review câu trả lời AI |
| Student Memory | GET | `/api/tutor/courses/{courseId}/memories` | List student memories by course and optional class | Memory + pinned suggestions |
| Escalations | POST | `/api/tutor/escalations` | Create a question escalation from n8n AI Harness | AI không chắc -> mentor |
| Escalations | POST | `/api/tutor/escalations/{id}/answer` | Teacher answers an escalated question and creates a pending knowledge candidate | AI không chắc -> mentor |
| Escalations | POST | `/api/tutor/escalations/cancel` | Cancel teacher help offer | AI không chắc -> mentor |
| Escalations | GET | `/api/tutor/escalations/history` | Get escalation history for a student | AI không chắc -> mentor |
| Knowledge Candidates | GET | `/api/tutor/escalations/knowledge-candidates` | List knowledge candidates | Senior approve brain |
| Knowledge Candidates | POST | `/api/tutor/escalations/knowledge-candidates/{id}/approve` | Senior mentor approves and indexes knowledge into course RAG | Senior approve brain |
| Knowledge Candidates | POST | `/api/tutor/escalations/knowledge-candidates/{id}/reject` | Senior mentor rejects a knowledge candidate | Senior approve brain |
| Knowledge Candidates | GET | `/api/tutor/escalations/knowledge-candidates/pending` | List candidates waiting for senior mentor review | Senior approve brain |
| Knowledge Candidates | GET | `/api/tutor/escalations/knowledge-candidates/senior-pending` | Alias: list senior mentor pending candidates | Senior approve brain |
| Escalations | POST | `/api/tutor/escalations/offer` | Offer teacher or mentor help for a question escalation | AI không chắc -> mentor |
| Escalations | POST | `/api/tutor/escalations/select` | Select a teacher or mentor and create a chat room | AI không chắc -> mentor |
| Learning Dashboards | GET | `/api/tutor/escalations/teachers/{teacherId}` | Get teacher escalation inbox | Dashboard |
| Improve | POST | `/api/tutor/improve-suggestions` | Generate improve suggestions and persist an improve plan for a student course | Improve plan |
| Tutor | POST | `/api/tutor/intent-classify` | Classify a student question for n8n AI Harness routing | AI route RAG/CODE/ESCALATE |
| Knowledge Candidates | GET | `/api/tutor/knowledge-candidates` | List knowledge candidates | Senior approve brain |
| Knowledge Candidates | POST | `/api/tutor/knowledge-candidates/{id}/approve` | Senior mentor approves and indexes knowledge into course RAG | Senior approve brain |
| Knowledge Candidates | POST | `/api/tutor/knowledge-candidates/{id}/reject` | Senior mentor rejects a knowledge candidate | Senior approve brain |
| Knowledge Candidates | GET | `/api/tutor/knowledge-candidates/pending` | List candidates waiting for senior mentor review | Senior approve brain |
| Knowledge Candidates | GET | `/api/tutor/knowledge-candidates/senior-pending` | Alias: list senior mentor pending candidates | Senior approve brain |
| Learning Quiz | PUT | `/api/tutor/quiz-assignments/{assignmentId}` | Update draft quiz assignment before publishing | Quiz AI tạo/chấm/review |
| Learning Quiz | DELETE | `/api/tutor/quiz-assignments/{assignmentId}` | Delete draft quiz assignment | Quiz AI tạo/chấm/review |
| Learning Quiz | POST | `/api/tutor/quiz-assignments/{assignmentId}/attempts` | Start an attempt for an assigned quiz | Quiz AI tạo/chấm/review |
| Learning Quiz | POST | `/api/tutor/quiz-assignments/{assignmentId}/publish` | Publish quiz assignment to whole class or selected students | Quiz AI tạo/chấm/review |
| Learning Quiz | GET | `/api/tutor/quizzes/{quizSessionId}` | Get quiz session detail | Quiz AI tạo/chấm/review |
| Learning Quiz | POST | `/api/tutor/quizzes/{quizSessionId}/submit` | Submit quiz answers and receive AI/backend score | Quiz AI tạo/chấm/review |
| Learning Quiz | PUT | `/api/tutor/quizzes/{quizSessionId}/teacher-review` | Teacher reviews AI-scored quiz result | Quiz AI tạo/chấm/review |
| Student Memory | GET | `/api/tutor/students/{studentId}/courses/{courseId}/memory` | Get student course-scoped memory | Memory + pinned suggestions |
| Student Memory | PUT | `/api/tutor/students/{studentId}/courses/{courseId}/memory` | Update student course-scoped memory | Memory + pinned suggestions |
| Student Memory | POST | `/api/tutor/students/{studentId}/courses/{courseId}/memory/pinned-suggestions` | Pin an improve suggestion so it stays visible for student review | Memory + pinned suggestions |
| Student Memory | DELETE | `/api/tutor/students/{studentId}/courses/{courseId}/memory/pinned-suggestions` | Unpin an improve suggestion | Memory + pinned suggestions |
| Learning Quiz | GET | `/api/tutor/students/{studentId}/courses/{courseId}/quiz-assignments` | List published quiz assignments available to a student | Quiz AI tạo/chấm/review |
| Learning Quiz | GET | `/api/tutor/students/{studentId}/courses/{courseId}/quizzes` | List quiz history for a student course | Quiz AI tạo/chấm/review |
| Learning Quiz | POST | `/api/tutor/students/{studentId}/courses/{courseId}/quizzes/generate` | Generate a grounded self-practice quiz from a suggestion or topic | Quiz AI tạo/chấm/review |
| Learning Quiz | POST | `/api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn` | Continue the current chat from one clicked improve suggestion | Quiz AI tạo/chấm/review |
| Learning Quiz | POST | `/api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate` | Generate a draft quiz assignment for teacher review | Quiz AI tạo/chấm/review |
| Learning Quiz | GET | `/api/tutor/teachers/{teacherId}/quiz-assignments` | List quiz assignments created by a teacher | Quiz AI tạo/chấm/review |
| User Profile | PUT | `/api/users/{userId}/password` | Change password for student, mentor, or admin account | Auth/profile |
| User Profile | GET | `/api/users/{userId}/profile` | Get user profile | Auth/profile |
| User Profile | PUT | `/api/users/{userId}/profile` | Update user profile | Auth/profile |
| User Profile | POST | `/api/users/login` | Login student or mentor account | Auth/profile |
| User Profile | GET | `/api/users/profile` | Get user profile by query parameter | Auth/profile |
| User Profile | POST | `/api/users/register` | Register student account | Auth/profile |

## 5. Lưu Ý Cho FE

- API nghiệp vụ CRUD gọi backend trực tiếp `http://localhost:8085`.
- Flow AI/Human-in-the-loop gọi n8n webhook, trừ click improve suggestion và quiz direct API nếu FE không cần n8n trace.
- Luôn truyền `courseId`; truyền `classId` khi context là lớp cụ thể.
- Conversation chat cần giữ `conversationId` backend/n8n trả về để append message đúng thread.
- Escalation history hiện dùng query `userId`, không phải `studentId`: `/api/tutor/escalations/history?userId=SE1840001`.
- n8n `/rest/active-workflows` trả `401` nếu chưa auth; health `/healthz` OK là đủ biết container sống.
- Không hiển thị `correctAnswer` quiz cho student trước submit; backend student view đã ẩn đáp án.
## Course Material HTML URL Import

FE/Admin can import HTML documentation pages directly into the RAG brain without converting them to PDF.

Endpoint:

```http
POST /api/courses/{courseId}/materials/import-url
Content-Type: application/json
```

Body:

```json
{
  "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html#jvms-1.1",
  "title": "JVM Spec SE8 - Chapter 1",
  "classId": "",
  "teacherId": "ADMIN",
  "uploaderRole": "ADMIN",
  "followNext": false,
  "maxPages": 1
}
```

Rules:

- `uploaderRole=ADMIN`: material is `COURSE_SHARED`; `classId` can be empty.
- `uploaderRole=TEACHER`: material is `CLASS_SECTION`; `teacherId` and `classId` are required.
- `followNext=false`: import only the given URL.
- `followNext=true`: follow documentation `Next` links on the same domain only.
- `maxPages` is capped by backend to avoid accidentally crawling too much documentation.
- Response status is `202 ACCEPTED` because indexing runs in background.

Example response:

```json
{
  "message": "HTML material imported. Indexing is running in background.",
  "materialId": "...",
  "title": "JVM Spec SE8 - Chapter 1",
  "courseId": "PRO192",
  "materialScope": "COURSE_SHARED",
  "sourceType": "HTML_URL",
  "importedUrls": [
    "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html#jvms-1.1"
  ],
  "importedPageCount": 1,
  "indexingStatus": "PROCESSING"
}
```
## HTML Table Of Contents Preview And Selected Import

FE should use this 2-step flow when importing documentation sites such as Oracle Java docs.

Step 1: Preview Table of Contents

```http
POST /api/courses/{courseId}/materials/url-toc
Content-Type: application/json
```

```json
{
  "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/index.html"
}
```

Example response shape:

```json
{
  "courseId": "PRO192",
  "title": "The Java Virtual Machine Specification",
  "sourceUrl": "https://docs.oracle.com/javase/specs/jvms/se8/html/index.html",
  "itemCount": 20,
  "items": [
    {
      "title": "1. Introduction",
      "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html",
      "level": 1,
      "anchor": null
    },
    {
      "title": "1.1. A Bit of History",
      "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html#jvms-1.1",
      "level": 2,
      "anchor": "jvms-1.1"
    }
  ]
}
```

FE display suggestion:

- Render `items` as a tree using `level`.
- Let Admin/Teacher tick chapters or sections.
- Send selected item URLs into `selectedUrls`.

Step 2: Import selected chapters/sections

```http
POST /api/courses/{courseId}/materials/import-url
Content-Type: application/json
```

```json
{
  "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/index.html",
  "title": "JVM Spec SE8 - Selected Chapters",
  "uploaderRole": "ADMIN",
  "teacherId": "ADMIN",
  "selectedUrls": [
    "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html",
    "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-2.html#jvms-2.1"
  ]
}
```

Rules:

- If `selectedUrls` is present, backend ignores `followNext`.
- `selectedUrls` must stay on the same domain as `url`.
- Backend de-duplicates selected URLs.
- Backend currently allows up to 50 selected URLs per import request.
- For URLs with anchors like `#jvms-1.1`, backend tries to extract that section instead of the whole page.
- Response is `202 ACCEPTED`; indexing is background.
## Multilingual Course Material Behavior

Course materials can be English while students ask in Vietnamese.

Backend AI prompt rule:

- AI answers in the same language as the student question.
- If the student asks Vietnamese questions over English PDF/HTML docs, AI explains in Vietnamese.
- Important technical terms remain in English when useful, for example `bytecode`, `class file`, `runtime data areas`, `operand stack`.
- Source names, material IDs, class names, method names, API names, and code identifiers are not translated.

FE does not need a translation step. Just send the student's original message.

## Cap nhat: LLM fallback va quiz text sanitizer

### LLM fallback
Backend hien co 2 lop model OpenRouter:

- Primary model: dung cho chat/RAG/Code Mentor/Quiz binh thuong.
- Fallback model: tu dong duoc goi khi primary gap loi tam thoi nhu `429`, timeout, upstream `5xx`, overloaded, connection reset.

FE va n8n khong can gui them field model. FE cu goi dung API/webhook nhu cu. Backend tu quyet dinh fallback va chi ghi log o server.

Khong fallback voi loi request sai nhu thieu field, JSON sai, courseId sai, hoac validation 400.

### Quiz text sanitizer
Quiz do AI tao ra duoc backend sanitize truoc khi luu DB va tra ve FE:

- `questionText`
- `options`
- `correctAnswer`
- `explanation`

Backend se loai cac ky tu Chinese/Japanese/Korean/Cyrillic bi model chen nham vao noi dung tieng Viet. Neu cau hoi bi rong sau khi sanitize, backend bo cau hoi do.

Luu y cho FE: quiz da tao truoc ban fix nay co the van con chu la trong DB. Can generate lai quiz moi hoac xoa quiz cu neu muon hien thi sach.

### FE hien thi loi quiz
Neu generate quiz tra loi:

```json
{
  "error": "Chua co du tai lieu mon hoc de tao quiz cho chu de nay"
}
```

FE nen hien thi: `Mon hoc/chapter nay chua du tai lieu de tao quiz. Vui long upload them tai lieu hoac chon chu de khac.`

## Student/Mentor Logic Coverage Cho FE

Phan nay tom tat trang thai nghiep vu hien tai de FE biet man hinh nao co the lam ngay, man hinh nao chi nen de MVP, va phan nao chua nen hua voi nguoi dung.

### Student da co the lam

| Nhom | Trang thai BE | FE nen lam |
|---|---|---|
| Account student | Da co register/login/profile co ban | Form dang ky/dang nhap, profile ca nhan |
| Course/class dang hoc | Da co API enrollment/course/class | Man danh sach mon hoc dang hoc, moi mon co chat rieng |
| AI Tutor chat | Da co `/api/ai/query` va n8n Student Chat Harness | Chat theo `studentId + courseId`, khong tron conversation giua cac mon |
| RAG theo tai lieu | Da co course scoped RAG, classId optional | Hien source material, confidence, escalation note |
| Code Mentor | Da co `/api/code-mentor/query` va upload code file | Khung paste code/log rieng, khong gop voi upload tai lieu |
| Student memory | Da co theo `studentId + courseId` | Hien weakTopics, learnedTopics, recentQuestions, improveSuggestions |
| Improve suggestions | Da co generate/pin/click-to-learn | Nut `Hoc ngay`, chi click 1 lan cho mot suggestion |
| Pin message | Da co pin/unpin message trong conversation | Icon pin tren tung message, panel pinned messages |
| Search chat | Da co search conversation/message | Search trong sidebar chat |
| Answer review | Da co `AiAnswerReview` va n8n review flow | Nut huu ich/khong huu ich/gop y/sai thong tin |
| Escalation | Da co khi AI khong chac hoac student dispute | Hien trang thai `da gui mentor`, id ticket neu co |
| Self-practice quiz | Da co AI generate quiz tu tai lieu va backend cham trac nghiem | Man Practice Quizzes, an dap an truoc submit |
| Assignment quiz | Da co attempt/submit quiz giao boi mentor | Man quiz duoc giao, nop bai, xem diem sau submit |
| Assignments file | Da co teacher upload, student submit, teacher cham | Man bai tap file co nut download/nop bai |
| Dashboard | Da co dashboard co ban | Dashboard tong hop course, weak topics, improve plan, grades |

### Mentor/Teacher da co the lam

| Nhom | Trang thai BE | FE nen lam |
|---|---|---|
| Account mentor | Da co import CSV/XLSX va sync sang users | Login bang account duoc cap, doi mat khau neu co API |
| Quan ly lop dang day | Da co list class/courses theo teacherId | Dashboard lop cua mentor |
| Upload tai lieu | Da co file upload va URL/HTML import | Man upload material, chon course/class optional, xem status indexed |
| Table of contents URL docs | Da co API lay TOC va import selected URLs | FE show danh sach chapter/section de mentor tick chon import |
| Assignment file | Da co teacher upload assignment file | Mentor tao bai tap, gui ca lop hoac selected students |
| Submission review | Da co list submissions va manual review score/feedback | Man cham bai thu cong |
| Quiz draft by AI | Da co generate assignment draft tu tai lieu | Mentor review/sua/xoa cau hoi truoc khi publish |
| Publish quiz | Da co publish class/selected students | Nut publish, chon ca lop hoac hoc sinh rieng |
| Review quiz score | Da co teacher review quiz session | Mentor xem diem AI/backend cham, sua diem/feedback neu can |
| Escalation inbox | Da co API inbox/history | Mentor xem cau hoi AI khong chac va tra loi |
| Knowledge candidate | Da co tao candidate tu teacher answer/review | Mentor/senior flow tach rieng, khong auto index |
| Dashboard/analytics | Da co co ban | Hien class analytics, weak topics, escalations, pending candidates |

### Dieu FE can luu y de dung nghiep vu

- Student chat phai tach theo mon hoc. Conversation cua PRO192 khong dung lai cho PRJ301.
- Moi conversation gioi han 10 cau hoi user. Neu backend tra conversationId moi, FE chuyen sang conversation moi.
- AI Tutor RAG chi tra loi theo tai lieu course. Neu thieu tai lieu thi FE hien escalate/mentor support, khong hien nhu loi he thong.
- Code Mentor la flow rieng cho code/log/debug. Khong dung RAG bat buoc cho debug code.
- Improve suggestion `Hoc ngay` chi nen cho click 1 lan. Sau khi click thanh cong, disable nut do.
- Quiz moi sinh tu backend da sanitize ky tu la. Quiz cu trong DB truoc ban fix co the can generate lai neu con chu Trung/Nhat/Han/Nga.
- Student khong duoc xem `correctAnswer` va `explanation` truoc khi submit quiz.
- Teacher/mentor co quyen sua quiz draft truoc khi publish. Sau publish thi khong nen cho sua cau hoi tuy tien.
- AI khong tu hoc tu review cua student. Chi knowledge candidate duoc senior/admin approve moi index vao RAG brain.
- n8n chi dung cho AI workflows: student chat, answer review, teacher answer, senior approval, quiz harness neu can trace. CRUD nghiep vu thuong FE goi backend truc tiep.

### Chua nen xem la production day du

| Phan | Ly do | Huong sau nay |
|---|---|---|
| JWT/role guard | Hien dang uu tien test truc tiep | Them auth guard cho STUDENT/TEACHER/ADMIN |
| Notification realtime | Hien chu yeu API/n8n log | Them WebSocket/email/in-app notification |
| Mentor-student live chat | Chua phai chat realtime day du | Lam module messaging rieng neu can |
| Audit trail day du | Moi co log harness va data co ban | Log moi thao tac publish/delete/approve/reject |
| Quiz quality validation nang cao | Da sanitize text nhung chua co bo kiem dinh su pham | Them review rubric cho quiz AI tao |
| Assignment AI grading | Co tinh chua lam theo scope hien tai | Neu can thi lam flow rieng, mentor van review cuoi |
| Cleanup data cu | Data fake/cu co the con loi | Them script/API cleanup khi truoc demo/deploy |
