# AI Tutor Platform - Frontend Implementation Guide

File này là tài liệu chính cho FE nối với backend Spring Boot và n8n Harness.
Mục tiêu: FE đọc file này là biết màn nào gọi API nào, gửi payload gì, nhận response gì, và UI phải xử lý nghiệp vụ ra sao.

## 0. Tóm tắt kiến trúc

Project có 2 luồng kết nối riêng:

| Luồng | FE gọi | Dùng cho |
|---|---|---|
| Backend API | `http://localhost:8085` | Login, profile, course, class, material, dashboard, memory, conversation, quiz CRUD, assignment |
| n8n Harness | `http://localhost:5678/webhook/...` | Chat AI, Code Mentor, Answer Review, Teacher Answer, Senior Approval, Quiz Generate/Submit nếu chạy qua workflow |

Không dùng n8n như BFF cho toàn bộ project. n8n chỉ dùng cho những flow AI cần điều phối, trace, kiểm lỗi, escalation hoặc human-in-the-loop.

```text
Normal business flow
Frontend -> Spring Boot API -> MongoDB / Elasticsearch

AI Harness flow
Frontend -> n8n Webhook -> Spring Boot AI APIs -> MongoDB / Elasticsearch / LLM
```

## 1. Env FE nên có

```env
VITE_API_BASE_URL=http://localhost:8085
VITE_N8N_BASE_URL=http://localhost:5678
VITE_N8N_MODE=production
```

Nếu test trong n8n editor:

```env
VITE_N8N_MODE=test
```

Helper tạo webhook URL:

```js
const N8N_BASE = import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678';
const N8N_MODE = import.meta.env.VITE_N8N_MODE || 'production';

export function n8nWebhook(path) {
  const prefix = N8N_MODE === 'test' ? '/webhook-test' : '/webhook';
  return `${N8N_BASE}${prefix}/${path}`;
}
```

Ví dụ:

```js
n8nWebhook('student-chat')
// production: http://localhost:5678/webhook/student-chat
// test:       http://localhost:5678/webhook-test/student-chat
```

## 2. API client chuẩn

Backend API luôn dùng JWT header, trừ login/register và một số log endpoint public.

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8085';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorBody = null;
    try { errorBody = await response.json(); } catch (_) {}
    throw new Error(errorBody?.error || errorBody?.message || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response;
}
```

n8n webhook nên gửi token trong body bằng `authToken`. Không phụ thuộc header Authorization vì khi đổi máy/test Postman dễ mất header.

```js
export async function n8nPost(path, payload, options = {}) {
  const token = localStorage.getItem('authToken');
  const response = await fetch(n8nWebhook(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, authToken: token }),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorBody = null;
    try { errorBody = await response.json(); } catch (_) {}
    throw new Error(errorBody?.message || errorBody?.error || `n8n HTTP ${response.status}`);
  }

  return response.json();
}
```

## 3. Auth và role

### 3.1 Register student

```http
POST /api/users/register
```

```json
{
  "email": "student@test.com",
  "password": "123456",
  "fullName": "Nguyen Van A",
  "phone": ""
}
```

Chỉ học sinh tự đăng ký. Teacher/mentor không tự register, teacher được admin import.

### 3.2 Login

```http
POST /api/users/login
```

```json
{
  "email": "student@test.com",
  "password": "123456"
}
```

Response:

```json
{
  "userId": "uuid",
  "email": "student@test.com",
  "fullName": "Nguyen Van A",
  "role": "STUDENT",
  "token": "jwt-token",
  "message": "Đăng nhập thành công"
}
```

FE lưu:

```js
localStorage.setItem('authToken', res.token);
localStorage.setItem('user', JSON.stringify(res));
```

Điều hướng theo role:

```js
if (res.role === 'STUDENT') navigate('/student');
if (res.role === 'TEACHER') navigate('/teacher');
if (res.role === 'ADMIN') navigate('/admin');
```

### 3.3 Role nghiệp vụ

| Role | Cách tạo | Màn hình chính |
|---|---|---|
| `STUDENT` | Register | AI Tutor Chat, Code Mentor, Materials, Assignments, Quiz, Improve Plan, Escalation status |
| `TEACHER` | Admin import CSV/XLSX | Classes, Students, Upload material, Escalation inbox, Quiz assignment, Assignment review |
| `ADMIN` | Account seed/cấu hình | Semesters, Courses, Classes, Users, Teacher import, Course-shared materials, Senior queue nếu được dùng |

### 3.4 Profile/password

```http
GET /api/users/profile
GET /api/users/{userId}/profile
PUT /api/users/{userId}/profile
PUT /api/users/{userId}/password
```

Teacher import có password mặc định là số điện thoại. FE nên hiện thông báo đổi mật khẩu lần đầu.

## 4. ID FE phải quản lý

| Field | Sinh ra từ đâu | Scope |
|---|---|---|
| `traceId` | FE tạo mỗi request | Dùng để trace n8n/backend log |
| `sessionId` | FE tạo khi mở tab/login session | Dùng cho một phiên sử dụng |
| `conversationId` | Backend trả sau câu đầu hoặc FE tạo tạm khi bắt đầu | Một đoạn chat theo course |

Helper:

```js
function uuid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getSessionId() {
  let id = sessionStorage.getItem('sessionId');
  if (!id) {
    id = `session-${uuid()}`;
    sessionStorage.setItem('sessionId', id);
  }
  return id;
}

