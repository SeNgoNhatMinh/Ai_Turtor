# Frontend Update Log

File này dùng để ghi lại mọi thay đổi mới của frontend AI Tutor. Mỗi lần cập nhật UI, API integration, bug fix, refactor hoặc cấu hình FE, hãy thêm một entry mới ở đầu file.

## Cách Ghi Log

Copy template này lên đầu phần `History` sau mỗi lần cập nhật:

```md
### YYYY-MM-DD - Tên cập nhật ngắn

**Summary**
- Mô tả ngắn mục tiêu thay đổi.

**Changed**
- File/feature đã sửa.
- API/helper đã thêm hoặc đổi.

**Tested**
- `npm run build`: pass/fail.
- Manual flow đã test.

**Notes**
- Rủi ro còn lại, việc cần làm tiếp, hoặc phụ thuộc backend.
```

## History

### 2026-06-27 - Safe Architecture Refactor Slice 1

**Summary**
- Bắt đầu refactor architecture theo hướng production nhưng giữ runtime hiện tại để tránh lỗi path/import.

**Changed**
- `src/App.jsx`: bỏ duplicate helper thuần, import lại từ `src/utils/storage.js` và `src/utils/formatters.js`.
- `src/utils/formatters.js`: thêm `normalizeAppRole`.
- `src/hooks/useStudentEnrollmentOptions.js`: tách logic load enrollment + tạo course/class options khỏi `App.jsx`.
- `src/services/authApi.js`: tách auth API khỏi `apiService` facade, gọi HTTP trực tiếp.
- `src/services/api.js`: giữ compatibility facade `apiService.login/register` trỏ sang `authApi`.

**Tested**
- `npm run build`: pass sau từng lát nhỏ.
- Safety scan runtime không thấy import `react-router-dom`, `zustand`, `@tanstack/react-query`, hoặc `axios`.

**Notes**
- Chưa chuyển `main.jsx` sang `src/app/Router.jsx`.
- Chưa cài dependency mới.
- Chưa move page/component folder lớn để tránh lỗi đường dẫn.

### 2026-06-27 - Easier Confirm Dialog Interaction

**Summary**
- Chỉnh confirm dialog dùng chung để dễ nhìn và dễ bấm hơn.

**Changed**
- `src/components/common/confirmDialog.jsx`: thêm overlay click-outside-to-close và `aria-modal=true`.
- `src/index.css`: confirm dialog chuyển sang modal nhỏ giữa màn, có backdrop mờ, nút lớn hơn; mobile dùng nút full width.

**Tested**
- `npm run build`: pass.

**Notes**
- Confirm vẫn là component chung cho delete/action, không dùng `window.confirm`.

### 2026-06-27 - Course Material Upload Refresh And Confirm Cleanup

**Summary**
- Sửa lỗi upload material phải refresh trang mới thấy tài liệu và confirm delete material bị nổi sai sang màn khác.

**Changed**
- `src/services/apiClient.js`: `uploadRequest` nhận options để truyền timeout riêng.
- `src/services/api.js`: tăng timeout upload material lên 60s vì backend có thể vừa upload vừa index tài liệu.
- `src/pages/admin/AdminAcademic.jsx`: sau upload material, FE poll lại danh sách nhiều lần để bắt kịp backend xử lý async/index chậm.
- `src/pages/admin/AdminAcademic.jsx`: cleanup confirm dialog khi rời Admin Academic để popup delete không còn nổi sang chat.
- `src/components/common/confirmDialog.jsx`: export `closeActiveConfirm`.
- `src/index.css`: thêm style cho confirm dialog dùng chung, nhỏ gọn và ổn định ở góc phải.

**Tested**
- `npm run build`: pass.

**Notes**
- Nếu backend vẫn timeout nhưng đã lưu material, FE sẽ tự refresh lại danh sách trong vài giây thay vì bắt user reload trang.

### 2026-06-27 - Admin Academic Actions And Enrollment Search Fix

**Summary**
- Sửa Course Materials action dropdown và làm Student Enrollment search dễ dùng hơn trong Admin Academic.

**Changed**
- `src/pages/admin/AdminAcademic.jsx`: material actions giờ lấy ID bền hơn từ `id`, `_id`, hoặc `materialId`; thêm guard nếu material thiếu ID.
- `src/pages/admin/AdminAcademic.jsx`: Student Enrollment search trim input, hỗ trợ nhập user ID/email/student code tốt hơn bằng cách resolve qua admin users khi direct search không có kết quả.
- `src/pages/admin/AdminAcademic.jsx`: thêm loading cho nút Search, `allowClear`, row key bền hơn cho enrollment/material tables.

