# AI Tutor Platform API

Backend Spring Boot cho nền tảng AI Tutor dành cho sinh viên đại học.

Project này được refactor có kiểm soát từ hệ thống Legal RAG cũ sang domain giáo dục. Java package hiện vẫn giữ `com.ragapi` để tránh phá cấu trúc project, nhưng domain nghiệp vụ hiện tại là **AI Tutor Platform**.

## 1. Trạng Thái Project Hiện Tại

Đã có các nghiệp vụ chính:

- Quản lý user, profile, login/register cơ bản để test trực tiếp, chưa bật JWT.
- Quản lý semester, course, class section, enrollment.
- Import mentor/teacher bằng Excel.
- Import học sinh vào lớp bằng Excel.
- Teacher/mentor upload tài liệu môn học: PDF/DOCX/PPT/PPTX tùy extractor hiện có.
- RAG search theo `courseId`, không search global toàn hệ thống.
- `classId` là context lớp học, optional ở upload material và không còn là scope bắt buộc của RAG.
- Student Course Memory theo `studentId + courseId`.
- AI Tutor query theo 3 hướng: RAG Tutor, Code Mentor, Escalate.
- Code Mentor hỗ trợ debug/hint, không làm hộ full assignment/project.
- Escalation khi AI không chắc hoặc câu hỏi cần teacher xác nhận.
- Teacher answer escalation nhưng không tự động đưa vào AI brain.
- KnowledgeCandidate chỉ được index vào Elasticsearch sau khi senior mentor/admin approve.
- Student/Human review dưới mỗi câu trả lời AI qua `AiAnswerReview`.
- Dashboard cơ bản cho student/teacher/admin.
- Assignment flow cơ bản: teacher upload bài tập, student submit, teacher tự review/nhập điểm.

Chưa nhấn mạnh hoặc chưa làm sâu:

- Chưa có AI tự chấm assignment.
- Chưa bật JWT vì đang ưu tiên test API trực tiếp.
- n8n workflow cần dựng bên n8n theo tài liệu harness, backend chỉ cung cấp API.

## 2. Kiến Trúc Tổng Quan

```text
Frontend
   |
   v
n8n AI Harness
   |
   v
Spring Boot API
   |
   |-- MongoDB: dữ liệu nghiệp vụ
   |-- Elasticsearch: vector index/RAG Brain
   |-- Ollama Embedding: tạo embedding
   |-- OpenRouter/OpenAI-compatible LLM: sinh câu trả lời
```

Trong đề tài này, n8n đóng vai trò **AI Harness**: nhận request từ frontend, lấy memory, phân loại intent, chọn flow RAG Tutor/Code Mentor/Escalate, rồi gọi Spring Boot API.

Spring Boot là backend service layer và source of truth. Backend giữ business rule, persistence, RAG index, escalation, review và approval.

## 3. Flow AI Tutor Chính

```text
Student Chat Webhook
 -> Set Input
 -> Get Student Course Memory
 -> Intent Classifier
 -> Switch Mode
    -> RAG_TUTOR: Course RAG Query -> Confidence Check -> Improve -> Update Memory -> Respond
    -> CODE: Code Mentor Query -> Update Memory -> Respond
    -> ESCALATE: Create Escalation -> Notify Teacher -> Respond
```

Sau khi student nhận answer, frontend nên hiển thị review:

```text
[Đúng] [Sai] [Hữu ích] [Không hữu ích] [Góp ý]
```

Review không làm AI tự học ngay. Nếu là tri thức học thuật cần bổ sung, hệ thống đi qua:

```text
AiAnswerReview / Teacher Answer
 -> KnowledgeCandidate
 -> Senior Mentor/Admin Approval
 -> Elasticsearch
 -> RAG Brain
 -> AI Tutor dùng ở lần sau
```

## 4. Quy Tắc Chống Spam RAG Brain

Không đưa vào brain:

- Deadline, submit trễ.
- Điểm, rubric, quyết định chấm bài.
- Quy định riêng của lớp.
- Assignment-specific decision.
- Feedback “AI sai” nhưng chưa được mentor/senior xác minh.

Chỉ đưa vào brain:

- Tri thức học thuật có thể tái sử dụng.
- Sửa lỗi tài liệu học thuật.
- FAQ học thuật chung của môn học.

## 5. API Nhóm Chính

### User/Profile

```http
POST /api/users/register
POST /api/users/login
GET  /api/users/{userId}/profile
PUT  /api/users/{userId}/profile
```

### Academic/Admin

```http
POST /api/admin/semesters
GET  /api/admin/semesters
POST /api/admin/courses
GET  /api/admin/courses
POST /api/admin/class-sections
GET  /api/courses/{courseId}/class-sections
GET  /api/mentors/{teacherId}/class-sections
GET  /api/students/{studentId}/courses
```

### Import

```http
GET  /api/mentors/import/template.xlsx
POST /api/mentors/import?dryRun=true
POST /api/mentors/import?dryRun=false

GET  /api/admin/class-sections/students/import/template.xlsx
POST /api/admin/class-sections/{courseId}/{classId}/students/import?dryRun=true
POST /api/admin/class-sections/{courseId}/{classId}/students/import?dryRun=false
```

### Course Material / RAG

```http
POST /api/courses/{courseId}/materials/upload
GET  /api/courses/{courseId}/materials
GET  /api/courses/{courseId}/materials/{materialId}/pdf
POST /api/courses/{courseId}/materials/{materialId}/reindex
DELETE /api/courses/{courseId}/materials/{materialId}
```