export function newTraceId(prefix = 'trace') {
  return `${prefix}-${uuid()}`;
}
```

Conversation nên lưu theo `studentId + courseId`:

```js
const key = `conversation:${studentId}:${courseId}`;
localStorage.setItem(key, conversationId);
```

Không dùng chung conversation giữa PRO192 và PRJ301.

## 5. Flow chính Student Chat qua n8n

### 5.1 Endpoint

Production:

```http
POST http://localhost:5678/webhook/student-chat
```

Test trong n8n editor:

```http
POST http://localhost:5678/webhook-test/student-chat
```

### 5.2 Payload RAG/theory

```json
{
  "traceId": "trace-chat-001",
  "sessionId": "session-tab-001",
  "conversationId": "conv-pro192-001",
  "studentId": "user-id-from-login",
  "studentName": "Nguyen Van A",
  "courseId": "PRO192",
  "classId": "SE1840",
  "message": "Cơ chế hoạt động của JSP là gì?",
  "codeSnippet": "",
  "authToken": "jwt-token"
}
```

### 5.3 Payload Code Mentor

Vẫn dùng `student-chat`, không gọi riêng từ FE.

```json
{
  "traceId": "trace-code-001",
  "sessionId": "session-tab-001",
  "conversationId": "conv-pro192-001",
  "studentId": "user-id-from-login",
  "studentName": "Nguyen Van A",
  "courseId": "PRO192",
  "classId": "SE1840",
  "message": "Code này sai ở đâu?",
  "codeSnippet": "public HelloWorld { public static void main(String[] args) {} }",
  "authToken": "jwt-token"
}
```

### 5.4 Response RAG/CODE

```json
{
  "success": true,
  "mode": "RAG",
  "answer": "...markdown...",
  "confidence": 0.87,
  "escalated": false,
  "conversationId": "conv-pro192-001",
  "traceId": "trace-chat-001",
  "sources": ["materialId=..."]
}
```

Response có thể có thêm:

```json
{
  "subIntent": "EXPLAIN_CONCEPT",
  "domain": "WEB",
  "answerPolicy": "COURSE_GROUNDED",
  "requiresCourseMaterial": true,
  "userMessageId": "...",
  "assistantMessageId": "...",
  "nextImproveSuggestions": []
}
```

FE nên render:

- Markdown answer.
- Badge mode: `AI Môn học`, `Code Mentor`, hoặc `Escalated`.
- Confidence: `Math.round(confidence * 100) + '%'`.
- Sources nếu có.
- Nút review: Helpful, Not correct, Need more detail.
- Nút pin message.
- Nút stop khi request đang chạy.

### 5.5 Response escalated

```json
{
  "success": true,
  "mode": "ESCALATE",
  "escalated": true,
  "answer": "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.",
  "questionEscalationId": "esc-id",
  "conversationId": "conv-pro192-001",
  "traceId": "trace-chat-001"
}
```

FE hiển thị:

- Câu hỏi đã được gửi mentor.
- Mã ticket.
- Nút xem trạng thái.
- Không render như một câu trả lời chắc chắn.

### 5.6 Stop button

```js
const controller = new AbortController();

