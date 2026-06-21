# 05 – Hướng Dẫn Frontend (ai-tutor-frontend)

> **Mục đích:** Tổng hợp trạng thái hiện tại của FE — đã làm gì, đang làm gì, sẽ làm gì.  
> **Cập nhật lần cuối:** 2026-06-21  
> **Người cập nhật:** _(ghi tên vào đây mỗi khi sửa)_

---

## ✅ Đã Hoàn Thành

### 1. Xác Thực & Phân Quyền
- [x] Trang Login / Đăng ký — chọn role `STUDENT | TEACHER | ADMIN`
- [x] Lưu token + thông tin user vào `localStorage`
- [x] Điều hướng theo role sau khi đăng nhập

### 2. Portal Sinh Viên (`StudentPortal`)
- [x] **Chat AI** — gửi câu hỏi, nhận câu trả lời RAG từ backend
  - Input tự xóa ngay khi gửi (không đợi AI)
  - Typing indicator "AI Tutor đang soạn câu trả lời..." + nút **Dừng lại**
  - Bubble AI chỉ hiện khi có câu trả lời thực (không hiện placeholder "is thinking")
- [x] **Đánh giá câu trả lời** — Hữu ích / Không hữu ích / Góp ý (gọi `/api/tutor/answer-reviews`)
- [x] **Lịch sử session chat** — tạo mới, đổi tên, xoá
- [x] **Code Mentor** — phân tích code, debug (panel bên phải)
- [x] **Tiến trình học** (`LearningProgress`) — topics đã học, điểm yếu, đề xuất AI
- [x] **Edit Concepts** — modal chỉnh sửa memory học sinh (`PUT /api/tutor/students/.../memory`)
- [x] **Tài liệu & Bài tập** (`MaterialsAssignments`)
  - Tab Assignments: xem, tải, nộp bài
  - Tab Course Learning Materials: danh sách PDF môn học + nút Download
- [x] **Hỗ trợ giáo viên** (`MentorSupport`) — xem escalation, chat trực tiếp với giáo viên

### 3. Portal Giáo Viên (`TeacherPortal`)
- [x] **Lớp học** — danh sách class sections, heatmap kiến thức, danh sách sinh viên
- [x] **Tài liệu** — upload PDF → Elasticsearch RAG, Reindex, Delete
- [x] **Chấm bài** — xem submission, nhập điểm + phản hồi
- [x] **Câu hỏi khó (Escalations)** — xem inbox, trả lời, tạo KnowledgeCandidate
  - Toggle: đề xuất AI học câu trả lời hay không
  - Loại tri thức: Academic | Policy
- [x] **Duyệt câu trả lời AI** — Mentor queue + Senior queue
- [x] **Chat trực tuyến** — inbox chat 1-1 với sinh viên, đóng phòng chat

### 4. Portal Admin (`AdminPortal`)
- [x] Dashboard thống kê hệ thống
- [x] Quản lý người dùng (danh sách, tìm kiếm)
- [x] Quản lý học phần / lớp học (semester, course, class section)
- [x] **Ghi danh sinh viên** — tìm kiếm + đăng ký vào lớp (`/api/admin/enrollments`)
- [x] Chẩn đoán hệ thống (kiểm tra kết nối DB / ES / Ollama)

### 5. Tích Hợp n8n
- [x] `n8nClient.js` — fetch wrapper cho webhook
- [x] `n8nService.js` — `sendStudentChat()` gọi n8n flow
- [x] Fallback tự động: n8n offline → Spring Boot API local
- [x] Env toggle: `VITE_N8N_ENABLED=true/false`

### 6. Design System
- [x] FPT theme (cam `#F37021`) qua Ant Design token override
- [x] Glassmorphism dark mode (`index.css`)
- [x] Responsive layout (Splitter cho desktop, stack cho mobile)
- [x] Nút Refresh có màu cam (không bị trắng trên nền sáng)
- [x] Heatmap container không tràn layout
- [x] Placeholder Ant Design màu đẹp hơn
- [x] Typing indicator + Stop button trong chat

---

## 🚧 Đang Làm / Cần Kiểm Tra

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| n8n webhook deploy | ⏳ Chưa deploy | Hiện dùng `localhost:5678`, cần deploy production |
| Embedding Ollama | ✅ Fix xong | `ollama cp embeddinggemma:latest embeddinggemma` đã chạy |
| Backend Spring Boot | ✅ Đang chạy | Port 8085, IPv4 fix: `--ollama.base-url=http://127.0.0.1:11434` |
| Test end-to-end chat | ⏳ Chưa verify | Cần test lại sau khi fix embedding |

---

## 📋 Việc Cần Làm Tiếp Theo

> **Ghi chú:** Cập nhật mục này mỗi sprint / buổi làm việc.

### Tính Năng Còn Thiếu

- [ ] **Thông báo real-time** — hiện chỉ polling thủ công (bấm Refresh); cần WebSocket hoặc SSE
- [ ] **Upload file nhiều định dạng** — hiện chỉ PDF; cần thêm DOCX, PPTX
- [ ] **Dark/Light mode toggle** — hiện chỉ dark mode cứng
- [ ] **Phân trang chat** — khi nhiều session / tin nhắn
- [ ] **Tìm kiếm trong chat** — tìm theo keyword trong lịch sử hội thoại
- [ ] **Profile trang cá nhân** — xem/sửa thông tin user
- [ ] **Đổi mật khẩu** — hiện chưa có UI

### Cải Thiện UX

- [ ] Toast notification cho tất cả action (hiện còn thiếu một số)
- [ ] Loading skeleton thay cho spinner trắng
- [ ] Empty state đẹp hơn cho các bảng dữ liệu rỗng
- [ ] Confirm dialog nhất quán (hiện dùng `confirm()` native của browser)
- [ ] Form validation rõ ràng hơn (hiện chỉ `required` HTML)

### Kỹ Thuật / Nợ Kỹ Thuật

- [ ] Tách `App.jsx` (~1000 dòng) thành các custom hook riêng (`useChat`, `useTeacher`, v.v.)
- [ ] Thêm TypeScript (hoặc JSDoc đầy đủ)
- [ ] Unit test cho services (`api.js`, `normalizers.js`)
- [ ] E2E test cơ bản (Playwright hoặc Cypress)
- [ ] Optimize bundle size (lazy load từng Portal)

### Deploy

- [ ] Build production `npm run build`
- [ ] Deploy FE lên Railway / Vercel / Netlify
- [ ] Cấu hình `VITE_API_BASE_URL` trỏ về backend production
- [ ] SSL + domain

---

## 🗂 Liên Kết Tài Liệu Liên Quan

| File | Nội dung |
|------|----------|
| [07-cau-truc-du-an.md](./07-cau-truc-du-an.md) | Cây thư mục FE chi tiết |
| [01-chay-nhanh.md](./01-chay-nhanh.md) | Cách khởi chạy toàn bộ project |
| [03-api-dac-ta.md](./03-api-dac-ta.md) | Đặc tả API Spring Boot |
| [04-api-chi-tiet.md](./04-api-chi-tiet.md) | Hướng dẫn test API |
| [12-luong-nghiep-vu.md](./12-luong-nghiep-vu.md) | Luồng nghiệp vụ hệ thống |

---

## 📝 Nhật Ký Cập Nhật

| Ngày | Người | Nội dung |
|------|-------|---------|
| 2026-06-21 | — | Khởi tạo tài liệu, tổng hợp trạng thái hiện tại |
| | | |