**Tested**
- `npm run build`: pass.

**Notes**
- Backend enrollment endpoint vẫn cần `studentId` đúng là user id thật. FE chỉ hỗ trợ resolve thêm qua admin users API khi người dùng nhập email/code.

### 2026-06-27 - Student Chat Enrollment Select Fix

**Summary**
- Sửa lỗi chat student không hiển thị course/class đã enroll dù backend đã trả enrollment đúng.

**Changed**
- `src/App.jsx`: load `GET /api/academic/students/{studentId}/enrollments`, tạo `courseOptions` và `classOptions`, tự chuyển course/class sang enrollment hợp lệ khi selection cũ không còn đúng.
- `src/pages/StudentPortal.jsx`: truyền `courseOptions/classOptions` xuống chat.
- `src/pages/student/ChatWorkspace.jsx`: bỏ hard-code `PRJ301/DBI202` và `SE1840/SE1841` làm nguồn chính; Select giờ render theo enrollment thật, chỉ fallback khi BE không có dữ liệu.

**Tested**
- `npm run build`: pass.
- Kiểm tra BE local: `GET /api/academic/students/e44e1b6c-12c3-40c2-ad15-f75a6272125f/enrollments` trả các lớp `OOP-01`, `DSA-01`, `WEBDEV-02`, `AI101-01`.

**Notes**
- Nếu một student vẫn không thấy lớp sau fix này, cần kiểm tra student đó có được enroll bằng đúng `userId` backend trả khi login hay không; enroll nhầm email/studentCode thay vì `userId` sẽ khiến endpoint trả rỗng.

### 2026-06-27 - Document Mojibake LLM Error For Backend

**Summary**
- Ghi nhận lỗi AI chat trả text mojibake khi LLM unavailable hoặc user gõ sai chính tả.

**Changed**
- `docs/BE_FIX_REQUESTS_FROM_FE.md`: thêm yêu cầu BE sửa encoding UTF-8/error contract cho lỗi AI/LLM, ví dụ `Lá»—i mÃ¡y chá»§...`.

**Tested**
- Documentation-only change.

**Notes**
- FE chưa thấy hard-code chuỗi mojibake; lỗi nhiều khả năng đến từ BE response hoặc tầng gọi LLM.

### 2026-06-27 - Backend Fix Request Document

**Summary**
- Thêm tài liệu trong FE repo để ghi các lỗi backend đang ảnh hưởng trực tiếp đến UI/flow.

**Changed**
- `docs/BE_FIX_REQUESTS_FROM_FE.md`: liệt kê lỗi admin account, class section/enrollment, material upload timeout, quiz timeout, course-scoped conversation, pinned message persistence, và error contract.

**Tested**
- Documentation-only change.

**Notes**
- File này nằm trong frontend `docs/` nhưng dành cho BE team đọc và fix theo endpoint/behavior.

### 2026-06-27 - Remove Babylon Login Background

**Summary**
- Bỏ BabylonJS khỏi login để tránh lỗi Vite dependency scan khi `@babylonjs/core` không có trong `node_modules`.

**Changed**
- `src/pages/Login.jsx`: bỏ lazy import và render `LoginBabylonBackground`.
- `src/components/LoginBabylonBackground.jsx`: xóa component Babylon không còn dùng.
- `src/index.css`: xóa style `.login-babylon-canvas`.
- `package.json` / `package-lock.json`: gỡ dependency `@babylonjs/core`.

**Tested**
- `rg "LoginBabylonBackground|@babylonjs|babylon"`: không còn kết quả.
- `npm run build`: pass.

**Notes**
- Login vẫn giữ nền CSS sáng/cam nhẹ và robot mascot, chỉ bỏ canvas 3D Babylon.

### 2026-06-25 - Keep Suggestion Visible After Unpin

**Summary**
- Sửa lỗi bỏ ghim pinned suggestion làm item biến mất khỏi danh sách.

**Changed**
- `src/App.jsx`: khi unpin, nếu suggestion không còn trong danh sách thường thì thêm lại vào `suggestions`.
- Thêm helper so khớp suggestion theo text để tránh duplicate.

**Tested**
- `npm run build`: pass.

**Notes**
- Hành vi mới: pinned item sau khi bỏ ghim sẽ rơi xuống danh sách suggestion thường.

### 2026-06-25 - Move Pinned Suggestions To Top

**Summary**
- Đưa pinned suggestions lên đầu danh sách study suggestions trong Learning Progress.

**Changed**
- `src/pages/student/LearningProgress.jsx`: tạo `orderedSuggestions` để render pinned trước, suggestion thường sau và tránh duplicate.
- `src/index.css`: thêm style nổi bật nhẹ cho pinned suggestion ở light/dark mode.

