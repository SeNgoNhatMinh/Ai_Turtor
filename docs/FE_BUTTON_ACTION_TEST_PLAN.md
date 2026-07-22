# FE Button And Action Flow Test Plan

## Live Execution Update - 2026-07-22

- `V2-004` -> `V2-010`, `V2-022`, `V2-025`, `V2-027`, `V2-028`: PASS qua Admin/Teacher UI và API/n8n thật với dataset `FE DEMO 20260722-2235`.
- `SCHAT-010`: PASS cho nhánh `ESCALATE`; FE reconcile ID n8n tạm sang conversation UUID canonical.
- `SCHAT-015`: PASS; pin `PATCH 200`, counter `1/3`, tồn tại sau logout/login.
- `SCHAT-023`: PASS; Missing Material review vào `NEEDS_SENIOR_REVIEW` và hiển thị trong Admin queue.
- `V2-010`: mutation đã tạo canonical Evaluation run và UI refetch hiển thị đúng. n8n Respond node vẫn timeout dù BE đã hoàn tất, nên response-path chưa PASS hoàn toàn.
- Báo cáo chi tiết: `docs/FE_TUTOR_V2_LIVE_TEST_REPORT_2026-07-22.md`.

## 0. Execution Update - 2026-07-20

- Removed static service-health claims, the account-role switch, the toast-only Teacher roster `Support` action, the duplicate class refresh, and the context-free mentor prompt starter.
- Website materials and records without a real attachment no longer expose a fake download action.
- Chat session mutations, Teacher official answers, assignment grading, and quiz final review now use pending locks.
- Conversation rows and Teacher class/submission rows use keyboard-accessible action semantics.
- E2E API mocking is strict: an unexpected request receives `501` and fails the test instead of receiving a generic success response.
- Student, Teacher, Admin và Tutor V2 đã dùng PageHeader/status/action pattern thống nhất; Admin Dashboard không còn biểu đồ hoặc log fallback giả.
- Current verification: `81` contract tests, `75` component/unit tests, `18/18` desktop/mobile E2E checks, lint, dead-code analysis, diff check, and production build pass.
- Summary and remaining live scenarios: `docs/FE_UI_ACTION_COVERAGE.md`.

## 1. Mục Tiêu

Tài liệu này là checklist kiểm thử cho các button, menu action và flow có thể thao tác trên frontend AI Tutor. Nguồn chuẩn để đối chiếu:

- Route runtime trong `src/app/routes.js`.
- Feature page đang được mount bởi `StudentWorkspace`, `TeacherWorkspace`, `AdminWorkspace`.
- Domain API trong `src/services/*Api.js`.
- Coverage hiện tại trong `docs/FE_API_COVERAGE.md`.
- Spring Boot là canonical data source; n8n chỉ điều phối flow AI khi feature flag được bật.

Không coi toast, WebSocket event hoặc local state là bằng chứng thành công nếu không có HTTP receipt/canonical refetch phù hợp.

## 2. Quy Ước Kết Quả

- `P0`: flow chính, lỗi sẽ chặn demo.
- `P1`: flow quan trọng nhưng có thể demo theo đường khác.
- `P2`: tiện ích, diagnostics hoặc edge flow.
- `AUTO-E2E`: nên test bằng Playwright với API mock có kiểm tra payload.
- `AUTO-UNIT`: nên test component/hook/service bằng Vitest hoặc Node test.
- `MANUAL-LIVE`: phải test với BE/n8n/WebSocket thật.

Mỗi test case chỉ `PASS` khi:

1. Button có đúng enabled/disabled/loading state.
2. Chỉ phát sinh đúng một mutation request.
3. Payload dùng ID canonical, UI hiển thị name/email thay vì ID nếu có dữ liệu.
4. Success chỉ hiển thị sau response hợp lệ.
5. Error dùng friendly message, không lộ stack trace, token hoặc raw n8n response.
6. Canonical GET/refetch sau mutation phản ánh đúng trạng thái sau reload.

## 3. Môi Trường Và Dữ Liệu Test

### Services

- FE: `http://localhost:5173`
- BE: `http://localhost:8085`
- n8n: `http://localhost:5678` khi test harness
- MongoDB/Elasticsearch phải sẵn sàng cho material, RAG, quiz và learning memory.

### Accounts

Chuẩn bị bốn account active, không ghi password vào repository:

- `STUDENT`: có enrollment trong `COURSE_A/CLASS_A`.
- `TEACHER`: được gán `CLASS_A`.
- `SENIOR_MENTOR`: có quyền review/approve knowledge.
- `ADMIN`: có quyền academic, users, materials và diagnostics.

Chuẩn bị thêm một student không có enrollment để test guard.

### Academic Fixtures

- `COURSE_A/CLASS_A`: có teacher, student và indexed PDF.
- `COURSE_B/CLASS_B`: có material khác hẳn để test course isolation.
- Một course không có indexed material để test quiz/RAG failure.
- PDF hợp lệ, PDF sai loại, file trên giới hạn.
- Assignment files hợp lệ: PDF, DOCX, ZIP, TXT và code file.
- Answer key hợp lệ: DOCX/PDF/TXT; file ZIP để test reject.
- Student import XLSX hợp lệ và XLSX có dòng lỗi.

