# Báo Cáo Live Test Tutor V2 - 2026-07-22

## Phạm vi

- FE: `http://localhost:5173`
- Spring Boot: `http://localhost:8085`
- n8n production webhooks: `http://localhost:5678`
- Course Tutor V2: `PRJ301`
- Nhãn dữ liệu: `FE DEMO 20260722-2235`
- Tất cả mutation được thực hiện từ UI thật. Không có mock, fallback thành công hoặc ghi trực tiếp vào database.
- Dữ liệu trong báo cáo được giữ lại để rà soát.

Không ghi password, JWT hoặc credential n8n trong tài liệu này.

## Kết quả Tutor V2

### Chapter canonical

| Chapter | Chapter key | Trạng thái |
|---|---|---|
| Java Memory | `fe-demo-20260722-2235-java-memory` | `CONFIRMED` |
| Exception Handling | `fe-demo-20260722-2235-exception-handling` | `CONFIRMED` |
| Collections | `fe-demo-20260722-2235-collections` | `CONFIRMED` |

Senior/Admin đã tạo hai task `TRAINING` và `EVALUATION` cho mỗi chapter. Teacher tự nhận việc và submit qua n8n.

| Task | ID | Kết quả cuối |
|---|---|---|
| Java Memory - Training | `6a60e125d3d8fa3e4b5e6c46` | `COMPLETED` |
| Java Memory - Evaluation | `6a60e125d3d8fa3e4b5e6c47` | `COMPLETED` |
| Exception Handling - Training | `6a60e127d3d8fa3e4b5e6c49` | `COMPLETED` |
| Exception Handling - Evaluation | `6a60e127d3d8fa3e4b5e6c4a` | `COMPLETED` |
| Collections - Training | `6a60e129d3d8fa3e4b5e6c4c` | `COMPLETED` |
| Collections - Evaluation | `6a60e129d3d8fa3e4b5e6c4d` | `SUBMITTED`, chờ duyệt bản sửa |
| Rubric chất lượng | `6a60e17cd3d8fa3e4b5e6c4e` | `COMPLETED` |

### Contribution và review

| Contribution | ID | Usage | Trạng thái |
|---|---|---|---|
| Heap và Stack | `6a60e1aad3d8fa3e4b5e6c4f` | `TRAINING` | `INDEXED` |
| Garbage Collector | `6a60e1d9d3d8fa3e4b5e6c50` | `EVALUATION` | `APPROVED`, không index RAG |
| Checked/unchecked exception | `6a60e1ddd3d8fa3e4b5e6c51` | `TRAINING` | `INDEXED` |
| finally | `6a60e1e1d3d8fa3e4b5e6c52` | `EVALUATION` | `APPROVED`, không index RAG |
| ArrayList/LinkedList | `6a60e1e4d3d8fa3e4b5e6c53` | `TRAINING` | `INDEXED` |
| HashMap - bản ban đầu | `6a60e1e8d3d8fa3e4b5e6c54` | `EVALUATION` | `REJECTED` |
| HashMap - bản sửa | `6a60e393d3d8fa3e4b5e6c56` | `EVALUATION` | `PENDING_REVIEW` |
| Rubric | `6a60e1ffd3d8fa3e4b5e6c55` | Rubric | `APPROVED` |

Bản HashMap ban đầu bị reject vì thiếu collision, bucket và treeification. Teacher nhìn thấy rejection reason, sửa nội dung và submit lại. Bản sửa được cố ý giữ `PENDING_REVIEW` để kiểm tra queue.

### Evaluation

- Run ID: `6a60e3aad3d8fa3e4b5e6c57`
- Trạng thái canonical: `FAILED`, UI hiển thị `Chưa đạt`.
- Test cases: `3`; passed: `0`.
- Average score: `0.3324`.
- Hallucination rate: `0.3333`.
- `error=null`: đây là không đạt threshold, không phải lỗi thực thi.
- Canonical run hoàn tất sau khoảng 22 giây. Webhook `/webhook/v2-evaluation-run` không trả response cho client trước timeout 300 giây. FE không retry mutation và sau reload hiển thị đúng run canonical.