Upload material dùng `multipart/form-data`:

| Field | Required | Ghi chú |
|---|---:|---|
| `file` | Có | PDF/DOCX/PPT/PPTX |
| `title` | Có | Tên tài liệu |
| `teacherId` | Có | Mentor/teacher upload |
| `classId` | Không | Context lớp, optional |

### AI Tutor / Code Mentor / Memory

```http
POST /api/tutor/intent-classify
POST /api/ai/query
POST /api/code-mentor/query
POST /api/code-mentor/upload
GET  /api/tutor/students/{studentId}/courses/{courseId}/memory
PUT  /api/tutor/students/{studentId}/courses/{courseId}/memory
POST /api/tutor/improve-suggestions
```

### Escalation / Human Review / AI Learning

```http
POST /api/tutor/escalations
POST /api/tutor/escalations/offer
POST /api/tutor/escalations/{id}/answer
GET  /api/tutor/escalations/teachers/{teacherId}

POST /api/tutor/answer-reviews
GET  /api/tutor/answer-reviews/mentor-pending
GET  /api/tutor/answer-reviews/senior-pending
POST /api/tutor/answer-reviews/{id}/senior-resolve

GET  /api/tutor/knowledge-candidates/senior-pending
POST /api/tutor/knowledge-candidates/{id}/approve
POST /api/tutor/knowledge-candidates/{id}/reject
```

### Assignment

```http
POST /api/mentor/courses/{courseId}/classes/{classId}/assignments/upload
GET  /api/mentor/courses/{courseId}/classes/{classId}/assignments
GET  /api/students/{studentId}/assignments
POST /api/students/assignments/{assignmentId}/submit
GET  /api/mentor/assignments/{assignmentId}/submissions
PUT  /api/mentor/submissions/{submissionId}/review
```

### NVIDIA Magpie TTS

TTS chạy qua backend, không gọi NVIDIA từ React và không cần model local:

```http
GET    /api/tts/voices?courseId={courseId}&classId={classId}
POST   /api/tts/synthesize
```

Sinh viên chọn trực tiếp một giọng tiếng Việt trong catalog NVIDIA mà API trả về và gửi
`providerVoiceId` khi yêu cầu tạo audio. Không còn cấu hình profile giọng theo giáo viên.

Cấu hình tối thiểu phải đặt ở môi trường server (không commit giá trị key):

```dotenv
TTS_ENABLED=true
TTS_PROVIDER=nvidia-magpie
NVIDIA_API_KEY=
```

Xem các biến endpoint, language, sample rate, cache voice và giới hạn chunk trong `.env.deploy.example`.

## 6. Tài Liệu Quan Trọng

- `N8N_HARNESS_TRACE_AND_ERROR_HANDLING.md`: n8n trace context, retry, error logging, fallback handling, and debugging by traceId.
- `N8N_HARNESS_FLOW_AFTER_IMPROVEMENTS.md`: sơ đồ và hướng dẫn dựng n8n AI Harness.
- `N8N_LOCAL_DOCKER_GUIDE.md`: hướng dẫn chạy n8n local bằng Docker và chuyển workflow từ n8n Cloud.
- `FRONTEND_N8N_INTEGRATION_GUIDE.md`: hướng dẫn Frontend kết nối các webhook n8n local.
- `AI_TUTOR_PLATFORM_GUIDE.md`: nghiệp vụ backend/frontend và human learning.
- `HUONG_DAN_TEST_API_AI_TUTOR.md`: hướng dẫn test Swagger/Postman/n8n.
- `TEST_N8N_HARNESS_FLOWS_1_4.md`: end-to-end n8n test guide for Student Chat, Answer Review, Teacher Answer, and Senior Approval flows.
- `TEST_FLOW_AI_TUTOR_AFTER_IMPROVEMENTS.md`: checklist test ngắn theo flow demo.

## 7. Chạy Project

Swagger:

```text
http://localhost:8085/swagger-ui.html
```

Chạy bằng Maven:

```bash
mvn spring-boot:run
```

File cấu hình local:

```text
config/application-local.yml
```

File local này không nên commit API key lên repository.

## 8. Ghi Chú Encoding

Tài liệu `.md` được lưu UTF-8. Nếu PowerShell hiển thị tiếng Việt bị lỗi, hãy mở bằng IntelliJ hoặc VS Code với encoding UTF-8.

## LLM Fallback va Quiz Sanitizer

Backend dung OpenRouter theo co che primary/fallback:

- `openrouter.model`: model chinh.
- `openrouter.fallback.model`: model du phong.
- Fallback chi kich hoat khi model chinh gap loi tam thoi nhu rate limit, timeout, upstream 5xx hoac overloaded.

Quiz generator co buoc sanitize sau khi parse JSON tu LLM. Cac field `questionText`, `options`, `correctAnswer`, `explanation` se duoc loc ky tu script la neu model chen nham vao tieng Viet.

Bien moi khi deploy:

```env
OPENROUTER_FALLBACK_ENABLED=true
OPENROUTER_FALLBACK_API_KEY=...
OPENROUTER_FALLBACK_MODEL=openai/gpt-oss-120b:free
OPENROUTER_FALLBACK_TIMEOUT_SECONDS=60
OPENROUTER_FALLBACK_MAX_RETRIES=0
```