## 4. Global, Auth Và Navigation

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| AUTH-001 | P0 AUTO-E2E | `Đăng nhập` | Email/mật khẩu hợp lệ | `POST /api/users/login` | Gửi một request, lưu token, route theo role. Double click không gửi hai request. |
| AUTH-002 | P0 AUTO-E2E | `Đăng nhập` với form sai | Email sai/rỗng hoặc mật khẩu rỗng | Không gọi API | Hiển thị validation ngay tại field. |
| AUTH-003 | P1 AUTO-E2E | Tab `Tạo tài khoản` | Login page | Local UI state | Form chuyển mode, không submit và không mất field không liên quan. |
| AUTH-004 | P1 AUTO-E2E | Submit `Tạo tài khoản` | Form hợp lệ | `POST /api/users/register` | Chỉ success khi BE xác nhận; role không được tự nâng quyền. |
| NAV-001 | P0 AUTO-E2E | Sidebar route item | Đã login | Router navigation | URL và selected item khớp, không reload trang. |
| NAV-002 | P1 AUTO-E2E | Collapse/expand sidebar | Desktop/tablet | Local UI state | Content không overflow; tooltip có thể đọc khi collapsed. |
| NAV-003 | P1 AUTO-E2E | Dark/light switch | Đã login | Theme state/local persistence | Menu, dropdown, modal, table và markdown có contrast đủ. |
| NAV-004 | P0 AUTO-E2E | User/profile button | Đã login | `GET /api/users/{userId}/profile` hoặc profile canonical | Modal hiển thị name/email, không hiển thị raw ID làm primary label. |
| NAV-005 | P1 AUTO-E2E | `Save profile` | Sửa profile hợp lệ | `PUT /api/users/{userId}/profile` | Button loading, modal phản ánh response canonical. |
| NAV-006 | P1 AUTO-E2E | `Change password` | Password hợp lệ | `PUT /api/users/{userId}/password` | Validation confirm password; token/secret không log. |
| NAV-007 | P0 AUTO-E2E | `Sign out` | Đã login | Clear auth state, close WebSocket | Về login; back button không mở route bảo vệ. |
| NAV-008 | P0 AUTO-E2E | Mở route sai role | Login STUDENT, mở `/admin/*` | Route guard | Không mount admin action/API; chuyển về route hợp role. |

## 5. Student - AI Tutor Chat (`/student/chat`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| SCHAT-001 | P0 AUTO-E2E | Chọn course | Student có hai enrollment | Enrollment GET, sau confirm load `GET /api/ai/conversations?userId=&courseId=` | Class chỉ read-only; course/class không bị trộn. |
| SCHAT-002 | P0 AUTO-E2E | `Hủy` trong switch-course confirm | Đang có chat | Không API mutation | Giữ course, class, active conversation và messages. |
| SCHAT-003 | P0 AUTO-E2E | `Đổi môn` | Đang có chat | Load conversation của course mới | Reset active chat cũ; không nháy course/class giả. |
| SCHAT-004 | P0 AUTO-E2E | `New Chat` | Có enrollment | `POST /api/ai/conversations` | Conversation mới active và đứng đầu sidebar. |
| SCHAT-005 | P1 AUTO-E2E | Search conversation | Có history | Debounced `GET /api/ai/conversations/search` | Không layout shift khi empty; không spam request theo từng keystroke. |
| SCHAT-006 | P0 AUTO-E2E | Chọn conversation | Có history | `GET /api/ai/conversations/{id}/messages` | Message thuộc đúng course/conversation; active row highlight. |
| SCHAT-007 | P1 AUTO-E2E | Menu `Rename` | Có conversation | `PATCH /api/ai/conversations/{id}` | Enter/blur save một lần; title mới tồn tại sau reload. |
| SCHAT-008 | P0 AUTO-E2E | Menu `Delete` -> `Cancel` | Có conversation | Không DELETE | Confirm đóng; conversation không mất. |
| SCHAT-009 | P0 AUTO-E2E | Menu `Delete` -> `Delete` | Có conversation | `DELETE /api/ai/conversations/{id}` | Xóa sau receipt; active chat reset an toàn. |
| SCHAT-010 | P0 AUTO-E2E + MANUAL-LIVE | Send | Có enrollment, input hợp lệ | n8n `/student-chat` hoặc `POST /api/ai/query` theo env | Pending bubble, lock double submit, response đúng mode/course. |
| SCHAT-011 | P1 AUTO-E2E | Stop generating | Request đang pending | Abort request/client operation | UI chuyển canceled, không toast raw network error. |
| SCHAT-012 | P1 AUTO-E2E | Prompt starter | Chat empty | Fill/send theo config | Prompt có thể chỉnh sửa và gửi được; không request khi chỉ fill. |
| SCHAT-013 | P0 MANUAL-LIVE | Câu 11 sau `10/10` | Conversation đủ 10 USER questions | BE/n8n trả `conversationId` mới | FE switch sang chat mới, banner rollover, chat cũ vẫn mở xem. |
| SCHAT-014 | P1 AUTO-E2E | `Back to previous chat` | Vừa rollover | GET messages conversation cũ | Mở đúng chat cũ, không gửi query mới. |
| SCHAT-015 | P0 AUTO-E2E | Pin message | Message có backend ID | `PATCH .../messages/{messageId}/pin` | Pinned bar cập nhật sau receipt, tồn tại sau logout/login. |
| SCHAT-016 | P0 AUTO-E2E | Pin message thứ 4 | Đã pin 3 message | Không gọi PATCH | Hiển thị max 3, không làm mất message. |
| SCHAT-017 | P1 AUTO-E2E | Click pinned item | Message đang trong DOM | Local scroll/focus | Scroll đúng message và highlight nhẹ. |
| SCHAT-018 | P0 AUTO-E2E | Unpin | Message đã pin | `DELETE .../messages/{messageId}/pin` | Chỉ gỡ khỏi pinned bar, message vẫn còn. |
| SCHAT-019 | P1 AUTO-E2E | Download source | AI answer có PDF source | `GET /api/courses/{courseId}/materials/{materialId}/pdf` | Tên file đúng; website material không hiện download giả. |
| SCHAT-020 | P0 AUTO-E2E + MANUAL-LIVE | `Helpful` | AI answer có context | answer-review n8n hoặc `POST /api/tutor/answer-reviews` | Payload `QUALITY_FEEDBACK`, mode hợp lệ; không tuyên bố AI đã học. |
| SCHAT-021 | P0 AUTO-E2E | `Not correct` | AI answer | Same endpoint | Payload `ANSWER_DISPUTE`, `accurate=false`; lock khi pending. |
| SCHAT-022 | P1 AUTO-E2E | `Source conflict` | AI answer | Same endpoint | Payload `SOURCE_CONFLICT`; feedback text được trim/validate. |
| SCHAT-023 | P1 AUTO-E2E | `Missing material` | AI answer | Same endpoint | Payload `MISSING_MATERIAL`; review đi đúng queue BE. |
| SCHAT-024 | P1 AUTO-E2E | Feedback `Cancel` | Form feedback mở | Không POST | Form đóng, không tạo review. |
| SCHAT-025 | P1 AUTO-E2E | Suggestion `Study now` | AI answer có suggestion | `POST .../suggestions/learn` | Kết quả mở/fill chat đúng course. |
| SCHAT-026 | P1 AUTO-E2E | Suggestion `Create quiz` | AI answer có suggestion | Route handoff sang `/student/quizzes` | Topic được prefill, chưa generate cho tới khi user bấm. |
| SCHAT-027 | P0 MANUAL-LIVE | `Ask mentor` / create support | AI answer low confidence hoặc user yêu cầu | `POST /api/tutor/escalations`, sau đó `POST .../offer` | Tạo ticket gắn đúng question, AI answer, conversation, course/class. |

