# FE + n8n Integration Quick Guide

File này là bản nhanh cho FE. File đầy đủ cần đọc là:

```text
FRONTEND_N8N_PROJECT_GUIDE.md
```

## Base URLs

```env
VITE_API_BASE_URL=http://localhost:8085
VITE_N8N_BASE_URL=http://localhost:5678
```

Backend API dùng JWT header:

```http
Authorization: Bearer <token>
```

n8n webhook nên nhận token qua body:

```json
{
  "authToken": "<JWT token>"
}
```

Sau đó n8n HTTP Request node gọi backend thêm header:

```text
Authorization = Bearer {{$node["Set - Trace Context"].json.authToken}}
```

Với các flow khác thì dùng node normalize tương ứng, xem chi tiết trong `FRONTEND_N8N_PROJECT_GUIDE.md`.

## FE gọi backend trực tiếp

| Màn hình | API nhóm |
|---|---|
| Auth/Profile | `/api/users/**` |
| Course/Semester/Class | `/api/courses/**`, `/api/admin/**`, `/api/academic/**` |
| Course materials | `/api/courses/{courseId}/materials/**` |
| HTML docs TOC/import | `/api/courses/{courseId}/materials/url-toc`, `/import-url` |
| Conversation history/search/pin | `/api/ai/conversations/**` |
| Student memory/improve pin | `/api/tutor/students/{studentId}/courses/{courseId}/memory/**` |
| Click improve suggestion | `/api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn` |
| Quiz CRUD/submit/review | `/api/tutor/**quizzes**`, `/api/tutor/**quiz-assignments**` |
| Dashboard | `/api/students/{id}/dashboard`, `/api/teachers/{id}/dashboard`, `/api/admin/dashboard/stats` |
| Assignment | `/api/mentor/**assignments**`, `/api/students/**assignments**` |

Không nối subscription/payment vào UI hiện tại.

## FE gọi n8n webhook

| Flow | Production URL | Mục đích |
|---|---|---|
| Student Chat | `/webhook/student-chat` | RAG Tutor, Code Mentor, Escalation routing |
| Answer Review | `/webhook/answer-review` | Student/human review answer |
| Teacher Answer | `/webhook/teacher-answer` | Mentor trả lời escalation |
| Senior Approval | `/webhook/senior-knowledge-approval` | Senior duyệt knowledge candidate vào RAG brain |
| Quiz Generate | `/webhook/quiz-generate` | AI tạo quiz từ tài liệu |
| Quiz Submit | `/webhook/quiz-submit` | Submit/chấm quiz qua harness nếu FE dùng workflow |

Khi test trong n8n editor thì đổi `/webhook/...` thành `/webhook-test/...`.

## Payload Student Chat

```json
{
  "traceId": "trace-uuid",
  "sessionId": "session-uuid",
  "conversationId": "conversation-uuid",
  "studentId": "user-id-from-login",
  "studentName": "Nguyen Van A",
  "courseId": "PRO192",
  "classId": "SE1840",
  "message": "OOP là gì?",
  "codeSnippet": "",
  "authToken": "<JWT token>"
}
```

Nếu hỏi code thì điền `codeSnippet`, vẫn dùng webhook student-chat.

## Response Student Chat

```json
{
  "success": true,
  "mode": "RAG",
  "answer": "...",
  "confidence": 0.87,
  "escalated": false,
  "conversationId": "conversation-uuid",
  "traceId": "trace-uuid",
  "sources": []
}
```

Nếu `escalated=true`, FE hiển thị trạng thái chờ mentor và lưu `questionEscalationId` để xem detail.

## Escalation callback mới

Khi mentor trả lời và senior approve knowledge candidate:

1. Backend index kiến thức vào RAG brain.
2. Backend đổi escalation sang `RESOLVED_INDEXED`.
3. Backend tự append câu trả lời vào conversation nếu escalation có `conversationId`.
4. FE chỉ cần refetch messages hoặc poll escalation detail.

API student xem trạng thái:

```http
GET /api/tutor/escalations/{id}
GET /api/tutor/escalations/history?studentId={studentId}&courseId={courseId}
```

## HTML docs material import

FE flow đúng:

1. Teacher/admin nhập URL index docs.
2. FE gọi `POST /api/courses/{courseId}/materials/url-toc`.
3. Render table of contents để chọn chương.
4. FE gửi `selectedUrls` vào `POST /api/courses/{courseId}/materials/import-url`.

Không bắt teacher copy từng URL chương thủ công.

## Quan trọng cho FE

- Render UTF-8, không tự sửa mojibake.
- Format confidence: `Math.round(confidence * 100) + '%'`.
- Dùng `AbortController` cho nút dừng AI.
- Mỗi course có conversation riêng.
- Nếu response trả conversationId mới thì chuyển sang conversation mới.
- Improve suggestions: click một lần để học tiếp, hoặc pin vào improve plan.
- Code Mentor không hiển thị như lời giải full assignment.
- Nếu n8n Respond node lỗi JSON, xem `N8N_RESPONSE_FIX_SNIPPETS.md`.
