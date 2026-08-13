# FE Guide - WebSocket, AI Quiz và Teacher Assignment/Exam

## 1. Ba nghiệp vụ tách biệt

### A. AI Quiz qua n8n

AI tạo câu hỏi từ RAG, Backend auto-grade. Giáo viên có thể tạo draft, sửa rồi giao cho cả lớp hoặc một số học sinh. Giữ nguyên flow n8n hiện tại.

### B. Teacher Online Quiz

Giáo viên tự nhập/import câu hỏi và đáp án, giao cho lớp, sinh viên chọn đáp án trực tiếp trên FE. Chế độ `TEACHER_MANUAL` chờ giáo viên chấm; `AI_ASSISTED` để Backend đối chiếu đáp án và đưa điểm gợi ý, giáo viên vẫn xác nhận điểm cuối.

### C. Teacher File Assignment

Giáo viên upload đề riêng dạng DOCX hoặc ZIP chỉ chứa DOCX, giao cho lớp, học sinh tải đề và nộp file. Giáo viên tự chấm. Không gọi AI, không đưa đề vào RAG và không đi qua n8n quiz.

### D. Course Material

PDF tài liệu học được upload rồi index vào RAG. Quá trình index chạy nền và phát trạng thái qua WebSocket.

## 2. WebSocket notification chung

Endpoint:

```text
ws://localhost:8085/ws/events?token=<JWT>
```

Production dùng `wss://`. FE nên mở một connection sau khi login và reconnect bằng exponential backoff khi mất mạng.

```javascript
const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(
  `${protocol}://${API_HOST}/ws/events?token=${encodeURIComponent(jwt)}`
);

ws.onmessage = ({ data }) => {
  const event = JSON.parse(data);
  switch (event.type) {
    case "MATERIAL_INDEXING":
      showMaterialStatus(event.entityId, "Đang xử lý");
      break;
    case "MATERIAL_INDEXED":
      showMaterialStatus(event.entityId, "Đã sẵn sàng");
      break;
    case "MATERIAL_INDEXING_FAILED":
      showMaterialError(event.entityId, event.data.indexingError);
      break;
    case "ASSIGNMENT_ASSIGNED":
      refreshStudentAssignments();
      break;
    case "ASSIGNMENT_SUBMITTED":
      refreshTeacherSubmissionQueue();
      break;
    case "ASSIGNMENT_REVIEWED":
      refreshStudentGrades();
      break;
  }
};

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "PING" }));
}, 25000);
```

Event chuẩn:

```json
{
  "type": "MATERIAL_INDEXED",
  "entityType": "COURSE_MATERIAL",
  "entityId": "...",
  "status": "INDEXED",
  "timestamp": "2026-07-18T21:00:00",
  "data": {"courseId": "PRJ301", "classId": "SE1840", "title": "Chapter 1"}
}
```

WebSocket không thay thế HTTP upload. FE vẫn upload bằng HTTP; response `202` cung cấp `materialId`, sau đó WebSocket cập nhật `PROCESSING/INDEXED/FAILED`. Nếu reload trang, FE gọi `GET /api/courses/{courseId}/materials/{materialId}` để phục hồi trạng thái và mở lại WebSocket. Nhờ vậy không cần reset thao tác chỉ vì màn hình reload.

## 3. AI Quiz: giáo viên tạo và giao cho lớp

1. Tạo draft bằng AI:

```http
POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate
Authorization: Bearer <teacher JWT>
```

2. Giáo viên sửa draft:

```http
PUT /api/tutor/quiz-assignments/{assignmentId}
```

3. Giao cả lớp:

```http
POST /api/tutor/quiz-assignments/{assignmentId}/publish
```

```json
{"targetType":"CLASS","targetStudentIds":[]}
```

Hoặc giao học sinh được chọn:

```json
{"targetType":"SELECTED_STUDENTS","targetStudentIds":["student-1","student-2"]}
```

4. Student lấy danh sách và làm bài:

```http
GET /api/tutor/students/{studentId}/courses/{courseId}/quiz-assignments?classId=SE1840
POST /api/tutor/quiz-assignments/{assignmentId}/attempts?studentId={studentId}
POST /api/tutor/quizzes/{quizSessionId}/submit
```

Backend auto-grade. Giáo viên xem attempts và xác nhận điểm cuối qua API teacher-review hiện có.

## 4. Teacher Online Quiz: làm bài trực tiếp trên hệ thống

Template JSON: `demo-data/teacher-online-quiz-template.json`.

Tạo draft không dùng AI generation:

```http
POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/manual
Authorization: Bearer <teacher JWT>
Content-Type: application/json
```

`gradingMode`:

- `TEACHER_MANUAL`: Backend chỉ lưu lựa chọn, không chấm và không trả đáp án; teacher nhập điểm cuối.
- `AI_ASSISTED`: Backend đối chiếu đáp án để tạo điểm gợi ý; teacher vẫn review/xác nhận.

Sau khi tạo draft, dùng API publish và student attempt/submit giống mục AI Quiz. Student làm hoàn toàn trên giao diện, không upload file bài làm.

## 5. Teacher File Assignment: giao DOCX/ZIP và nhận file bài làm

Upload multipart:

```http
POST /api/mentor/courses/{courseId}/classes/{classId}/assignments/upload
Authorization: Bearer <teacher JWT>
Content-Type: multipart/form-data
```

Fields:

| Field | Ý nghĩa |
|---|---|
| `teacherId` | ID giáo viên sở hữu lớp |
| `title` | Tên bài |
| `description` | Hướng dẫn |
| `assignmentType` | `ASSIGNMENT` hoặc `EXAM` |
| `maxScore` | Thang điểm, mặc định 10, tối đa 1000 |
| `targetType` | `ALL_CLASS` hoặc `SELECTED_STUDENTS` |
| `targetStudentIds` | CSV khi giao một số học sinh |
| `dueAt` | ISO-8601, ví dụ `2026-08-01T23:59:00` |
| `file` | Một DOCX hoặc một ZIP chỉ chứa DOCX |

ZIP được kiểm tra chống path traversal, tối đa 100 file và không chấp nhận loại file khác DOCX.

Ví dụ curl:

```bash
curl -X POST "$API/api/mentor/courses/PRJ301/classes/SE1840/assignments/upload" \
  -H "Authorization: Bearer $JWT" \
  -F "teacherId=$TEACHER_ID" \
  -F "title=Midterm Exam" \
  -F "assignmentType=EXAM" \
  -F "maxScore=100" \
  -F "targetType=ALL_CLASS" \
  -F "dueAt=2026-08-01T23:59:00" \
  -F "file=@midterm-docx-bundle.zip"