## 6. Student - Learning Progress (`/student/progress`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| SLEARN-001 | P0 AUTO-E2E | `Refresh dashboard` | Có enrollment | Dashboard + memory canonical GET | Snapshot/memory cập nhật, không dùng fallback topic giả. |
| SLEARN-002 | P0 AUTO-E2E + MANUAL-LIVE | `Analyze memory` | Có chat/memory | `POST /api/tutor/improve-suggestions` | Loading lock; suggestions/plan render từ response/refetch. |
| SLEARN-003 | P1 AUTO-E2E | `Edit memory` | Memory đã load | Local modal | Form hydrate đúng learned/weak/recent data. |
| SLEARN-004 | P1 AUTO-E2E | `Save` memory | Modal có thay đổi | `PUT .../memory` | Modal chỉ đóng sau success; refresh không mất dữ liệu. |
| SLEARN-005 | P1 AUTO-E2E | Pin suggestion | Suggestion chưa pin | `POST .../memory/pinned-suggestions` | Item lên đầu, không duplicate. |
| SLEARN-006 | P1 AUTO-E2E | Unpin suggestion | Suggestion đã pin | `DELETE .../memory/pinned-suggestions?suggestion=` | Item vẫn trong checklist, chỉ mất pinned state. |
| SLEARN-007 | P0 AUTO-E2E | `Study now` | Suggestion hợp lệ | `POST .../suggestions/learn` | Route sang chat với course context và nội dung hướng dẫn. |
| SLEARN-008 | P0 AUTO-E2E | `Create quiz` | Suggestion hợp lệ | Route handoff sang quiz | Suggestion được prefill đúng. |
| SLEARN-009 | P1 AUTO-E2E | `Reload plans` | Có course | `GET /api/students/{studentId}/improve-plans?courseId=` | Latest và history không duplicate. |
| SLEARN-010 | P1 AUTO-E2E | `Mark complete` | Active plan | `PUT /api/improve-plans/{planId}/complete` | Plan chuyển completed sau canonical reload; button lock. |

## 7. Student - Practice Quizzes (`/student/quizzes`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| SQUIZ-001 | P0 AUTO-E2E + MANUAL-LIVE | `Generate quiz` | Course có indexed material | n8n quiz-generate hoặc `POST .../quizzes/generate` | Request mang đúng course/class/topic; response khác scope bị chặn. |
| SQUIZ-002 | P1 AUTO-E2E | Generate double click | Request pending | Một mutation | Button disabled/loading, không tạo hai session. |
| SQUIZ-003 | P1 AUTO-E2E | `Refresh quizzes` | Có context | History + assigned GET song song | Tabs/count cập nhật, active quiz không mất sai. |
| SQUIZ-004 | P0 AUTO-E2E | `Continue` | Quiz `GENERATED` | `GET /api/tutor/quizzes/{sessionId}` | Mở runner, không render `correctAnswer/explanation`. |
| SQUIZ-005 | P0 AUTO-E2E | `Submit quiz` | Đã chọn answer | n8n quiz-submit hoặc `POST .../{sessionId}/submit` | Lock submit; result canonical hiển thị sau receipt. |
| SQUIZ-006 | P0 AUTO-E2E | `Review result` | Quiz `SUBMITTED/REVIEWED` | `GET /api/tutor/quizzes/{sessionId}` | Hiển thị tất cả options, student choice, correct/incorrect khi policy cho phép. |
| SQUIZ-007 | P1 AUTO-E2E | `Retry topic` | Result self-study | Generate lại với topic cũ | Tạo session mới, không ghi đè session cũ. |
| SQUIZ-008 | P0 AUTO-E2E | Assigned `Start` | Quiz publish đúng student/class | `POST /api/tutor/quiz-assignments/{id}/attempts?studentId=` | Chỉ target student nhìn thấy/start được. |
| SQUIZ-009 | P0 AUTO-E2E | Submit `TEACHER_MANUAL` | Manual online quiz | Submit endpoint | `score=null`, UI hiển thị waiting teacher grading, không lộ answer key. |
| SQUIZ-010 | P0 AUTO-E2E | Submit `AI_ASSISTED` | Assigned AI-assisted quiz | Submit endpoint | Auto score chỉ là gợi ý cho tới teacher final review. |
| SQUIZ-011 | P1 AUTO-E2E | Tab navigation | Mobile/desktop | Local tab state | Năm tab không overflow, keyboard navigation hoạt động. |

## 8. Student - Materials And Assignments (`/student/materials`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| SMAT-001 | P0 AUTO-E2E | Download course material | PDF visible | Material PDF GET | Download đúng filename; HTML_URL không có download button hoạt động. |
| SMAT-002 | P0 AUTO-E2E | Download assignment | File assignment visible | `GET /api/assignments/{id}/file` | Giữ `attachmentFileName` và extension gốc. |
| SMAT-003 | P0 AUTO-E2E | Select submission file | File hợp lệ | Local validation | Hiển thị file; sai extension/quá 50 MB bị chặn trước API. |
| SMAT-004 | P0 AUTO-E2E + MANUAL-LIVE | Submit assignment | Assignment còn hạn, file hợp lệ | `POST /api/students/assignments/{id}/submit` | Multipart có studentId/name/email; một request, status refetch. |
| SMAT-005 | P1 AUTO-E2E | Download submitted file | Có submission | `GET /api/submissions/{submissionId}/file` | Filename thật, không hardcode ZIP. |
| SMAT-006 | P1 MANUAL-LIVE | Assignment realtime | Teacher publish/review | WebSocket event -> canonical assignments/submissions GET | UI tự cập nhật; event không tự tạo success data. |

