# 07 – Cấu Trúc Dự Án Frontend (ai-tutor-frontend)

> **Stack:** React 19 · Vite 8 · Ant Design 6 · Lucide React · Vanilla CSS  
> **Dev server:** `npm run dev` → `http://localhost:5173`  
> **API proxy:** `/api/*` → `http://localhost:8085` (cấu hình trong `vite.config.js`)

---

## Tổng Quan Thư Mục

```
ai-tutor-frontend/
├── docs/                        ← Tài liệu dự án (thư mục này)
├── public/                      ← Static assets (favicon, v.v.)
├── toad_mascot_3d/              ← 3D mascot assets (Spline)
├── src/                         ← Mã nguồn chính
│   ├── main.jsx                 ← Entry point — mount React app
│   ├── App.jsx                  ← Root component — state & handlers toàn cục
│   ├── App.css                  ← CSS riêng của App (layout chính)
│   ├── index.css                ← Design system toàn cục (tokens, utils, components)
│   │
│   ├── assets/                  ← Hình ảnh, icon tĩnh
│   │
│   ├── config/
│   │   └── navigation.js        ← Định nghĩa menu/sidebar cho từng role
│   │
│   ├── constants/
│   │   └── uiCopy.js            ← Tất cả chuỗi văn bản UI (i18n-ready)
│   │
│   ├── theme/
│   │   └── fptTheme.js          ← Ant Design token override (màu FPT #F37021)
│   │
│   ├── services/
│   │   ├── apiClient.js         ← fetch wrapper dùng chung (request, uploadRequest)
│   │   ├── api.js               ← Tất cả API calls tới backend Spring Boot
│   │   ├── normalizers.js       ← Chuẩn hoá dữ liệu BE → FE (normalize*)
│   │   ├── n8nClient.js         ← fetch wrapper cho n8n webhook
│   │   └── n8nService.js        ← Các hàm gọi n8n flow (student chat, v.v.)
│   │
│   ├── components/
│   │   ├── Header.jsx           ← Thanh header toàn cục (logo, user info, theme)
│   │   ├── Sidebar.jsx          ← Sidebar navigation (Ant Design Menu)
│   │   ├── Toast.jsx            ← Toast notification nhỏ (dùng trong dark mode)
│   │   ├── CanvasGraph.jsx      ← Biểu đồ canvas (knowledge graph)
│   │   ├── SplineAvatar.jsx     ← 3D avatar Spline (AI Tutor mascot)
│   │   └── common/
│   │       ├── PageHeader.jsx   ← Header section tái sử dụng (title + description)
│   │       ├── HelpText.jsx     ← Text hỗ trợ nhỏ
│   │       ├── StatusTag.jsx    ← Tag hiển thị trạng thái (PENDING, ACTIVE, …)
│   │       ├── StateBlock.jsx   ← Khối trạng thái rỗng / loading / lỗi
│   │       └── ResponsiveTwoPane.jsx ← Layout 2 cột responsive
│   │
│   └── pages/
│       ├── Login.jsx            ← Trang đăng nhập / đăng ký (3 role)
│       ├── AdminPortal.jsx      ← Portal Admin System
│       ├── TeacherPortal.jsx    ← Portal Giáo viên
│       ├── StudentPortal.jsx    ← Portal Sinh viên (router theo tab)
│       └── student/             ← Sub-components của StudentPortal
│           ├── ChatWorkspace.jsx      ← Giao diện chat AI chính
│           ├── ChatSessionsPanel.jsx  ← Danh sách lịch sử session chat
│           ├── CodeReviewPanel.jsx    ← Panel Code Mentor (phân tích code)
│           ├── TutorAvatarPanel.jsx   ← Panel avatar AI (Spline 3D)
│           ├── LearningProgress.jsx   ← Tiến trình học / memory editor
│           ├── MaterialsAssignments.jsx ← Tài liệu & bài tập môn học
│           ├── MentorSupport.jsx      ← Hỗ trợ từ giáo viên (escalation chat)
│           └── MentorSelectModal.jsx  ← Modal chọn giáo viên hỗ trợ
│
├── index.html                   ← HTML entry (Vite)
├── vite.config.js               ← Vite config + API proxy
├── package.json                 ← Dependencies
├── .env.local                   ← Biến môi trường local (VITE_API_BASE_URL, n8n)
└── eslint.config.js             ← ESLint config
```

---

## Luồng Dữ Liệu Chính

```
index.html
  └── main.jsx            mount <App />
        └── App.jsx       quản lý state toàn cục + handlers
              ├── Login.jsx          (chưa đăng nhập)
              ├── Header + Sidebar   (đã đăng nhập)
              └── Portal theo role:
                    ├── StudentPortal.jsx   ── student/*
                    ├── TeacherPortal.jsx
                    └── AdminPortal.jsx
```

