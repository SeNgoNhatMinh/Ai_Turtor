# Tutor V2 - Hướng dẫn nghiệp vụ, API, n8n và kiểm thử

## 1. Phạm vi đã triển khai

Tutor V2 bổ sung vòng lặp chủ động:

`Phân tích độ phủ -> tạo Expert Task -> Teacher đóng góp -> Senior/Admin duyệt -> cập nhật RAG hoặc bộ holdout -> evaluation`

V2 không thay thế các flow education hiện tại. Chat, review câu trả lời, escalation mentor/senior, candidate và quiz vẫn hoạt động như trước.

- Phân tích thiếu dữ liệu theo môn và chương.
- Tạo riêng task `TRAINING` và task kiểm thử `EVALUATION`.
- Gold Q&A và rubric có quy trình chờ duyệt, duyệt hoặc từ chối.
- Tổng trọng số rubric phải bằng `1.0`.
- Chỉ Gold Q&A `TRAINING` đã duyệt mới được index vào RAG.
- Gold Q&A `EVALUATION` là holdout: lưu để test nhưng không index vào RAG.
- Evaluation lưu kết quả từng câu, điểm trung bình, hallucination và regression.
- Task thành `COMPLETED` khi đóng góp được duyệt; trở lại `IN_PROGRESS` khi bị từ chối.
- Coverage gap thành `RESOLVED` khi đủ dữ liệu; không tạo task trùng cho gap đang xử lý.

## 2. Vai trò

- `TEACHER`: chính là mentor mặc định; nhận task và đóng góp Gold Q&A/rubric.
- `SENIOR_MENTOR`: duyệt hoặc từ chối đóng góp, chạy evaluation.
- `ADMIN`: có toàn quyền tương đương senior trong V2.
- `STUDENT`: không truy cập dashboard chuyên gia V2.

Teacher tạo nội dung không tự đưa kiến thức vào AI. Senior/Admin là cổng kiểm soát chất lượng.

## 3. API Backend

Base URL local: `http://localhost:8085/api/v2/expert-training`

Mọi request cần `Authorization: Bearer <JWT_TOKEN>` và `Content-Type: application/json; charset=utf-8`.

| Method | Endpoint | Mục đích | Role |
|---|---|---|---|
| POST | `/coverage/analyze` | Phân tích độ phủ, tùy chọn tạo task | Senior/Admin |
| GET | `/coverage-gaps?courseId=PRJ301` | Danh sách gap | Teacher/Senior/Admin |
| POST | `/tasks` | Tạo task thủ công | Teacher/Senior/Admin |
| GET | `/tasks?status=&courseId=&assigneeId=` | Danh sách/lọc task | Teacher/Senior/Admin |
| POST | `/tasks/{id}/assign` | Nhận hoặc phân công task | Teacher/Senior/Admin |
| POST | `/gold-qa` | Nộp Gold Q&A | Teacher/Senior/Admin |
| GET | `/gold-qa?courseId=&usage=&status=` | Danh sách Gold Q&A | Teacher/Senior/Admin |
| POST | `/gold-qa/{id}/approve` hoặc `/reject` | Duyệt/từ chối Gold Q&A | Senior/Admin |
| POST | `/rubrics` | Nộp rubric | Teacher/Senior/Admin |
| GET | `/rubrics?courseId=PRJ301` | Danh sách rubric | Teacher/Senior/Admin |
| POST | `/rubrics/{id}/approve` hoặc `/reject` | Duyệt/từ chối rubric | Senior/Admin |
| POST | `/eval-runs` | Chạy đánh giá offline | Senior/Admin |
| GET | `/eval-runs?courseId=PRJ301` | Lịch sử đánh giá | Teacher/Senior/Admin |
| GET | `/eval-runs/{id}` | Run và kết quả từng câu | Teacher/Senior/Admin |

## 4. Dữ liệu mẫu

Phân tích coverage:

```json
{
  "courseId": "PRJ301",
  "chapters": ["Spring Boot Basics"],
  "minimumTrainingGoldPerChapter": 3,
  "minimumEvaluationGoldPerChapter": 2,
  "requestedBy": "<admin-or-senior-id>",
  "createTasks": true
}
```

Teacher nộp Gold Q&A:

```json
{
  "courseId": "PRJ301",
  "chapter": "Spring Boot Basics",
  "question": "Auto-configuration dùng để làm gì?",
  "goldAnswer": "Tự động cấu hình bean dựa trên dependency và cấu hình ứng dụng.",
  "difficulty": "MEDIUM",
  "usage": "TRAINING",
  "authorId": "<teacher-id>",
  "sourceTaskId": "<task-id>"
}
```