const promise = n8nPost('student-chat', payload, { signal: controller.signal });

// Khi người dùng bấm Stop
controller.abort();
```

Khi abort, FE chỉ dừng request phía client. Backend/n8n có thể vẫn hoàn tất nếu request đã gửi đi.

## 6. Intent và phạm vi AI Tutor

AI Tutor hiện hỗ trợ các nhóm intent sau:

| Intent | Ví dụ | Flow |
|---|---|---|
| Explain Concept | `JSP là gì?` | RAG |
| Guide Solution | `Em nên bắt đầu bài này từ đâu?` | RAG hoặc CODE nếu có code |
| Review Logic | `Hướng làm của em đúng chưa?` | CODE/mentor style |
| Debug Code | `Code của em lỗi ở đâu?` | CODE |
| Explain Error | `NullPointerException là gì?` | CODE |
| Code Review | `Đánh giá code của em` | CODE |
| Algorithm Hint | `Nên dùng thuật toán nào?` | CODE/mentor style |
| Data Structure Advice | `Nên dùng HashMap hay Array?` | CODE/mentor style |
| SQL Review | `SQL này sai không?` | CODE/mentor style |
| Architecture Review | `Thiết kế này ổn không?` | CODE/mentor style |
| Exam Practice | `Hỏi em từng câu để ôn tập` | RAG/quiz |
| Learning Path | `Em nên học gì tiếp theo?` | Improve/memory |

Ràng buộc quan trọng:

- AI không làm hộ full assignment.
- AI không viết full project/copy-paste solution.
- AI được giải thích, gợi ý, chỉ hướng debug, đưa ví dụ nhỏ.
- Nếu thiếu tài liệu hoặc không chắc, AI phải escalate.
- Với câu hỏi học thuật course-grounded, AI phải dựa trên tài liệu course.
- Tài liệu tiếng Anh vẫn có thể trả lời tiếng Việt cho học sinh Việt.

## 7. Conversation history, pin và search

### 7.1 List conversations

```http
GET /api/ai/conversations?userId={studentId}&page=0&size=50
```

### 7.2 Create conversation nếu FE muốn tạo trước

```http
POST /api/ai/conversations
```

```json
{
  "userId": "student-id",
  "courseId": "PRO192",
  "classId": "SE1840",
  "title": "OOP"
}
```

### 7.3 Get messages

```http
GET /api/ai/conversations/{conversationId}/messages?userId={studentId}
```

### 7.4 Rename/delete conversation

```http
PATCH /api/ai/conversations/{conversationId}
DELETE /api/ai/conversations/{conversationId}?userId={studentId}
```

### 7.5 Pin message giống Zalo

```http
PATCH /api/ai/conversations/{conversationId}/messages/{messageId}/pin?userId={studentId}
DELETE /api/ai/conversations/{conversationId}/messages/{messageId}/pin?userId={studentId}
GET /api/ai/conversations/{conversationId}/pinned-messages?userId={studentId}
```

### 7.6 Search chat

```http
GET /api/ai/conversations/search?userId={studentId}&keyword=JSP&page=0&size=20
```

UI gợi ý:

- Sidebar có search box.
- Mỗi message có nút pin/unpin.
- Kết quả search click vào thì mở đúng conversation.
- Nếu conversation đạt giới hạn lượt hỏi, backend có thể trả conversation mới; FE chuyển sang conversation mới đó.

## 8. Improve suggestions

### 8.1 Render suggestions sau answer

Response AI có thể trả:

```json
{
  "nextImproveSuggestions": [
    {
      "title": "Ôn lại Encapsulation",
      "reason": "Bạn còn nhầm giữa class và object",
      "nextSteps": ["Đọc lại ví dụ", "Tự viết class Person"]
    }
  ]
}
```

FE render thành chip/card dưới câu trả lời.

### 8.2 Click suggestion để học tiếp

Mỗi suggestion chỉ cho click 1 lần trong ngữ cảnh hiện tại. Khi click:

```http
POST /api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn
```

```json
{
  "classId": "SE1840",
  "conversationId": "conv-pro192-001",
  "suggestionText": "Ôn lại Encapsulation",
  "suggestionKey": "encapsulation-oop",
  "topic": "Encapsulation"
}
```

Response là `AiQueryResponse`, FE append vào chat như câu trả lời AI mới.

### 8.3 Pin improve suggestion ngoài chat

Đây là checklist học tập, không phải pin message trong chat.

```http
POST /api/tutor/students/{studentId}/courses/{courseId}/memory/pinned-suggestions
DELETE /api/tutor/students/{studentId}/courses/{courseId}/memory/pinned-suggestions?suggestion=...
```

Payload pin:

```json
{
  "suggestion": "Ôn lại Encapsulation trong OOP"
}
```

## 9. Student Course Memory

```http
GET /api/tutor/students/{studentId}/courses/{courseId}/memory
PUT /api/tutor/students/{studentId}/courses/{courseId}/memory
GET /api/tutor/courses/{courseId}/memories
```

Memory scope là `studentId + courseId`.

FE hiển thị:

- `summary`
- `weakTopics`
- `learnedTopics`
- `recentQuestions`
- `recentAnswers`
- `improveSuggestions`
- `pinnedImproveSuggestions`

Lưu ý:

- Không hiển thị recent answer nếu đó là lỗi máy chủ/LLM timeout.
- Nếu improve suggestion là JSON string, FE có thể parse thử. Nếu parse fail thì render text sạch.

## 10. n8n Flow 2 - Answer Review

Endpoint:

```http
POST /webhook/answer-review
```

Good review:

```json
{
  "traceId": "trace-review-001",
  "sessionId": "session-001",
  "conversationId": "conv-001",
  "studentId": "student-id",
  "courseId": "PRO192",
  "classId": "SE1840",
  "mode": "RAG",
  "reviewType": "QUALITY_FEEDBACK",
  "question": "OOP là gì?",
  "answer": "OOP là lập trình hướng đối tượng.",
  "aiConfidence": 0.87,
  "rating": 5,
  "accurate": true,
  "helpful": true,
  "correctnessLevel": "HIGH",
  "feedback": "Câu trả lời dễ hiểu.",
  "authToken": "jwt-token"
}
```

Bad/dispute review:

```json
{
  "traceId": "trace-review-bad-001",
  "sessionId": "session-001",
  "conversationId": "conv-001",
  "studentId": "student-id",
  "courseId": "PRO192",
  "classId": "SE1840",
  "mode": "RAG",
  "reviewType": "ANSWER_DISPUTE",
  "question": "OOP là gì?",
  "answer": "...",
  "aiConfidence": 0.45,
  "rating": 1,
  "accurate": false,
  "helpful": false,
  "correctnessLevel": "INCORRECT",
  "feedback": "Em nghĩ câu trả lời sai, cần mentor kiểm tra.",
  "suggestedCorrection": "...",
  "authToken": "jwt-token"
}
```

Quy tắc nghiệp vụ:

| Rating | Xử lý |
|---|---|
| 4-5 | Lưu review, analytics only |
| 2-3 | Mentor review |
| 0-1 | Senior/mentor review vì có rủi ro kiến thức sai |

Nếu học sinh chỉ nói `AI sai rồi` trong chat, FE vẫn gửi review với `reviewType=ANSWER_DISPUTE`.

## 11. Escalation lifecycle

AI tạo escalation khi:

- Không có tài liệu liên quan.
- Retrieval/rerank confidence thấp.
- Câu hỏi về điểm, deadline, policy lớp.
- Câu hỏi assignment-specific cần giáo viên xác nhận.
- Học sinh dispute câu trả lời AI.
- AI không đủ chắc để trả lời trong phạm vi tài liệu.

Student xem trạng thái:

```http
GET /api/tutor/escalations/{id}
GET /api/tutor/escalations/history?studentId={studentId}&courseId={courseId}
```

Response detail có thể gồm:

```json
{
  "id": "esc-id",
  "status": "PENDING_OFFER",
  "studentVisibleStatus": "WAITING_TEACHER",
  "aiBrainUpdated": false,
  "conversationId": "conv-id",
  "mentorAnswers": [],
  "knowledgeCandidates": []
}
```

UI mapping:

| Status | FE hiển thị |
|---|---|
| `PENDING_OFFER` | Đang chờ mentor nhận/trả lời |
| `ANSWERED` | Mentor đã trả lời |
| `ANSWERED_KNOWLEDGE_REJECTED` | Mentor trả lời nhưng senior không duyệt vào AI brain |
| `RESOLVED_INDEXED` | Senior đã duyệt, AI brain đã cập nhật |

Khi senior approve knowledge candidate:

1. Backend index kiến thức vào Elasticsearch/RAG brain.
2. Backend đổi escalation sang `RESOLVED_INDEXED`.
3. Backend tự append câu trả lời vào conversation nếu escalation có `conversationId`.
4. FE chỉ cần refetch messages hoặc poll escalation detail.

## 12. n8n Flow 3 - Teacher Answer

Endpoint:

```http
POST /webhook/teacher-answer
```

```json
{
  "traceId": "trace-teacher-answer-001",
  "questionEscalationId": "esc-id",
  "teacherId": "TEACHER_A",
  "teacherName": "Teacher A",
  "answer": "JSP được container biên dịch thành Servlet, sau đó servlet xử lý request và trả response.",
  "createKnowledgeCandidate": true,
  "candidateType": "ACADEMIC_KNOWLEDGE",
  "authToken": "teacher-jwt-token"
}
```

`createKnowledgeCandidate=true` chỉ dùng cho kiến thức học thuật có thể tái sử dụng.

Không tạo knowledge candidate cho:

- Deadline.
- Điểm số.
- Policy riêng của lớp.
- Câu trả lời chỉ dành cho một assignment cụ thể.

Candidate type nên dùng:

| Type | Khi nào dùng |
|---|---|
| `ACADEMIC_KNOWLEDGE` | Kiến thức học thuật chung |
| `MATERIAL_CORRECTION` | Tài liệu có lỗi/cần sửa |
| `FAQ_CLARIFICATION` | Câu hỏi hay gặp có thể tái sử dụng |
| `OPERATIONAL_POLICY` | Quy định vận hành, thường không index vào brain |
| `GRADING_DECISION` | Điểm/chấm bài, không index vào brain |
| `CLASS_RULE` | Nội quy lớp, không index vào brain |
| `ASSIGNMENT_SPECIFIC` | Riêng một bài, không index vào brain |

## 13. n8n Flow 4 - Senior Approval

Endpoint:

```http
POST /webhook/senior-knowledge-approval
```

Approve:

```json
{
  "traceId": "trace-senior-approve-001",
  "candidateId": "candidate-id",
  "decision": "APPROVE",
  "reviewerId": "SENIOR_A",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewerName": "Senior Mentor A",
  "reviewNote": "Kiến thức đúng, có thể đưa vào RAG brain.",
  "authToken": "senior-or-admin-jwt-token"
}
```

Reject:

```json
{
  "traceId": "trace-senior-reject-001",
  "candidateId": "candidate-id",
  "decision": "REJECT",
  "reviewerId": "SENIOR_A",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewerName": "Senior Mentor A",
  "rejectionReason": "Đây là policy lớp, không phải kiến thức học thuật.",
  "authToken": "senior-or-admin-jwt-token"
}
```

API cho màn senior queue nếu FE gọi backend trực tiếp:

```http
GET /api/tutor/knowledge-candidates/pending
GET /api/tutor/knowledge-candidates/senior-pending
POST /api/tutor/knowledge-candidates/{id}/approve
POST /api/tutor/knowledge-candidates/{id}/reject
```

## 14. Course materials

### 14.1 List material

```http
GET /api/courses/{courseId}/materials?classId=SE1840
GET /api/courses/{courseId}/materials/{materialId}
```

### 14.2 Upload file

```http
POST /api/courses/{courseId}/materials/upload
Content-Type: multipart/form-data
```

FormData:

```js
const form = new FormData();
form.append('file', file);
form.append('title', title);
form.append('classId', classId || '');
form.append('teacherId', user.userId);
form.append('uploaderRole', user.role); // ADMIN or TEACHER
```

Scope:

| Uploader | classId | Ý nghĩa |
|---|---|---|
| ADMIN | optional/rỗng | Tài liệu dùng chung cho cả course |
| TEACHER | required | Tài liệu riêng lớp teacher đang dạy |

### 14.3 Import docs HTML bằng Table of Contents

FE không bắt thầy cô copy từng link chương thủ công.

Bước 1: Preview TOC

```http
POST /api/courses/{courseId}/materials/url-toc
```

```json
{
  "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/index.html"
}
```

Response có `items[]` gồm title/url/level. FE render tree/list checkbox.

Bước 2: Import selected chapters

```http
POST /api/courses/{courseId}/materials/import-url
```

```json
{
  "url": "https://docs.oracle.com/javase/specs/jvms/se8/html/index.html",
  "title": "JVM Spec SE8",
  "classId": "SE1840",
  "teacherId": "TEACHER_A",
  "uploaderRole": "TEACHER",
  "selectedUrls": [
    "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html",
    "https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-2.html"
  ],
  "followNext": false,
  "maxPages": 3
}
```

### 14.4 Reindex/delete/update

```http
PUT /api/courses/{courseId}/materials/{materialId}
DELETE /api/courses/{courseId}/materials/{materialId}
POST /api/courses/{courseId}/materials/reindex
POST /api/courses/{courseId}/materials/{materialId}/reindex
```

FE nên có nút reindex khi material upload/import thành công nhưng AI chưa tìm thấy nội dung.

## 15. Quiz

Có 2 loại quiz:

| Loại | Mục đích | Người review |
|---|---|---|
| Self Practice | Student tự ôn từ improve/topic | Không bắt buộc |
| Teacher Assignment Quiz | Teacher dùng AI tạo nháp rồi chỉnh/publish | Teacher review trước khi giao |

### 15.1 Self practice backend API

```http
POST /api/tutor/students/{studentId}/courses/{courseId}/quizzes/generate
```

```json
{
  "classId": "SE1840",
  "topic": "Encapsulation",
  "suggestionText": "Ôn lại Encapsulation trong OOP",
  "questionCount": 5
}
```

Submit:

```http
POST /api/tutor/quizzes/{quizSessionId}/submit
```

```json
{
  "answers": [
    { "questionId": "q1", "selectedAnswer": "A" }
  ]
}
```

List/detail:

```http
GET /api/tutor/students/{studentId}/courses/{courseId}/quizzes
GET /api/tutor/quizzes/{quizSessionId}
```

### 15.2 Teacher assignment quiz

```http
POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate
PUT /api/tutor/quiz-assignments/{assignmentId}
POST /api/tutor/quiz-assignments/{assignmentId}/publish
DELETE /api/tutor/quiz-assignments/{assignmentId}
GET /api/tutor/teachers/{teacherId}/quiz-assignments
GET /api/tutor/students/{studentId}/courses/{courseId}/quiz-assignments
POST /api/tutor/quiz-assignments/{assignmentId}/attempts
PUT /api/tutor/quizzes/{quizSessionId}/teacher-review
```

FE nghiệp vụ:

1. Teacher chọn course/class/topic.
2. AI tạo quiz nháp từ tài liệu.
3. Teacher sửa câu hỏi/đáp án/xóa câu không ổn.
4. Teacher publish cho cả lớp hoặc học sinh riêng.
5. Student làm quiz.
6. AI chấm tự động.
7. Teacher có thể review lại điểm/câu trả lời.

Nếu backend trả lỗi `Chưa có đủ tài liệu môn học để tạo quiz`, FE hiển thị rõ và gợi ý upload/reindex material.

### 15.3 n8n Quiz Generate/Submit

Nếu FE dùng workflow n8n:

```http
POST /webhook/quiz-generate
POST /webhook/quiz-submit
```

Payload generate:

```json
{
  "traceId": "trace-quiz-generate-001",
  "route": "STUDENT",
  "studentId": "student-id",
  "teacherId": "",
  "courseId": "PRO192",
  "classId": "SE1840",
  "title": "",
  "topic": "Encapsulation",
  "suggestionText": "Ôn lại Encapsulation trong OOP",
  "questionCount": 5,
  "authToken": "jwt-token"
}
```

`route` dùng `STUDENT` hoặc `TEACHER`, không dùng `SELF_PRACTICE` nếu Switch node đang route theo STUDENT/TEACHER.

## 16. Academic/course/class/student

### Course/Semester

```http
GET /api/courses
GET /api/courses/{courseId}
POST /api/admin/courses
PUT /api/admin/courses/{courseId}
DELETE /api/admin/courses/{courseId}
GET /api/admin/semesters
POST /api/admin/semesters
PUT /api/admin/semesters/{semesterCode}
DELETE /api/admin/semesters/{semesterCode}
```

### Class sections

```http
GET /api/courses/{courseId}/class-sections
GET /api/courses/{courseId}/class-sections/{classId}
POST /api/admin/courses/{courseId}/class-sections
PUT /api/admin/courses/{courseId}/class-sections/{classId}
DELETE /api/admin/courses/{courseId}/class-sections/{classId}
GET /api/teachers/{teacherId}/classes
```

### Enroll/import students

```http
GET /api/courses/{courseId}/class-sections/{classId}/students
POST /api/courses/{courseId}/class-sections/{classId}/students
DELETE /api/courses/{courseId}/class-sections/{classId}/students/{studentId}
GET /api/courses/class-sections/students/import/template.xlsx
```

Student import template gọn: chỉ cần mã sinh viên và tên sinh viên. Không cần email/phone/class name/semester.

## 17. Teacher import

Template:

```http
GET /api/mentors/import/template.csv
GET /api/mentors/import/template.xlsx
```

CSV gọn:

```csv
Code,Name,Email,Phone,Classes
GV001,Teacher A,teacher.a@university.edu,0900000001,"SE1840;SE1841"
```

Import:

```http
POST /api/mentors/import?dryRun=true
POST /api/mentors/import?dryRun=false
```

FormData:

```js
const form = new FormData();
form.append('file', file);
```

Backend tạo user role `TEACHER`, password hash từ `Phone`.

## 18. Assignment file flow

Project hiện không auto grade assignment. Teacher upload file bài tập, student nộp bài, teacher tự chấm.

```http
POST /api/mentor/courses/{courseId}/classes/{classId}/assignments
GET /api/mentor/courses/{courseId}/classes/{classId}/assignments
GET /api/assignments/{assignmentId}
PUT /api/mentor/assignments/{assignmentId}
DELETE /api/mentor/assignments/{assignmentId}
GET /api/students/{studentId}/assignments
POST /api/students/{studentId}/assignments/{assignmentId}/submissions
GET /api/mentor/assignments/{assignmentId}/submissions
GET /api/mentor/courses/{courseId}/classes/{classId}/submissions
PUT /api/mentor/submissions/{submissionId}/review
GET /api/assignments/{assignmentId}/file
GET /api/submissions/{submissionId}/file
```

AI có thể dùng điểm/weak topics để gợi ý học tập, nhưng điểm chính thức do teacher nhập/review.

## 19. Dashboards

Student:

```http
GET /api/students/{studentId}/dashboard
```

Teacher:

```http
GET /api/teachers/{teacherId}/dashboard
GET /api/teachers/{teacherId}/escalations/inbox
```

Admin:

```http
GET /api/admin/dashboard/stats
GET /api/admin/users
GET /api/admin/mentors
```

Không nối các API subscription/payment vào UI hiện tại.

## 20. n8n node Authorization mapping

FE gửi `authToken` trong body. Node normalize phải giữ lại `authToken`.

### Flow 1 Student Chat

Node `Set - Normalize Input` hoặc `Set - Trace Context` cần có:

```js
authToken: $json.body.authToken || (($json.headers.authorization || '').replace('Bearer ', '')) || ''
```

Mọi HTTP node gọi backend dùng:

```text
Authorization = Bearer {{$node["Set - Trace Context"].json.authToken}}
```

### Flow 2 Answer Review

```text
Authorization = Bearer {{$node["Set Normalize Review Input"].json.authToken}}
```

### Flow 3 Teacher Answer

```text
Authorization = Bearer {{$node["Set Teacher Answer Input"].json.authToken}}
```

### Flow 4 Senior Approval

```text
Authorization = Bearer {{$node["Set Approval Input"].json.authToken}}
```

### Flow 5 Quiz Submit

```text
Authorization = Bearer {{$node["Set - Normalize Quiz Submit"].json.authToken}}
```

### Flow 6 Quiz Generate

```text
Authorization = Bearer {{$node["Set: Normalize Quiz Generate Input"].json.authToken}}
```

Nếu node báo 403 rỗng, kiểm tra trước tiên token có vào node normalize chưa.

## 21. Error handling FE

| Lỗi | FE nên hiểu |
|---|---|
| `401 Unauthorized` | Chưa login/token hết hạn/token sai |
| `403 Forbidden` | Token đúng nhưng role không đủ quyền, hoặc n8n không truyền token vào backend |
| `400 question is required` | Field name sai, ví dụ `question ` có dấu cách |
| `index_not_found_exception` | Elasticsearch index chưa tạo hoặc chưa upload/reindex tài liệu |
| `Không có đủ tài liệu` | Cần upload/reindex material trước khi quiz/RAG trả lời |
| `LLM timeout/socket hang up` | Model provider lỗi/quá tải, cho retry hoặc escalate |
| Mojibake/ký tự lạ | Lỗi backend/n8n response encoding, không tự sửa bằng FE |

FE không nên lưu answer lỗi máy chủ vào UI như câu trả lời học tập. Nếu response `answer` chứa lỗi máy chủ, render dạng error state.

## 22. UI checklist theo role

### Student

- Login/register.
- Chọn course/class trước khi chat.
- Chat AI theo course.
- Code Mentor dùng chung chat webhook.
- Stop generating.
- Review answer.
- Xem trạng thái escalation.
- Pin/search chat message.
- Click improve suggestion để học tiếp.
- Pin improve suggestion vào checklist.
- Tự tạo/làm quiz ôn tập.
- Xem materials.
- Xem assignments/submissions/grades.
- Xem dashboard/improve plan.

### Teacher/Mentor

- Login bằng account import.
- Đổi password lần đầu.
- Xem courses/classes đang dạy.
- Upload material file cho lớp.
- Import docs HTML bằng TOC.
- Xem students/weak topics.
- Xem escalation inbox.
- Trả lời escalation.
- Tạo quiz bằng AI, sửa, publish.
- Tạo assignment file, xem submission, nhập điểm/feedback.

### Admin

- Dashboard system.
- Quản lý semester/course/class.
- Import teacher.
- Import/enroll students.
- Upload material dùng chung course.
- Xem users/mentors.
- Senior approval queue nếu admin kiêm senior.

## 23. Test nhanh cho FE

### Test login

1. Login lấy token.
2. Gọi `GET /api/users/profile` với Bearer token.
3. Nếu 401/403, kiểm tra token.

### Test n8n student chat

1. Publish workflow n8n.
2. Gửi `POST /webhook/student-chat` với `authToken`.
3. Vào n8n xem node `Set - Trace Context` có `authToken` không.
4. Nếu Intent Classifier 403, n8n chưa truyền Authorization vào backend.

### Test material/RAG

1. Upload material hoặc import URL.
2. Gọi list material xem có material.
3. Reindex nếu cần.
4. Hỏi câu có trong tài liệu.
5. Kiểm tra response có `sources` và confidence hợp lý.

### Test escalation callback

1. Hỏi câu AI không chắc để tạo escalation.
2. Teacher answer với `createKnowledgeCandidate=true` nếu là kiến thức học thuật.
3. Senior approve.
4. FE refetch conversation messages.
5. Câu trả lời mentor/senior-approved phải xuất hiện trong chat hoặc escalation detail chuyển `RESOLVED_INDEXED`.

### Test quiz

1. Upload đủ tài liệu.
2. Generate quiz từ topic.
3. Submit quiz.
4. Xem điểm/explanation.
5. Với teacher assignment quiz: teacher generate -> edit -> publish -> student attempt -> teacher review.