## 9. Student - Mentor Review (`/student/mentor-review`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| SMENTOR-001 | P0 AUTO-E2E | `Refresh` tickets | Có escalation | `GET /api/tutor/escalations/history` | Danh sách scroll được; question không bị cắt. |
| SMENTOR-002 | P0 AUTO-E2E | Select ticket | Có nhiều ticket | Detail GET nếu cần | Detail đúng course/class/question/status. |
| SMENTOR-003 | P0 MANUAL-LIVE | Offer mentors | Ticket waiting | `POST /api/tutor/escalations/offer?questionEscalationId=` | Chỉ teacher active và đúng class/course xuất hiện. |
| SMENTOR-004 | P0 AUTO-E2E + MANUAL-LIVE | Select mentor | Ticket `OFFERED` | `POST /api/tutor/escalations/select` | Payload student ID + teacher ID; response có `chatRoomId`. |
| SMENTOR-005 | P0 MANUAL-LIVE | Send support message | ChatRoom active | `POST /api/chat/send` | `senderRole=USER`; history/refetch hiển thị name, không ID. |
| SMENTOR-006 | P1 MANUAL-LIVE | Mark read | Có unread | `POST /api/chat/mark-read` | Unread count về 0 sau canonical read. |
| SMENTOR-007 | P1 AUTO-E2E | Close/cancel -> Cancel confirm | Active flow | Không mutation | Room/ticket giữ nguyên. |
| SMENTOR-008 | P0 MANUAL-LIVE | Close room | Active ChatRoom | `POST /api/chat/close` | Status completed; final answer/review vẫn tồn tại sau reload. |

## 10. Teacher - Classes (`/teacher/classes`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| TCLASS-001 | P0 AUTO-E2E | Refresh dashboard | Teacher được gán class | `GET /api/mentors/{teacherId}/dashboard` | Class assigned mới xuất hiện sau reload. |
| TCLASS-002 | P0 AUTO-E2E | Select class | Teacher có nhiều class | Class students + memories GET | Course/class đồng bộ; roster hiển thị name/email. |
| TCLASS-003 | P1 AUTO-E2E | Heatmap topic/select action | Có memory data | Local selection/navigation | Weak topic, affected students, risk và action khớp canonical memory. |

## 11. Teacher - Quiz Assignments (`/teacher/quizzes`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| TQUIZ-001 | P0 AUTO-E2E + MANUAL-LIVE | `Generate draft quiz` | Class/course có indexed material | n8n quiz-generate hoặc teacher generate endpoint | Response đúng scope; draft chưa publish. |
| TQUIZ-002 | P0 AUTO-E2E | `Import JSON` | JSON template hợp lệ | Parse local | Form preview đúng; JSON sai không gọi API. |
| TQUIZ-003 | P0 AUTO-E2E | Create online quiz | Manual form hợp lệ | `POST .../quiz-assignments/manual` | Draft `TEACHER_MANUAL/AI_ASSISTED` đúng lựa chọn. |
| TQUIZ-004 | P1 AUTO-UNIT | `Add question` | Draft editable | Local editor state | Question ID tạm stable, unsaved state hiện. |
| TQUIZ-005 | P1 AUTO-UNIT | Delete question | Draft >1 question | Local editor state | Không cho save quiz rỗng; validation hiện rõ. |
| TQUIZ-006 | P1 AUTO-UNIT | Add/remove option | Multiple choice | Local editor state | Tối thiểu 2, không trùng; xóa answer key buộc chọn lại. |
| TQUIZ-007 | P0 AUTO-UNIT | Select correct answer | Draft editable | Local editor state | `correctAnswer` luôn thuộc options; TRUE/FALSE dùng hai option cố định. |
| TQUIZ-008 | P0 AUTO-E2E | `Save draft` | Draft valid, dirty | `PUT /api/tutor/quiz-assignments/{id}` | Save một lần; reload giữ questions/key/explanation. |
| TQUIZ-009 | P0 AUTO-E2E | `Publish` khi dirty/invalid | Draft chưa save | Không POST publish | Button disabled/helper chỉ rõ lý do. |
| TQUIZ-010 | P0 AUTO-E2E | Publish `CLASS` | Draft valid/saved | `POST .../{id}/publish` | Payload `targetType=CLASS`; published read-only. |
| TQUIZ-011 | P0 AUTO-E2E | Publish selected students | Roster có students | Same endpoint | Search theo name/email; gửi `targetStudentIds`, không gửi label. |
| TQUIZ-012 | P0 AUTO-E2E | Delete draft | Draft state | `DELETE /api/tutor/quiz-assignments/{id}` | Cần confirm; không xóa published quiz qua UI. |
| TQUIZ-013 | P1 AUTO-E2E | View published | Published quiz | Read-only local view | Không có Save/Delete editor action. |
| TQUIZ-014 | P0 AUTO-E2E | Switch class khi dirty -> keep editing | Draft dirty | Không API | Scope cũ và draft cũ được giữ. |
| TQUIZ-015 | P0 AUTO-E2E | Switch class -> confirm | Draft dirty | Reload list theo scope mới | Draft list/student picker đổi cùng class, không trộn course. |

## 12. Teacher - Materials And File Assignments (`/teacher/materials`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| TMAT-001 | P0 AUTO-E2E | Select teaching class | Teacher có class | Load assignments/materials theo course+class | Class là single source; không có class input thứ hai. |
| TMAT-002 | P0 AUTO-E2E + MANUAL-LIVE | `Upload Material` | Class, title, PDF hợp lệ | `POST /api/courses/{courseId}/materials/upload` multipart có classId | Button lock/cooldown; success chỉ sau receipt có material ID. |
| TMAT-003 | P1 AUTO-E2E | `Import Website URL` | Chọn class/course | URL TOC -> import URL API | Chọn chapter và import theo scope; không browser crawler/worker. |
| TMAT-004 | P1 AUTO-E2E | Reload materials | Có scope | Materials GET | Status indexing canonical. |
| TMAT-005 | P1 AUTO-E2E | Material Download | PDF material | PDF GET | Website material disabled. |
| TMAT-006 | P1 AUTO-E2E | Material Reindex | Material hợp lệ | POST reindex one | Lock row action, status refetch/WebSocket. |
| TMAT-007 | P0 AUTO-E2E | Material Delete -> Cancel/Confirm | Material hợp lệ | Cancel: none; confirm: DELETE | Confirm định vị đúng, không che trang khác. |
| TASSIGN-001 | P0 AUTO-E2E | `Publish Assignment` | Class, type, title, score, file hợp lệ | `POST /api/mentor/courses/{courseId}/classes/{classId}/assignments/upload` | Multipart đủ `assignmentType/maxScore/target`; lock double upload. |
| TASSIGN-002 | P0 AUTO-E2E | Publish selected students | Roster loaded | Same endpoint | Chọn bằng name/email, gửi IDs; empty selection bị chặn. |
| TASSIGN-003 | P0 AUTO-E2E | Invalid file/score | File sai/quá 50 MB hoặc score ngoài `(0,1000]` | Không API | Inline error, file/form không reset sai. |
| TASSIGN-004 | P1 AUTO-E2E | Assignment `Edit` | Assignment existing | `PUT /api/mentor/assignments/{id}` | Metadata cập nhật sau refetch. |
| TASSIGN-005 | P1 AUTO-E2E | Assignment `Download` | Có attachment | Assignment file GET | Filename gốc. |
| TASSIGN-006 | P0 AUTO-E2E | Assignment `Delete` | Assignment existing | `DELETE /api/mentor/assignments/{id}` sau confirm | Cancel không delete; receipt mới xóa row. |