**Tested**
- `npm run build`: pass.

**Notes**
- Nếu pinned suggestion không còn nằm trong danh sách suggestions hiện tại, UI vẫn tạo item pinned riêng để người dùng thấy ngay ở đầu.

### 2026-06-25 - Stabilize Refresh for Pinned Suggestions

**Summary**
- Sửa tiếp lỗi refresh làm mất pinned suggestion do UI context/user/course bị reset hoặc API trả thiếu pinned list.

**Changed**
- `src/App.jsx`: persist profile UI an toàn vào `sessionStorage` sau khi bỏ token/password.
- `src/App.jsx`: persist `activeRole`, `activeTab`, `courseId`, `classId`, `isDarkMode` để refresh không đổi context.
- `src/App.jsx`: thêm local mirror cho pinned suggestions theo `studentId + courseId`, merge với backend memory/dashboard khi load.
- `src/App.jsx`: pin/unpin đồng bộ local mirror và backend response.

**Tested**
- `npm run build`: pass.

**Notes**
- Local mirror chỉ là fallback UI, backend memory API vẫn là nguồn lưu chính.

### 2026-06-25 - Persist Pinned Items After Refresh

**Summary**
- Sửa lỗi pinned suggestions/pinned chat messages bị mất sau khi refresh trang.

**Changed**
- `src/App.jsx`: khi load student dashboard, luôn merge thêm dữ liệu từ student memory để giữ `pinnedImproveSuggestions`.
- `src/pages/student/ChatWorkspace.jsx`: đổi key pin tin nhắn sang dạng ổn định theo nội dung khi message chưa có id.
- `src/services/normalizers.js`: giữ `id`, `userMessageId`, `assistantMessageId` khi pair lịch sử chat từ backend.

**Tested**
- `npm run build`: pass.

**Notes**
- Pin suggestion được lưu bằng backend memory API.
- Pin tin nhắn chat hiện lưu local theo browser/session; nếu cần đồng bộ đa thiết bị thì backend cần endpoint riêng cho pinned chat messages.

### 2026-06-25 - Keep Pinned Suggestions After Pinning

**Summary**
- Sửa lỗi pin study suggestion xong item biến mất khỏi `Learning Progress`.

**Changed**
- `src/App.jsx`: sau khi pin/unpin, dùng response từ memory API để cập nhật `studentDashboard.pinnedImproveSuggestions` tại chỗ.
- Không gọi reload dashboard ngay sau pin/unpin vì dashboard endpoint có thể không trả lại `pinnedImproveSuggestions`.

**Tested**
- `npm run build`: pass.

**Notes**
- Đây là pin improve suggestion trong Learning Progress, khác với pin tin nhắn trong AI chat.

### 2026-06-25 - Shadcn-Inspired Learning Progress Dashboard

**Summary**
- Chuẩn hoá UI/UX `LearningProgress` theo hướng shadcn-inspired: neutral cards, hierarchy rõ, ít màu hơn, dashboard logic theo course memory.

**Changed**
- `src/pages/student/LearningProgress.jsx`: refactor layout thành các tầng `Course memory snapshot`, `Review queue`, stats, knowledge map, knowledge profiler, action plan.
- `src/index.css`: thêm class `learning-*` cho dashboard responsive và dark mode.
- Giữ các field chính theo backend guide: `learnedTopics`, `weakTopics`, `improveSuggestions`, `pinnedImproveSuggestions`, dashboard stats.

**Tested**
- `npm run build`: pass.

**Notes**
- Không thêm dependency shadcn/tailwind mới; áp dụng visual pattern để tránh đổi stack frontend hiện tại.

### 2026-06-25 - Remove Orange Sidebar Active Line

**Summary**
- Bỏ line cam ở đầu item đang active trong main sidebar.

**Changed**
- `src/index.css`: bỏ `box-shadow: inset 3px 0 0 #F37021` ở selected sidebar menu item.

**Tested**
- `npm run build`: pass.

**Notes**
- Vẫn giữ background xám cho item active để người dùng biết đang ở màn nào.

### 2026-06-25 - Remove Orange Tab Lines

**Summary**
- Bỏ line/gạch cam trên đầu tab và dưới tab label trong app để giao diện bớt rối, chuyên nghiệp hơn.

**Changed**
- `src/index.css`: ẩn Ant Design tab ink bar trong app container.
- `src/index.css`: đổi border/background của card tabs sang neutral gray thay vì cam.

**Tested**
- `npm run build`: pass.

**Notes**
- Không đổi màu login hero.