## Student/n8n persistence

Student seed đăng nhập qua FE và FE nhận đúng enrollment `OOP / OOP-01`.

| Dữ liệu | ID/trạng thái |
|---|---|
| Conversation encapsulation | `392152c5-ce32-4746-86e9-7a16ea6d21cc` |
| Escalation encapsulation | `d02ce179-236b-4171-b520-40aa03baf6aa` |
| Conversation polymorphism | `adf199b4-3321-49ba-87f8-446b77638c0e` |
| Escalation polymorphism | `2c34b4f5-f3a8-4d26-84b3-ff42fb645176` |
| Pinned assistant message | `9034069f-c183-4ce7-bbaa-3ff91cc9f239`, giữ `1/3` sau logout/login |
| Missing-material answer review | `fdd49e86-630d-4c77-89d5-df447baec3e3`, `NEEDS_SENIOR_REVIEW` |

Review cuối đang hiển thị trong Admin `Kiểm duyệt phản hồi AI` và được giữ chưa xử lý.

## Lỗi FE phát hiện và đã sửa

1. Rubric `Form.List` spread `key` và tạo duplicate React keys. Đã tách `key` khỏi field props và thêm regression test.
2. Confirm card tự đóng khi window scroll/resize, làm action khó bấm. Đã giữ confirm ổn định; Escape/click overlay vẫn đóng.
3. n8n `student-chat` trả ID tạm dạng `conversation-*`, trong khi REST lưu UUID canonical. FE trước đây dùng ID tạm và gọi pinned endpoint `404` cho đến khi reload.
4. FE hiện refetch conversation list, reconcile ID tạm sang UUID canonical, tải canonical messages và chỉ sau đó mới mở pin/feedback. Live retest không còn `404` hoặc console error.

## Webhook đã kiểm tra

- `student-chat`: `200`, ESCALATE, sau đó reconcile REST canonical.
- `answer-review`: `200`, review vào `NEEDS_SENIOR_REVIEW`.
- `v2-gold-qa-submit`: `200` cho 7 lần submit/resubmit.
- `v2-rubric-submit`: `200`.
- `v2-gold-qa-approve`: `200`.
- `v2-rubric-approve`: `200`.
- `v2-evaluation-run`: canonical BE hoàn tất, nhưng n8n Respond node không trả response cho FE.

## Cách rà soát trên UI

1. Admin -> `Huấn luyện tri thức AI` -> course `PRJ301`.
2. `Công việc`: xem 6 task hoàn tất và task Collections holdout đang submitted.
3. `Nội dung & kiểm duyệt`: xem bản HashMap mới đang chờ duyệt; thư viện giữ cả bản reject.
4. `Evaluation`: mở run `6a60e3aad3d8fa3e4b5e6c57`.
5. Teacher -> `Huấn luyện tri thức AI` -> course `PRJ301`: xem ownership và rejection/resubmit state.
6. Student -> `Trò chuyện AI Tutor` -> course `OOP`: mở conversation `[FE LIVE CANONICAL 20260722]`; pinned bar hiển thị `1/3`.
7. Admin -> `Kiểm duyệt phản hồi AI`: xem review thiếu tài liệu gắn marker `[FE LIVE 20260722]`.

## Evidence

Screenshot được lưu trong `test-results/direct-fe/`, gồm:

- `live-admin-created-tasks.png`
- `live-teacher-all-submitted.png`
- `live-admin-review-decisions.png`
- `live-teacher-resubmitted.png`
- `live-final-review-queue.png`
- `live-final-library.png`
- `live-final-evaluation.png`
- `live-final-teacher-work.png`
- `live-student-canonical-reconcile.png`
- `live-student-pin-persisted.png`
- `live-student-answer-review.png`
- `live-admin-answer-review-queue.png`

`test-results` là artifact cục bộ và không được commit.

## Quality gate

- `npm run check`: pass.
- Contract tests: `92/92`.
- Component/unit tests: `86/86`.
- Production build: pass.