## 13. Teacher - Grading (`/teacher/grading`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| TGRADE-001 | P0 AUTO-E2E | Switch `File Assignments/Online Quizzes` | Có hai loại submission | Canonical list API theo tab | Selection cũ được clear; không render detail sai type. |
| TGRADE-002 | P0 AUTO-E2E | Select submission/attempt | Có row | File: class submission; quiz: detail GET | Detail đúng student name/email, assignment, maxScore. |
| TGRADE-003 | P1 AUTO-E2E | Download submission | File submission | `GET /api/submissions/{id}/file` | Filename gốc. |
| TGRADE-004 | P0 AUTO-E2E | Upload answer key | DOCX/PDF/TXT hợp lệ | `POST /api/mentor/assignments/{id}/answer-key` | Student không thấy key; ZIP bị FE reject. |
| TGRADE-005 | P0 AUTO-E2E + MANUAL-LIVE | `Generate AI suggestion` | Answer key ready | n8n assignment grade hoặc BE direct theo env | `PROCESSING/SUGGESTED/FAILED`; timeout không replay qua path khác. |
| TGRADE-006 | P0 AUTO-E2E | `Use suggestion` | AI status SUGGESTED | Local form fill | Không gọi review API, chưa tạo final score. |
| TGRADE-007 | P0 AUTO-E2E | `Save final score` | Score trong `[0,maxScore]` | `PUT /api/mentor/submissions/{id}/review` | Final score/feedback canonical; max không hardcode 10. |
| TGRADE-008 | P0 AUTO-E2E | `Submit Final Review` quiz | Attempt pending | `PUT /api/tutor/quizzes/{sessionId}/teacher-review` | Một mutation; reviewed attempt read-only sau reload. |
| TGRADE-009 | P0 AUTO-E2E | Review quiz options | Attempt có detail | Read-only | Hiển thị student choice/key/correctness theo grading policy. |

## 14. Teacher/Senior - Review Queue (`/teacher/review-queue`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| TREVIEW-001 | P0 AUTO-E2E | Refresh escalation inbox | Teacher có ticket | `GET /api/tutor/escalations/teachers/{teacherId}` | List/detail scroll được; question không cắt. |
| TREVIEW-002 | P0 AUTO-E2E | Select escalation | Có ticket | Detail GET nếu cần | Question, previous AI answer, course/class đúng. |
| TREVIEW-003 | P0 AUTO-E2E + MANUAL-LIVE | Submit final answer - reply only | Reply valid, candidate off | n8n teacher answer hoặc `POST /api/tutor/escalations/{id}/answer` | `createKnowledgeCandidate=false`; student nhận canonical answer. |
| TREVIEW-004 | P0 AUTO-E2E | Submit reusable knowledge | Candidate on, academic type | Same endpoint | Candidate type thuộc allowlist; không auto index. |
| TREVIEW-005 | P1 AUTO-E2E | Refresh answer review queues | Teacher/Senior | mentor-pending + senior-pending GET | Queue theo role/status đúng. |
| TREVIEW-006 | P0 AUTO-E2E | `Resolve without AI update` | Senior review, note hợp lệ | senior-resolve endpoint/n8n | Không tạo candidate; lock mutation. |
| TREVIEW-007 | P0 AUTO-E2E | `Create knowledge candidate` | Note + corrected answer | senior-resolve endpoint/n8n | Candidate pending approval; chưa index RAG. |
| TREVIEW-008 | P0 AUTO-E2E + MANUAL-LIVE | Candidate `Approve` | SENIOR_MENTOR/ADMIN | n8n approval hoặc `POST .../{id}/approve` | Reviewer metadata đủ; canonical status approved/indexed. |
| TREVIEW-009 | P0 AUTO-E2E | Candidate `Reject` | SENIOR_MENTOR/ADMIN, reason | n8n approval/reject hoặc backend reject | Reason required; status rejected; không index. |
| TREVIEW-010 | P0 AUTO-E2E | Candidate action bằng TEACHER | Login TEACHER | Không mutation | Approve/reject hidden hoặc disabled theo role. |

## 15. Admin - Dashboard (`/admin/dashboard`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| ADASH-001 | P1 AUTO-E2E | `Run Check` | ADMIN | LLM diagnostics GET | Loading state; không lộ API key value. |
| ADASH-002 | P2 AUTO-E2E | Logs `Reload` | Harness logs available | `GET /api/harness/logs` | Table cập nhật; error friendly, không fake log success. |
| ADASH-003 | P2 AUTO-E2E | Click Trace ID | Log có traceId | `GET /api/harness/traces/{traceId}` | Input/detail đúng trace. |
| ADASH-004 | P2 AUTO-E2E | `Load Trace` | Nhập traceId | Same endpoint | Empty ID không request; invalid ID có error state. |