### 2026-06-25 - Backend Role Normalization Fix

**Summary**
- Sửa lỗi login thành công nhưng giao diện trống do backend trả role chữ hoa như `ADMIN`, trong khi FE render bằng role chữ thường như `admin`.

**Changed**
- `src/App.jsx`: normalize role `ADMIN/STUDENT/TEACHER/MENTOR` về `admin/student/teacher`.
- `src/components/Header.jsx`: check quyền admin không phụ thuộc chữ hoa/thường.
- `src/config/navigation.js`: normalize role trước khi render sidebar.

**Tested**
- `npm run build`: pass.
- FE root `http://localhost:5173/`: trả `200`.

**Notes**
- Nếu browser còn giữ state cũ qua HMR, hard refresh `Cmd + Shift + R`.

### 2026-06-25 - Student Pin Suggestions, Admin Materials, Mentor Choice

**Summary**
- Cập nhật FE theo backend mới cho 3 flow: ghim mục cần ôn, admin upload tài liệu course-wide, và chọn mentor từ escalation offer.

**Changed**
- `src/services/api.js`: thêm `pinImproveSuggestion`, `unpinImproveSuggestion`, cập nhật `getCourseMaterials(courseId, classId)`.
- `src/services/studentApi.js`: export helper pin/unpin.
- `src/services/normalizers.js`: giữ `pinnedImproveSuggestions` trong student dashboard state.
- `src/App.jsx`: load course materials theo `classId`, thêm handler pin/unpin suggestion.
- `src/pages/StudentPortal.jsx`: truyền pinned props vào `LearningProgress`, gọi `offerEscalation` trước khi chọn mentor.
- `src/pages/student/LearningProgress.jsx`: hiển thị `Pinned review items`, thêm nút `Pin/Pinned`.
- `src/pages/student/MentorSupport.jsx`: hỗ trợ trạng thái `MENTOR_MATCHING`.
- `src/pages/student/MentorSelectModal.jsx`: hiển thị match reason, rating, response time, specializations.
- `src/pages/admin/AdminAcademic.jsx`: admin material upload gửi `uploaderRole=ADMIN`.

**Tested**
- `npm run build`: pass.

**Notes**
- BE hiện có endpoint pin improve suggestion, chưa thấy endpoint pin từng chat message riêng.

### 2026-06-25 - Admin Student Import UI

**Summary**
- Thêm giao diện admin import sinh viên vào class section bằng Excel.

**Changed**
- `src/pages/admin/AdminAcademic.jsx`: thêm tab `Import Students`.
- UI hỗ trợ tải template, chọn course/class, upload `.xlsx/.xls`, `Validate Only`, và `Import Students`.
- Hiển thị kết quả import gồm total rows, success count, error count, success/error messages.

**Tested**
- `npm run build`: pass.

**Notes**
- Endpoint dùng:
  - `GET /api/admin/class-sections/students/import/template.xlsx`
  - `POST /api/admin/class-sections/{courseId}/{classId}/students/import?dryRun=true|false`

### 2026-06-25 - Admin-Owned Course Materials And Friendly Errors

**Summary**
- Đồng bộ FE với flow tài liệu chung do admin quản lý và cải thiện lỗi API thân thiện hơn.

**Changed**
- `src/pages/admin/AdminAcademic.jsx`: thêm tab `Course Materials` cho admin upload/list/download/reindex/delete tài liệu course-wide.
- `src/pages/TeacherPortal.jsx`: teacher material tab chuyển sang read-only cho tài liệu chung, vẫn giữ assignment flow.
- `src/services/httpClient.js`: thêm `userMessage`, map lỗi `500/502/503/504` sang thông báo thân thiện.
- `src/services/apiClient.js`: export `getUserFacingError`.
- `src/pages/student/MentorSelectModal.jsx`, `src/pages/student/MentorSupport.jsx`, `src/pages/StudentPortal.jsx`: làm rõ UX chọn mentor.

**Tested**
- `npm run build`: pass.

**Notes**
- Không đổi backend API.
- Admin upload material vẫn dùng endpoint `POST /api/courses/{courseId}/materials/upload`.

### 2026-06-25 - FE API Coverage Helpers

**Summary**
- Bổ sung helper FE cho các endpoint class section/student import/profile/improve plan theo tài liệu backend.

**Changed**
- `src/services/api.js`: thêm helper student import template, import class students, enroll students, improve plan, update profile.
- `src/services/adminApi.js`: export helper admin liên quan import student.

**Tested**
- `npm run build`: pass.

**Notes**
- Một số alias backend không nối riêng nếu đã có endpoint canonical tương đương trong FE.