---

## Phân Tầng Services

| File | Trách nhiệm |
|------|-------------|
| `apiClient.js` | `request()` / `uploadRequest()` — base fetch wrapper, xử lý lỗi HTTP |
| `api.js` | `apiService.*` — tất cả endpoint Spring Boot (auth, AI, materials, …) |
| `normalizers.js` | Chuyển đổi response BE sang shape FE (`normalizeEscalation`, v.v.) |
| `n8nClient.js` | Fetch wrapper riêng cho n8n webhook (timeout, error) |
| `n8nService.js` | `n8nService.sendStudentChat()` — gọi n8n flow AI |

---

## Cấu Hình Môi Trường (`.env.local`)

```env
VITE_API_BASE_URL=/api                    # Proxy → localhost:8085
VITE_N8N_ENABLED=true                     # Bật/tắt n8n flow
VITE_N8N_BASE_URL=http://localhost:5678   # n8n dev server
VITE_N8N_WEBHOOK_MODE=production          # test | production
```

> **Lưu ý:** Khi `VITE_N8N_ENABLED=true`, FE thử gọi n8n trước. Nếu n8n offline → fallback về Spring Boot API tự động.

---

## Role & Navigation

| Role | Portal | Tabs chính |
|------|--------|------------|
| **STUDENT** | `StudentPortal` | Chat AI · Tiến trình học · Tài liệu & Bài tập · Hỗ trợ giáo viên |
| **TEACHER** | `TeacherPortal` | Lớp học · Tài liệu · Chấm bài · Câu hỏi khó · Chat trực tuyến |
| **ADMIN** | `AdminPortal` | Dashboard · Người dùng · Học phần · Ghi danh · Hệ thống |

Navigation được định nghĩa tập trung tại `src/config/navigation.js`.

---

## Design System (`index.css`)

### CSS Variables (tokens)
```css
--color-primary:   #F37021   /* FPT Orange */
--color-secondary: #14B8A6   /* Teal */
--color-danger:    #EF4444   /* Red */
--color-bg:        #0F172A   /* Dark background */
--font-body:       'Inter', sans-serif
--font-heading:    'Outfit', sans-serif
```

### Các class quan trọng
| Class | Dùng cho |
|-------|----------|
| `.glass-card` | Card với hiệu ứng glassmorphism |
| `.glass-input-field` | Input field tối |
| `.btn-submit-form` | Nút submit gradient cam |
| `.btn-small-chat` | Nút nhỏ (Refresh, v.v.) — màu cam FPT |
| `.chat-bubble.user` / `.ai` | Bubble chat sinh viên / AI |
| `.heatmap-container` | Heatmap kiến thức giáo viên |
| `.data-table` | Bảng dữ liệu chung |
| `.badge-esc` | Badge trạng thái escalation |

### Ant Design Override
- Token override: `src/theme/fptTheme.js` (colorPrimary = #F37021)
- Placeholder, upload drag, table header: cuối `index.css` (section "Ant Design Placeholder & Upload Override")

---

## Các Component Đặc Biệt

### `ChatWorkspace.jsx`
- Input tự xóa ngay khi gửi (không đợi AI trả lời)
- `isAiLoading` → hiển thị typing indicator + nút **Dừng lại** (đỏ)
- Bubble AI chỉ render khi `!message.pending`
- Nút đánh giá: Hữu ích / Không hữu ích / Góp ý (gọi `POST /api/tutor/answer-reviews`)

### `LearningProgress.jsx`
- Hiển thị: Topics đã học · Điểm yếu · Đề xuất AI
- Modal "Edit Concepts" → cập nhật memory học sinh (`PUT /api/tutor/students/{id}/courses/{id}/memory`)

### `TeacherPortal.jsx`
- Tab Classes: Heatmap kiến thức lớp + danh sách sinh viên
- Tab Materials: Upload PDF → RAG (Elasticsearch) + Reindex + Delete
- Tab Escalations: Xử lý câu hỏi khó → tạo KnowledgeCandidate
- Tab Review: Duyệt câu trả lời AI do sinh viên đánh dấu sai

### `AdminPortal.jsx`
- Tab Enrollments: Ghi danh sinh viên vào lớp học
- Tab System Diagnostic: Kiểm tra kết nối DB / Elasticsearch / Ollama

---

## Chạy Dự Án

```bash
# Bước 1: Cài dependencies
cd "/Users/blaosak/Đồ Án 2/ai-tutor-frontend"
npm install

# Bước 2: Chạy dev server
npm run dev
# → http://localhost:5173

# Bước 3: Build production
npm run build
```

> **Yêu cầu:** Backend Spring Boot phải đang chạy tại `localhost:8085`  
> Xem hướng dẫn chạy đầy đủ: `AI-tutor/ai-tutor-api/RUN_PROJECT.md`