## 16. Admin - Users (`/admin/users`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| AUSER-001 | P0 AUTO-E2E | User search/role filter + Reload | Có users | `GET /api/admin/users?q=&role=` | Name/email/role hiển thị; không nhầm ID. |
| AUSER-002 | P0 AUTO-E2E | Edit user -> Save | User existing | `PATCH /api/admin/users/{id}` | Role thuộc 4 role chuẩn; status cập nhật sau refetch. |
| AUSER-003 | P0 AUTO-E2E | Delete user Cancel/Confirm | User existing | Cancel none; confirm DELETE | Confirm anchored, một mutation. |
| AUSER-004 | P0 AUTO-E2E | Mentor Active switch | Mentor existing | `PATCH /api/admin/mentors/{id}` | Switch rollback/giữ canonical state khi API fail. |
| AUSER-005 | P1 AUTO-E2E | Mentor Verified switch | Mentor existing | Same PATCH | Trạng thái canonical sau reload. |
| AUSER-006 | P0 AUTO-E2E | Promote/Demote | Teacher existing | `PATCH /api/admin/teachers/{id}/role` | Chỉ `TEACHER <-> SENIOR_MENTOR`; thông báo relogin. |
| AUSER-007 | P0 AUTO-E2E | Delete mentor | Mentor existing | `DELETE /api/admin/mentors/{id}` sau confirm | Không xóa do click menu ngoài ý muốn. |
| AUSER-008 | P1 AUTO-E2E | Import mentors | XLSX/CSV | Mentor import endpoint | Loading/result thật; file sai không hiển success. |
| AUSER-009 | P1 AUTO-E2E | Support requests Reload | Có escalation | `GET /api/admin/mentor-escalations` | Student name/email thay ID khi có account data. |
| AUSER-010 | P1 AUTO-E2E | Delete support request | Escalation existing | `DELETE /api/admin/mentor-escalations/{id}` | Confirm + canonical row removal. |

## 17. Admin - Academic (`/admin/academic`)

| ID | Priority | Button/action | Setup | Expected API/effect | Acceptance |
|---|---|---|---|---|---|
| AACAD-001 | P0 AUTO-E2E | `Add Term` | Form hợp lệ | POST semester | Row mới sau canonical reload. |
| AACAD-002 | P0 AUTO-E2E | Term View/Edit/Delete | Semester existing | GET/local detail, PUT, DELETE | Delete có confirm; edit không đổi identity sai. |
| AACAD-003 | P0 AUTO-E2E | `Add Course` | Term hợp lệ | POST course | Course code/name canonical. |
| AACAD-004 | P0 AUTO-E2E | Course View/Edit/Complete/Delete | Course existing | PUT/PATCH complete/DELETE | Action menu không select row; status cập nhật. |
| AACAD-005 | P0 AUTO-E2E | `Create Class` | Course + teacher | POST class section | Gửi teacher ID, UI hiển thị teacher name/email. |
| AACAD-006 | P0 AUTO-E2E | Class View/Edit/Complete/Delete | Class existing | PUT/PATCH complete/DELETE | Course/class ID canonical, không trộn `1833/SE1833`. |
| AACAD-007 | P0 AUTO-E2E | `Enroll Student` | Student/course/class hợp lệ | POST enrollment | Student name/email visible; duplicate enrollment có friendly error. |
| AACAD-008 | P0 AUTO-E2E | Enrollment search | Nhập student ID/email | Student lookup + enrollment GET | Enter/Search cùng kết quả; empty không layout shift. |
| AACAD-009 | P0 AUTO-E2E | Enrollment View/Edit/Delete | Enrollment existing | PUT/DELETE | Delete gỡ student đúng class; student reload thấy context mới. |
| AACAD-010 | P1 AUTO-E2E | Import `Template` | ADMIN | Template XLSX GET | Tên file/extension đúng. |
| AACAD-011 | P0 AUTO-E2E | `Dry Run` import | Course/class/XLSX hợp lệ | Import endpoint `dryRun=true` | Không ghi DB; hiển thị row errors. |
| AACAD-012 | P0 AUTO-E2E | `Import Students` | Dry run hợp lệ | Import endpoint `dryRun=false` | Ghi enrollment thật; button lock; result canonical. |
| AMAT-001 | P0 AUTO-E2E | Upload shared PDF | Course/title/PDF | `POST /api/courses/{courseId}/materials/upload` | Không gửi classId; receipt có material ID; auto poll/refetch. |
| AMAT-002 | P0 AUTO-E2E | `Import Website URL` Analyze | URL hợp lệ | `POST .../materials/url-toc` | Render `items`, count/tree, không FE crawler. |
| AMAT-003 | P0 AUTO-E2E | Import selected chapters | 1-50 URLs selected | `POST .../materials/import-url` | Status processing; canonical list xuất hiện không refresh tay. |
| AMAT-004 | P1 AUTO-E2E | Material View/Edit metadata | Material existing | GET detail/PUT metadata | Title/category cập nhật sau refetch. |
| AMAT-005 | P1 AUTO-E2E | Material Download | PDF material | PDF GET | HTML_URL action disabled. |
| AMAT-006 | P0 AUTO-E2E | Material Reindex | Material indexed/failed | POST reindex one | Action lock; WebSocket/refetch cập nhật status. |
| AMAT-007 | P0 AUTO-E2E | Material Delete Cancel/Confirm | Material existing | Cancel none; confirm DELETE | Confirm dễ bấm; không hiện lạc sang chat. |
| AMAT-008 | P1 MANUAL-LIVE | Material indexing realtime | Upload/import/reindex | WebSocket event -> materials GET | `PROCESSING -> INDEXED/FAILED` tự cập nhật. |

## 18. Tutor V2 Expert Co-Training (`/teacher/expert-training`, `/admin/expert-training`)