Để tạo holdout, đổi `usage` thành `EVALUATION`. FE phải cảnh báo dữ liệu này chỉ dùng đánh giá và không được index vào RAG.

Dữ liệu duyệt:

```json
{
  "reviewerId": "<senior-or-admin-id>",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewNote": "Nội dung chính xác và có thể sử dụng."
}
```

Rubric:

```json
{
  "courseId": "PRJ301",
  "chapter": "Spring Boot Basics",
  "name": "Rubric câu trả lời kỹ thuật",
  "description": "Đánh giá độ chính xác và bám tài liệu.",
  "criteriaWeights": {"accuracy": 0.6, "groundedness": 0.3, "guidance": 0.1},
  "authorId": "<teacher-id>",
  "sourceTaskId": "<task-id>"
}
```

Chạy evaluation:

```json
{
  "courseId": "PRJ301",
  "chapter": "Spring Boot Basics",
  "requestedBy": "<senior-or-admin-id>",
  "minimumPassScore": 0.5,
  "maximumHallucinationRate": 0.2
}
```

## 5. Workflow n8n V2

Import file `n8n-import/AI-tutor-v2-proactive-workflows.json`, sau đó mở workflow và chọn **Publish/Active**.

Luồng n8n V2:
- `POST /webhook/v2-gold-qa-submit` — lưu Gold Q&A + chấm AI → `EXAMINED` (Teacher giữ bài, chưa gửi Senior)
- `POST /webhook/v2-gold-qa-exam` — Teacher thi lại
- `POST /webhook/v2-gold-qa-send-review` — Teacher gửi Senior → `PENDING_REVIEW`
- `POST /webhook/v2-gold-qa-approve` — Senior nạp Gold Q&A vào RAG

Bắt đầu chương, reject, coverage, rubric và eval-run gọi thẳng Backend.

Khi gọi webhook n8n, JWT phải nằm trong HTTP header `Authorization: Bearer <JWT_TOKEN>`, không đặt trong JSON body. n8n chuyển tiếp header này sang Backend. Quyền role, trạng thái, tách training/holdout và index RAG đều do Backend quyết định.

## 6. Màn hình FE nên có

1. Coverage Dashboard: gap theo môn/chương, số training/evaluation còn thiếu.
2. Expert Task Board: lọc theo trạng thái, môn, người nhận; thao tác nhận task.
3. Contribution Editor: Gold Q&A/rubric; chọn rõ `TRAINING` hoặc `EVALUATION`.
4. Senior Review Queue: approve/reject, bắt buộc lý do khi reject.
5. Evaluation Dashboard: điểm, hallucination, regression và kết quả từng câu.

FE không tự chuyển trạng thái hay quyết định item nào vào RAG; luôn render theo response Backend.