```

Student:

```http
GET /api/students/{studentId}/assignments?courseId=PRJ301
GET /api/assignments/{assignmentId}/file
POST /api/students/assignments/{assignmentId}/submit
```

Giáo viên xem submissions và tự chấm:

```http
GET /api/mentor/assignments/{assignmentId}/submissions?teacherId={teacherId}
PUT /api/mentor/assignment-submissions/{submissionId}/review
```

```json
{
  "teacherId": "<teacherId>",
  "score": 82,
  "teacherFeedback": "Trình bày tốt, cần bổ sung phần transaction.",
  "weakTopics": ["Spring Transaction"]
}
```

`score` được kiểm tra theo `maxScore` của đề, không còn cố định thang 10.

## 6. Form DOCX khuyến nghị

Hệ thống không parse file Teacher Exam thành câu hỏi AI. Vì vậy giáo viên có thể dùng bố cục tự do, nhưng để đồng nhất nên dùng:

```text
COURSE: PRJ301
CLASS: SE1840
TITLE: Midterm Exam
MAX SCORE: 100
DURATION: 90 minutes

INSTRUCTIONS
...

QUESTION 1 (20 points)
...

QUESTION 2 (30 points)
...

SUBMISSION REQUIREMENTS
- File name: StudentCode_FullName.docx
- Submit before due time
```

Nếu ZIP có nhiều file, nên đặt `01-Exam.docx`, `02-Data.docx`, `03-Instructions.docx`. Không đặt password cho DOCX/ZIP.

## 7. Tool tùy chọn: nhờ AI chấm file assignment

File workflow riêng: `n8n-import/AI-tutor-teacher-ai-grading.json`. Import và Publish để có webhook:

```http
POST /webhook/teacher-assignment-ai-grade
Authorization: Bearer <teacher JWT>
```

Trình tự:

1. Giáo viên tạo `ASSIGNMENT/EXAM` như phần 4.
2. Upload đáp án riêng, chỉ Backend và giáo viên được sử dụng:

```http
POST /api/mentor/assignments/{assignmentId}/answer-key?teacherId={teacherId}
Content-Type: multipart/form-data
file=<DOCX, PDF hoặc TXT>
```

3. Sau khi student nộp bài, FE gọi webhook:

```json
{"submissionId":"<submissionId>","teacherId":"<teacherId>"}
```

4. AI trả và lưu `aiGradingStatus`, `aiSuggestedScore`, `aiFeedback`. WebSocket gửi `AI_GRADING`, `AI_GRADING_COMPLETED` hoặc `AI_GRADING_FAILED` cho teacher.
5. Giáo viên đọc gợi ý, sửa nếu cần và gọi API review thủ công để lưu `score` chính thức.

File đáp án không có API download cho student, không index vào RAG và không được gửi trong assignment response dưới dạng nội dung. Phiên bản hiện tại hỗ trợ trích nội dung chấm AI từ DOCX, PDF text-based và TXT; PDF scan cần OCR ở giai đoạn sau.

## 8. Điều FE không được trộn

- Không gửi Teacher Exam vào webhook n8n quiz.
- Không index file đề thi vào RAG.
- Không hiển thị đáp án AI quiz cho student trước khi submit.
- Không để FE tự quyết định điểm cuối; Backend lưu điểm teacher review.
- Không reset form sau HTTP 202; giữ `entityId`, hiển thị trạng thái và chờ WebSocket.
- Không tự động biến `aiSuggestedScore` thành điểm chính thức; teacher phải xác nhận.
- Không dùng endpoint file assignment cho Teacher Online Quiz; online quiz lưu answer choices trong `QuizSession`.