| ID | Mức/Test | Button/Action | Expected |
|---|---|---|---|
| V2-001 | P0 AUTO-UNIT | Normalize V2 records | Không biến `null` score thành success; giữ đúng `TRAINING/EVALUATION`, `INDEXED/APPROVED`. |
| V2-002 | P0 MANUAL-LIVE | `Phân tích độ phủ` | Chỉ Senior/Admin thấy action; gửi chapters và target counts; reload gaps/tasks từ GET canonical. |
| V2-003 | P0 MANUAL-LIVE | Coverage `createTasks=true` | Không tạo row giả; task chỉ xuất hiện sau response/refetch BE. |
| V2-004 | P0 MANUAL-LIVE | `Nhận việc` | Gửi current teacher ID, khóa double-click, task đổi thành `ASSIGNED` sau canonical refetch. |
| V2-005 | P0 MANUAL-LIVE | `Gửi kiểm duyệt` Gold Q&A | Gửi đúng course/chapter/sourceTaskId; task thành `SUBMITTED`, contribution `PENDING_REVIEW`. |
| V2-006 | P0 AUTO-UNIT | Rubric criteria | Không submit khi tên trùng, weight <= 0 hoặc tổng khác `1.0`. |
| V2-007 | P0 MANUAL-LIVE | Approve TRAINING Gold Q&A | Chỉ Senior/Admin; kết quả canonical là `INDEXED`, task `COMPLETED`. |
| V2-008 | P0 MANUAL-LIVE | Approve EVALUATION Gold Q&A | Kết quả là `APPROVED`, `indexedAt=null`; UI không nói đã vào RAG. |
| V2-009 | P0 MANUAL-LIVE | Reject Gold Q&A/Rubric | Bắt buộc rejection reason; contribution `REJECTED`, task nguồn `IN_PROGRESS`. |
| V2-010 | P0 MANUAL-LIVE | `Chạy Evaluation` | Chỉ Senior/Admin; chỉ bật khi có Evaluation Gold Q&A đã duyệt; gửi field Java DTO `passThreshold`; reload runs và mở detail từng case. |
| V2-011 | P1 MANUAL-LIVE | Tutor V2 WebSocket events | Event task/contribution/eval debounce 350 ms và chỉ refetch widget liên quan. |
| V2-012 | P0 AUTO-UNIT | Duplicate socket envelope | Cùng `type + entityId + status` trong 1.5 giây chỉ được xử lý một lần. |
| V2-013 | P1 MANUAL-LIVE | Socket reconnect | Sau reconnect, active course reload từ HTTP mà không reload toàn trang. |
| V2-014 | P0 MANUAL-LIVE | n8n V2 disabled | Mọi V2 mutation gọi trực tiếp Spring Boot; không request `5678`. |
| V2-015 | P0 MANUAL-LIVE | n8n V2 enabled | Mutation dùng webhook V2; JWT chỉ ở Authorization header; reject vẫn backend-direct. |
| V2-016 | P0 MANUAL-LIVE | n8n V2 timeout/error | Không replay mutation qua Backend; hiện friendly error rồi refetch canonical data. |
| V2-017 | P1 AUTO-E2E | Role visibility | Teacher không thấy Analyze/Approve/Run; Senior/Admin thấy đúng action. Student không có route/nav V2. |
| V2-018 | P1 AUTO-E2E | Responsive/dark mode | Tabs/table/modal scroll nội bộ, không tràn workspace và đủ contrast. |
| V2-019 | P0 AUTO-UNIT | Next action selector | Teacher ưu tiên task của mình; Senior/Admin ưu tiên nội dung chờ duyệt; không dựng activity giả. |
| V2-020 | P0 AUTO-UNIT | Evaluation readiness | Không có approved holdout thì CTA disabled và hiển thị lý do; Rubric thiếu chỉ là cảnh báo. |
| V2-021 | P1 AUTO-E2E | URL context | `?view=work&task=...` và `?view=content&review=...` giữ đúng khu vực/bản ghi sau refresh. |
| V2-022 | P0 MANUAL-LIVE | Coverage `Tạo task` | Mở `Công việc`, điền sẵn chapter thật từ gap; chỉ gửi POST khi user xác nhận form. |
| V2-023 | P0 AUTO-UNIT | Chapter role visibility | Teacher chỉ xem tree/preview; không thấy Xác nhận, Thêm chapter hoặc Tạo task. Senior/Admin thấy các action này. |
| V2-024 | P0 MANUAL-LIVE | `Xác nhận chapter` | Gửi đúng `chapterKeys`; uncheck chapter đã confirm sẽ trở lại `SUGGESTED`; canonical GET được refetch. |
| V2-025 | P0 MANUAL-LIVE | `Tạo task mở` từ preview | TRAINING/EVALUATION checkbox map đúng payload; task mới là `OPEN`, không chỉ định Teacher. |
| V2-026 | P0 AUTO-UNIT | Teacher submit ownership | Task của giảng viên khác hoặc task `SUBMITTED/COMPLETED` phải read-only; không gọi mutation. |
| V2-027 | P0 MANUAL-LIVE | Task material context | Preview đúng course/chapter; chỉ nguồn PDF có `Mở PDF`; website/DOCX không gọi PDF endpoint. |
| V2-028 | P0 MANUAL-LIVE | Reject và resubmit | Reject bắt buộc note, task về `IN_PROGRESS`; Teacher thấy reason và nội dung cũ để chỉnh sửa/gửi lại. |
| V2-029 | P0 AUTO-E2E | Canonical selected task | URL chỉ lưu task ID; sau REST/WebSocket refetch detail lấy object mới, không giữ status stale. |

## 19. Cross-Cutting Error, Lock, Realtime Và n8n

| ID | Priority | Scenario | Expected |
|---|---|---|---|
| CROSS-001 | P0 AUTO-UNIT | HTTP 400/401/403/404 | Friendly error; không retry mutation; 401 logout/reauth theo auth policy. |
| CROSS-002 | P0 AUTO-UNIT | HTTP 500 | Chỉ user-facing generic message; raw response chỉ nằm trong debug details. |
| CROSS-003 | P0 AUTO-UNIT | 502/503/504, network, timeout | Friendly service/timeout copy; pending state luôn được clear. |
| CROSS-004 | P0 AUTO-E2E | Double click mutation buttons | Một request; button loading/disabled tới khi settled. |
| CROSS-005 | P0 AUTO-E2E | Confirm `Cancel` | Không có mutation request ở conversation, material, assignment, academic, user. |
| CROSS-006 | P0 AUTO-E2E | Confirm `Delete/Confirm` | Chỉ một mutation, close confirm sau settled, error không xóa row local. |
| CROSS-007 | P0 AUTO-UNIT | n8n malformed/empty HTTP 200 | Không coi là success; strict mode không fallback; non-strict chỉ fallback theo flow cho phép. |
| CROSS-008 | P0 MANUAL-LIVE | n8n off, feature disabled | Backend-direct flow hoạt động; không request `localhost:5678`. |
| CROSS-009 | P0 MANUAL-LIVE | n8n enabled/active | RAG, CODE, ESCALATE, review, teacher answer, senior resolution và quiz trả envelope hợp lệ. |
| CROSS-010 | P0 AUTO-UNIT | Assignment AI grade timeout | Không replay backend/n8n path khác; cho user refetch canonical status. |
| CROSS-011 | P1 MANUAL-LIVE | WebSocket disconnect/reconnect | Exponential reconnect, heartbeat 25 giây, không log token. |
| CROSS-012 | P0 MANUAL-LIVE | WebSocket event duplicate/out of order | Chỉ trigger canonical GET; UI không nhân đôi record. |
| CROSS-013 | P1 AUTO-E2E | Mobile 390px | Không overflow page; table/code/tabs có scroll nội bộ; input không che content. |
| CROSS-014 | P1 AUTO-E2E | Dark mode | Dropdown, Select popup, ConfirmCard, status, quiz result và markdown đủ contrast. |
| CROSS-015 | P1 AUTO-E2E | Keyboard/reduced motion | Tab/Enter/Escape/focus hoạt động; animation giảm theo media query. |

