# Hướng dẫn FE chạy và demo AI Tutor Education

Tài liệu này là hợp đồng thao tác dành cho Web/Mobile FE. FE gọi HTTP để đọc hoặc thay đổi dữ liệu; WebSocket chỉ báo rằng dữ liệu đã đổi để FE cập nhật đúng phần màn hình, không bắt người dùng tải lại toàn trang.

## 1. Khởi tạo ứng dụng

1. Đăng nhập và lưu `accessToken`, `userId`, `role` trong auth store.
2. Dùng `Authorization: Bearer <JWT>` cho mọi API/Webhook được bảo vệ.
3. Mở đúng một kết nối `ws(s)://<API_HOST>/ws/events?token=<JWT>` sau khi đăng nhập.
4. Khi nhận event, cập nhật cache hoặc gọi lại API của widget liên quan; không dùng `window.location.reload()`.
5. Khi logout, đóng socket và xóa token/cache riêng của người dùng.

Role hợp lệ trong giao diện: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`. Mentor thông thường dùng role `TEACHER`; không có role `USER`.

## 2. Client WebSocket mẫu

```javascript
export function connectRealtime({ apiUrl, token, onEvent }) {
  const wsUrl = apiUrl.replace(/^http/, "ws") +
    `/ws/events?token=${encodeURIComponent(token)}`;
  let socket;
  let retry = 1000;
  let stopped = false;

  const open = () => {
    socket = new WebSocket(wsUrl);
    socket.onopen = () => { retry = 1000; };
    socket.onmessage = ({ data }) => onEvent(JSON.parse(data));
    socket.onclose = () => {
      if (!stopped) setTimeout(open, retry = Math.min(retry * 2, 30000));
    };
  };
  open();

  const ping = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
    }
  }, 25000);

  return () => {
    stopped = true;
    clearInterval(ping);
    socket?.close();
  };
}
```

Event có form chung:

```json
{
  "type": "GOLD_QA_SUBMITTED",
  "entityType": "GOLD_QA",
  "entityId": "...",
  "status": "PENDING_REVIEW",
  "timestamp": "2026-07-19T10:30:00",
  "data": {"courseId": "PRJ301", "usage": "TRAINING"}
}
```

WebSocket không phải nguồn dữ liệu chính. Sau reconnect hoặc F5, FE gọi GET để đồng bộ lại trạng thái từ Backend.

## 3. Kịch bản demo Tutor V2 theo vai trò

### Senior/Admin: phát hiện khoảng trống kiến thức

Mở Coverage Dashboard và gọi:

```http
POST /api/v2/expert-training/coverage/analyze
```

```json
{
  "courseId": "PRJ301",
  "chapters": ["Spring Boot Basics"],
  "minimumTrainingGoldPerChapter": 3,
  "minimumEvaluationGoldPerChapter": 2,
  "requestedBy": "<seniorId>",
  "createTasks": true
}
```

Sau đó tải `GET /api/v2/expert-training/coverage-gaps?courseId=PRJ301` và `GET /api/v2/expert-training/tasks?courseId=PRJ301`. Backend có thể tạo task `TRAINING` và `EVALUATION`; FE không tự tạo trạng thái giả.

### Teacher: nhận task và đóng góp

1. Task Board gọi `GET /api/v2/expert-training/tasks?status=OPEN`.
2. Nhấn **Nhận task**: `POST /api/v2/expert-training/tasks/{taskId}/assign` với `{"assigneeId":"<teacherId>"}`.
3. Task Gold Q&A gọi `POST /api/v2/expert-training/gold-qa`; task rubric gọi `POST /api/v2/expert-training/rubrics`.
4. Hiển thị trạng thái `PENDING_REVIEW`; teacher chưa được xem nó là kiến thức đã vào AI.

`usage=TRAINING` là dữ liệu được phép index sau khi Senior duyệt. `usage=EVALUATION` là bộ đề bí mật để test AI và tuyệt đối không index vào RAG.

### Senior/Admin: duyệt và đánh giá AI

1. Review Queue gọi `GET /api/v2/expert-training/gold-qa?courseId=PRJ301&status=PENDING_REVIEW`.
2. Approve/reject bằng `/gold-qa/{id}/approve|reject` hoặc rubric tương ứng.
3. Gold Q&A training được duyệt có trạng thái `INDEXED`; evaluation được duyệt có trạng thái `APPROVED` và `indexedAt=null`.
4. Chạy `POST /api/v2/expert-training/eval-runs`, sau đó mở chi tiết bằng `GET /api/v2/expert-training/eval-runs/{id}`.

Kịch bản demo dễ hiểu: Senior phát hiện thiếu kiến thức → giao task → Teacher soạn câu chuẩn → Senior duyệt → AI học phần training → Senior chạy bộ evaluation để chứng minh chất lượng.

## 4. Event realtime và hành động của FE

| Event | Người nhận | FE xử lý |
|---|---|---|
| `MATERIAL_INDEXING` | người upload | đổi badge thành Processing |
| `MATERIAL_INDEXED` | người upload | cập nhật item tài liệu, bật nút dùng RAG |
| `MATERIAL_INDEXING_FAILED` | người upload | hiện lỗi và nút thử lại |
| `ASSIGNMENT_ASSIGNED` | student được giao | refetch danh sách assignment |
| `ASSIGNMENT_SUBMITTED` | teacher sở hữu | refetch submission queue |
| `ASSIGNMENT_REVIEWED` | student nộp bài | refetch điểm/feedback |
| `AI_GRADING`, `AI_GRADING_COMPLETED`, `AI_GRADING_FAILED` | teacher | cập nhật trạng thái AI chấm gợi ý |
| `EXPERT_TASK_CREATED` | Teacher/Senior/Admin đang online | refetch Task Board |
| `EXPERT_TASK_ASSIGNED` | teacher được giao | refetch My Tasks |
| `GOLD_QA_SUBMITTED` | Senior/Admin | refetch Gold Q&A Review Queue |
| `RUBRIC_SUBMITTED` | Senior/Admin | refetch Rubric Review Queue |
| `GOLD_QA_APPROVED`, `GOLD_QA_REJECTED` | tác giả | refetch contribution và task |
| `RUBRIC_APPROVED`, `RUBRIC_REJECTED` | tác giả | refetch contribution và task |
| `ANSWER_REVIEW_NEEDS_MENTOR` | Teacher | refetch mentor-pending / inbox |
| `ANSWER_REVIEW_NEEDS_SENIOR` | Senior/Admin | refetch senior-pending queue |
| `EVAL_RUN_COMPLETED`, `EVAL_RUN_FAILED` | Senior/Admin | refetch Evaluation Dashboard |

Nên debounce/refetch theo `entityType` trong 200–500 ms để nhiều event liên tiếp không tạo bão request. Có thể cập nhật item trực tiếp từ `entityId`, nhưng vẫn nên refetch khi trạng thái ảnh hưởng số đếm dashboard.

## 5. Những màn hình không cần reset trang

- Upload tài liệu: giữ `materialId`, hiện progress card và chờ event index.
- Assignment của student: danh sách tự cập nhật khi teacher giao bài.
- Submission của teacher: hàng chờ tự xuất hiện khi student nộp.
- Điểm của student: badge và feedback tự đổi khi teacher review.
- AI grading: spinner chuyển thành suggested score khi hoàn tất.
- Tutor V2 Task Board/Review Queue/Evaluation Dashboard: refetch widget khi nhận event tương ứng.

Chat realtime dùng endpoint `/ws/chat`, tách biệt với `/ws/events`. Không gửi message chat vào `/ws/events`; endpoint events chỉ nhận `PING` từ client.

## 6. Flow education dùng khi demo

### Student học với AI và feedback

Student chat AI → nhận câu trả lời → đánh giá câu trả lời. Feedback mức cần chuyên gia xuất hiện ở dashboard Teacher/Senior. Chuyên gia mở feedback, trả lời và tạo candidate. Flow approve quyết định candidate nào được index vào RAG. Student chỉ nhận câu trả lời chuyên gia; đây không mặc định là phòng chat hai chiều liên tục.

### Quiz

- AI Quiz: n8n/AI tạo câu hỏi, student làm online, Backend chấm tự động, teacher review điểm cuối.
- Teacher Online Quiz: teacher tự nhập/import câu hỏi; student vẫn làm trực tiếp trên hệ thống.
- File Assignment: teacher giao DOCX/ZIP, student tải/nộp file; đây là nghiệp vụ riêng, không trộn vào quiz AI.

## 7. Quy tắc xử lý lỗi FE

- HTTP `401/403`: không retry vô hạn; refresh session hoặc đưa về login/forbidden.
- WebSocket mất kết nối: reconnect backoff và refetch dữ liệu màn hình hiện tại sau khi nhận lại `CONNECTED`.
- HTTP upload trả `202`: không reset form/list; thêm optimistic item bằng ID Backend trả về.
- Event đến hai lần: dùng `type + entityId + status` để xử lý idempotent.
- Không lưu JWT trong log, ảnh demo, request body n8n hoặc analytics.
- Không hiển thị đáp án quiz cho student trước khi Backend cho phép.
- Không dùng `aiSuggestedScore` làm điểm chính thức trước khi teacher xác nhận.

## 8. Checklist demo cho nhóm FE

1. Chuẩn bị bốn tài khoản: Student, Teacher, Senior và Admin.
2. Mở hai cửa sổ trình duyệt Teacher/Student để thấy assignment cập nhật realtime.
3. Mở Teacher/Senior để thấy Gold Q&A vừa nộp xuất hiện trong Review Queue không cần F5.
4. Upload một PDF và quan sát `PROCESSING → INDEXED`.
5. Chạy một evaluation và quan sát Evaluation Dashboard cập nhật.
6. Tắt mạng vài giây, bật lại và xác nhận socket reconnect + dữ liệu được refetch.
7. Chỉ dùng dữ liệu demo, không quay/chụp JWT hoặc thông tin sinh viên thật.

