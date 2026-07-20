# FE n8n Three-Workflow Integration Verification

## 1. Scope

Ngày xác minh: `2026-07-19`.

Mục tiêu của lần kiểm tra này là xác nhận frontend kết nối đúng ba workflow n8n đang Active, không trộn nghiệp vụ, không gửi JWT trong JSON body và không tự tạo trạng thái thành công khi chưa có dữ liệu canonical từ Spring Boot.

Nguồn đối chiếu chính:

- `AI-tutor-workflow-runtime-fixed.json`
- `AI-tutor-teacher-ai-grading.json`
- `AI-tutor-v2-proactive-workflows.json`
- `FE_EDUCATION_DEMO_AND_REALTIME_GUIDE_VI.md`
- `FE_WEBSOCKET_TEACHER_EXAM_GUIDE_VI.md`
- `TUTOR_V2_IMPLEMENTATION_AND_TEST_GUIDE_VI.md`
- Workflow được export trực tiếp từ container `ai-tutor-n8n`.

## 2. Runtime Workflow Inventory

Container n8n thực tế có đúng ba workflow và cả ba đều `ACTIVE`:

| Workflow | Webhook đang Active |
|---|---|
| Education Core | `student-chat`, `answer-review`, `teacher-answer-escalation`, `senior-resolve-answer-review`, `senior-knowledge-approval`, `quiz-generate`, `quiz-submit` |
| Teacher AI-assisted Grading | `teacher-assignment-ai-grade` |
| Tutor V2 Proactive Expert Co-Training | `v2-coverage-analyze`, `v2-gold-qa-submit`, `v2-rubric-submit`, `v2-gold-qa-approve`, `v2-rubric-approve`, `v2-eval-run` |

Ba workflow dùng chung một n8n base URL nhưng có webhook path riêng nên không xung đột. FE không cần ba n8n client hoặc ba WebSocket connection.

## 3. FE Routing And Feature Flags

| Nhóm nghiệp vụ | FE gateway/service | Cờ bắt buộc |
|---|---|---|
| Chat, answer review, teacher answer, senior review/approval | `n8nService` và feature controller tương ứng | `VITE_N8N_ENABLED=true` |
| AI Quiz generate/submit | `quizGateway` | `VITE_N8N_ENABLED=true`, `VITE_N8N_QUIZ_ENABLED=true` |
| Assignment AI grading | `assignmentGradingGateway` | `VITE_N8N_ENABLED=true`, `VITE_N8N_ASSIGNMENT_GRADING_ENABLED=true` |
| Tutor V2 mutations | `expertTrainingGateway` | `VITE_N8N_ENABLED=true`, `VITE_N8N_TUTOR_V2_ENABLED=true` |

Local development đã bật đủ ba nhóm workflow. `VITE_N8N_STRICT=true` giữ request trên n8n khi workflow được bật và tránh replay mutation qua Backend sau lỗi không chắc chắn.

Tutor V2 reject vẫn gọi Backend trực tiếp vì workflow V2 hiện không cung cấp reject webhook. Đây là hành vi có chủ ý, không phải thiếu integration.

## 4. Changes Applied

1. Bật `VITE_N8N_TUTOR_V2_ENABLED=true` trong `.env.local`.
2. Thêm `VITE_N8N_TUTOR_V2_TIMEOUT_MS=300000`.
3. Tutor V2 evaluation dùng timeout riêng `300000ms`, khớp timeout node n8n.
4. `postN8n` mặc định chỉ gửi JWT trong `Authorization: Bearer ...`.
5. JWT không còn được copy vào JSON body của Education Core, Quiz, Assignment Grading hoặc Tutor V2.
6. Giữ `includeAuthTokenInBody=true` như một tùy chọn compatibility explicit, nhưng runtime hiện tại không sử dụng.
7. Không đổi webhook path, business payload hoặc response normalizer.

## 5. WebSocket Boundary

- FE kết nối một socket xác thực tới `/ws/events?token=<JWT>`.
- WebSocket đi trực tiếp tới Spring Boot, không đi qua n8n.
- Event chỉ kích hoạt refetch API canonical cho material, assignment, AI grading và Tutor V2.
- FE không dựng kết quả thành công từ event và không dùng `window.location.reload()`.

## 6. Verification Results

| Kiểm tra | Kết quả |
|---|---|
| Backend `http://localhost:8085/actuator/health` | `200`, `UP` |
| n8n `http://localhost:5678/healthz` | `200` |
| MongoDB container | Running |
| Elasticsearch container | Running, healthy |
| n8n container | Running |
| Export workflow runtime | `3/3 ACTIVE`, webhook paths khớp FE |
| CORS preflight từ `http://localhost:5173` | `3/3 PASS`, HTTP `204`; cho phép `POST`, `authorization`, `content-type` |
| Focused n8n client/service/gateway tests | `13/13 PASS` |
| Contract tests | `67/67 PASS` |
| Unit/component tests | `47/47 PASS` |
| ESLint | PASS |
| Production build | PASS |
| Dead-code scan | PASS |
| Playwright desktop/mobile | `10/10 PASS` |
| `git diff --check` | PASS |

Không chạy các mutation business live như tạo coverage gap, approve Gold Q&A hoặc chạy evaluation bằng dữ liệu thật trong lần xác minh này vì chúng thay đổi MongoDB/RAG. Các mutation này cần test fixture và tài khoản Teacher/Senior/Admin dành riêng cho demo. Contract, transport, active workflow, route và UI integration đã được kiểm tra.

CORS được kiểm tra bằng `OPTIONS` trên một webhook đại diện của từng workflow: `student-chat`, `teacher-assignment-ai-grade` và `v2-coverage-analyze`. Cả ba trả `Access-Control-Allow-Origin: http://localhost:5173` và cho phép header `authorization,content-type`.

## 7. Backend Documentation Drift

Các tài liệu cũ cần được chỉnh để tránh FE dùng sai path:

- `TUTOR_V2_IMPLEMENTATION_AND_TEST_GUIDE_VI.md` vẫn ghi "hai workflow đang Active"; runtime hiện có ba.
- `FRONTEND_N8N_INTEGRATION_GUIDE.md` và `FRONTEND_N8N_PROJECT_GUIDE.md` còn nhắc `/teacher-answer`; path executable là `/teacher-answer-escalation`.
- `EDUCATION_DEMO_RENDER_GUIDE_VI.md` còn nhắc `/senior-review-resolution`; path executable là `/senior-resolve-answer-review`.
- Hướng dẫn legacy còn đề xuất `authToken` trong body; workflow hiện tại đều hỗ trợ và nên dùng `Authorization` header.

## 8. Demo Checklist

1. Restart Vite sau khi thay đổi `.env.local`.
2. Đăng nhập bằng đúng role nghiệp vụ: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
3. Kiểm tra Network: mutation AI phải tới `localhost:5678/webhook/...` khi cờ tương ứng bật.
4. Kiểm tra request body không có `authToken`; header phải có `Authorization`.
5. Kiểm tra response có business `success/status`, không chỉ HTTP `200`.
6. Kiểm tra trạng thái cuối bằng API Spring Boot hoặc UI canonical sau refetch.
7. Với Tutor V2, xác nhận `TRAINING -> INDEXED` và `EVALUATION -> APPROVED` holdout.
8. Với AI grading, xác nhận `aiSuggestedScore` không tự trở thành điểm cuối.