## 20. Refactor Audit Cho Testability

### Đã đúng hướng

- Route theo feature và role đã tách trong `src/app`.
- Business requests phần lớn đã nằm trong domain services/hooks.
- Student/Teacher/Admin page được lazy-load theo route.
- Mutation quan trọng có loading/lock và canonical refetch.
- Common `ConfirmCard`, `EntityActionMenu`, `AsyncState` đã có thể tái sử dụng.

### Đã hoàn tất trong đợt UI/UX này

1. Các route chính đã dùng PageHeader, status/action pattern và primitive workflow chung thay cho layout rời rạc.
2. Admin Dashboard đã tách diagnostics error khỏi dữ liệu log và không còn biểu đồ/log fallback giả.
3. Copy chính, validation và lỗi kỹ thuật đã được chuẩn hóa sang tiếng Việt; E2E dùng accessible label thay vì class Ant Design sinh tự động.
4. Các mutation quan trọng đã có pending lock và chỉ báo thành công sau API receipt hợp lệ.

### Cải tiến không chặn demo

1. Khi thêm icon-only action mới, bắt buộc khai báo `aria-label` ổn định.
2. Hook mutation mới nên giữ contract `{ run, isPending, error }` để tiếp tục thống nhất test double-click và failure rollback.
3. Các chuỗi mới nên đi qua copy/status constants; chưa cần thêm framework i18n khi sản phẩm chỉ dùng tiếng Việt.

## 21. Automation Roadmap

### Phase A - P0 mocked E2E

- Auth/role guard/navigation.
- Student enrollment, chat send, switch course, rollover, pin, feedback.
- Student quiz generate/start/submit/review.
- Teacher draft save/publish/selected students.
- File Assignment create/submit/final grade.
- Admin academic CRUD, enrollment, material upload/delete.
- Tất cả confirm Cancel/Confirm và double-submit locks.

### Phase B - Component/contract tests

- Quiz draft validation và answer-key consistency.
- Assignment file validation và score `null` normalization.
- n8n envelope/malformed response/timeout/no duplicate replay.
- Error normalization và role-based action visibility.
- Realtime envelope normalization và subscription filters.

### Phase C - Live integration smoke

- RAG/CODE/ESCALATE qua n8n thật.
- Conversation rollover sau 10 USER questions.
- Mentor offer/select/ChatRoom/final answer.
- Material upload/index/reindex và WebSocket status.
- AI-assisted assignment grading và teacher final score.
- KnowledgeCandidate approve/reject và RAG indexing.

## 22. Regression Commands

Chạy theo thứ tự sau trước khi ký test run:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run dead-code
```

`npm run check` có thể thay cho ba lệnh đầu. Live integration cases phải ghi rõ cấu hình `VITE_N8N_ENABLED`, quiz/assignment grading flags và workflow version đang active.

## 23. Execution Log Template

| Run date | Build/commit | Environment | Test IDs | Pass | Fail | Blocked | Evidence/issue |
|---|---|---|---|---:|---:|---:|---|
| YYYY-MM-DD | commit SHA | local/staging | AUTH-* | 0 | 0 | 0 | screenshot, trace, request payload |

Khi phát hiện lỗi, issue phải ghi: test ID, role, route, request/response status, payload đã che token, UI state trước/sau và bước reproduce tối thiểu.

## 24. Canonical Action Centers, Review History Và Material Processing

| ID | Priority | Button/Action | Expected |
|---|---|---|---|
| ACTION-001 | P0 AUTO-UNIT | Student `Việc cần làm tiếp theo` | Chỉ tạo action từ assignment chưa nộp, quiz đang dở/được giao và escalation đã có kết quả; không dựng activity giả. |
| ACTION-002 | P1 AUTO-UNIT | Click Student next-step row | Chuyển đúng route Materials, Quiz hoặc Mentor Review; không gọi mutation. |
| ACTION-003 | P0 AUTO-UNIT | Suggestion `Học ngay` đã consumed | Sau success hoặc `409 SUGGESTION_ALREADY_USED`, item hiện `Đã học` và action bị khóa trong scope hiện tại. |
| ACTION-004 | P0 MANUAL-LIVE | Teacher Material `Tải tài liệu` nhận HTTP 202 | Giữ form và `materialId`, thêm processing row; không toast thành công giả nếu receipt thiếu ID. |
| ACTION-005 | P0 AUTO-UNIT | Upload lại cùng PDF đang PROCESSING | Button bị khóa; không phát request upload thứ hai. |
| ACTION-006 | P0 MANUAL-LIVE | `MATERIAL_INDEXED` | Badge đổi sau event rồi GET canonical; tài liệu sẵn sàng không cần F5. |
| ACTION-007 | P0 MANUAL-LIVE | `MATERIAL_INDEXING_FAILED` | Hiện lỗi, menu `Lập chỉ mục lại` vẫn hoạt động và chỉ báo success sau API receipt. |
| ACTION-008 | P1 MANUAL-LIVE | WebSocket reconnect | Material, Student Assignment, Teacher Grading và Tutor V2 đều refetch màn đang mở. |
| ACTION-009 | P0 AUTO-E2E | Teacher `Việc cần xử lý` | Chỉ tải khi có course/class; từng row dẫn đúng Grading, Review Queue hoặc Materials. |
| ACTION-010 | P0 MANUAL-LIVE | Review tab `Đã xử lý` | Gọi `GET /api/tutor/answer-reviews?status=RESOLVED&courseId=...`; card read-only, không có nút resolve/approve lại. |
| ACTION-011 | P0 AUTO-E2E | Admin `Kiểm duyệt phản hồi AI` | Route `/admin/review-queue` hiển thị Senior queue, history và Knowledge Candidates theo quyền ADMIN. |
| ACTION-012 | P0 AUTO-UNIT | Upload/download trả 401 | Xóa session/token và đưa về flow đăng nhập giống JSON request; không retry vô hạn. |