## 7. Chạy và kiểm thử

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
Invoke-RestMethod http://localhost:8085/actuator/health
.\test-v2-proactive-flow.ps1
.\test-n8n-all-flows.ps1
```

Kết quả xác nhận trên Docker ngày 18/07/2026:

- Tutor V2 proactive: `11/11 PASS`.
- Regression education/n8n cũ: `16/16 PASS`.
- Unit test Maven cho training/holdout/rubric/evaluation: `PASS`.
- Backend health: `UP`.

Script gửi JSON bằng UTF-8 để giữ đúng tiếng Việt có dấu lẫn không dấu.

## 8. Phần để giai đoạn sau

- Scheduler tự động theo cron.
- Semantic cache.
- Preference ranking hoặc DPO dataset.
- LLM-as-a-judge nhiều model; MVP dùng cách chấm deterministic để test ổn định.
- Dashboard thống kê chất lượng chuyên gia nâng cao.

Các phần này có thể bổ sung sau mà không thay đổi hợp đồng API cốt lõi của Tutor V2.

## 9. Cách sử dụng flow V2 từ đầu đến cuối

### Bước 0 - Hiểu hai workflow đang Active

n8n cho phép nhiều workflow cùng Active. Workflow education cũ và Tutor V2 không xung đột vì mỗi webhook có path riêng:

- Flow cũ xử lý chat, student review, mentor/senior candidate và quiz.
- Flow V2 xử lý công việc chủ động của chuyên gia, Gold Q&A, rubric và evaluation.

Không nối dây trực tiếp giữa hai canvas. Backend và MongoDB là điểm liên kết dữ liệu giữa chúng.

### Bước 1 - Senior/Admin tìm phần kiến thức còn thiếu

Gọi `POST /webhook/v2-coverage-analyze`. Ví dụ:

```json
{
  "courseId": "PRJ301",
  "chapters": ["Spring Boot Basics"],
  "minimumTrainingGoldPerChapter": 3,
  "minimumEvaluationGoldPerChapter": 2,
  "requestedBy": "<ID SENIOR HOẶC ADMIN>",
  "createTasks": true
}
```

Nếu chương chưa đủ dữ liệu, Backend tạo một coverage gap và hai loại task:

- Task `TRAINING`: viết kiến thức AI được phép học sau khi duyệt.
- Task `EVALUATION`: viết câu bí mật để kiểm tra AI, không cho AI học.

### Bước 2 - Teacher xem và nhận task

FE gọi:

```http
GET /api/v2/expert-training/tasks?courseId=PRJ301&status=OPEN
```

Teacher nhấn **Nhận task**, FE gọi `POST /api/v2/expert-training/tasks/{taskId}/assign`:

```json
{
  "assigneeId": "<TEACHER ID>"
}
```

### Bước 3 - Teacher nộp nội dung

Với task Gold Q&A, gọi `POST /webhook/v2-gold-qa-submit`. Phải truyền đúng `sourceTaskId` và `usage` của task. Kết quả trở thành `EXAMINED` (chưa vào hàng Senior). Teacher xem kết quả, có thể `POST /webhook/v2-gold-qa-exam` để thi lại, rồi `POST /webhook/v2-gold-qa-send-review` để chuyển `PENDING_REVIEW`.

Với task rubric, gọi `POST /webhook/v2-rubric-submit`. Tổng các trọng số phải bằng `1.0`.

Teacher chỉ nộp nội dung; chưa có kiến thức nào được đưa vào RAG ở bước này.

### Bước 4 - Senior/Admin duyệt

Dashboard lấy hàng chờ bằng:

```http
GET /api/v2/expert-training/gold-qa?courseId=PRJ301&status=PENDING_REVIEW
GET /api/v2/expert-training/rubrics?courseId=PRJ301
```

Khi nhấn **Approve Gold Q&A**, gọi `POST /webhook/v2-gold-qa-approve`:

```json
{
  "goldQaId": "<GOLD QA ID>",
  "reviewerId": "<SENIOR ID>",
  "reviewerRole": "SENIOR_MENTOR",
  "reviewNote": "Đã đối chiếu giáo trình."
}
```

Kết quả khác nhau có chủ ý:

- `TRAINING` chuyển thành `INDEXED`: đã vào RAG.
- `EVALUATION` chuyển thành `APPROVED`: chỉ nằm trong bộ holdout.
- Task nguồn chuyển thành `COMPLETED`.

Nếu muốn từ chối, FE gọi trực tiếp API `/gold-qa/{id}/reject` hoặc `/rubrics/{id}/reject`. Nội dung quay lại xử lý và không vào RAG.

### Bước 5 - Senior/Admin chạy evaluation

Sau khi đã có holdout được duyệt, gọi `POST /webhook/v2-eval-run`. Backend đưa từng câu hỏi holdout cho AI hiện tại, so kết quả với gold answer và lưu một `EvalRun` cùng các `EvalResult`.

Xem kết quả:

```http
GET /api/v2/expert-training/eval-runs?courseId=PRJ301
GET /api/v2/expert-training/eval-runs/{evalRunId}
```

### Bước 6 - Lặp lại vòng cải thiện

Senior xem câu điểm thấp hoặc hallucination, tạo thêm task training phù hợp, teacher bổ sung kiến thức, senior duyệt rồi chạy evaluation lại. Đây chính là vòng co-training của Tutor V2.

## 10. Test thủ công nhanh trong n8n

1. Đảm bảo Backend ở `http://localhost:8085` và n8n ở `http://localhost:5678`.
2. Workflow V2 phải ở trạng thái Active.
3. Đăng nhập API để lấy JWT và đặt nó trong header `Authorization: Bearer <JWT>` ở mọi webhook request.
4. Gọi Production URL; không dùng Test URL nếu chưa bấm **Listen for test event**.
5. Chạy theo thứ tự: coverage -> lấy task -> submit Gold Q&A/rubric -> approve -> eval.
6. Kiểm tra execution của từng HTTP Request node phải trả HTTP 200.

Không gửi một ID tự nghĩ ra: `taskId`, `goldQaId`, `rubricId` và `evalRunId` phải lấy từ response của bước trước.

JWT không còn nằm trong body. Tuy vậy n8n vẫn có thể lưu request headers trong execution data. Không chia sẻ execution chứa token thật; production nên giới hạn người truy cập n8n và cấu hình không lưu successful execution.
