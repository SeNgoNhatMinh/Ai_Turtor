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

## [2026-07-09] Inline Course Material Source Deduplication

- Detected standalone source lines such as `Course material, filename.pdf` inside AI answers.
- Moved scattered source-only lines into one normalized `Nguồn tài liệu đã dùng` section.
- Deduplicated source labels by filename so repeated source mentions render once.
- Filtered generic `Course material` labels when the same source list also contains a real filename.
- Avoided treating filename text as a material download ID unless it can be mapped to a real material ID.

**Tested**
- `npm run build`: pass.

## [2026-07-09] AI Answer Duplicate Source Display Fix

- Prevented duplicate source display in student chat answers.
- When backend response includes structured `message.sources`, the markdown `Nguồn tài liệu đã dùng` section is hidden and sources are shown only in the evidence block.
- Kept source rendering available for answers that only include source IDs inside markdown text.

**Tested**
- `npm run build`: pass.

## [2026-07-09] AI Answer Source Label And Vietnamese Heading Fix

- Normalized common AI Tutor Vietnamese section headings when the AI returns no-diacritic text, e.g. `Tai lieu mon hoc`, `Luu y de hoc tot hon`, and `Nguon tai lieu da dung`.
- Updated source parsing so comma-separated material IDs are detected in the `Nguồn tài liệu đã dùng` section.
- Source pills now map each material ID to loaded material filename/title when available, instead of rendering raw Mongo IDs.
- Unknown source IDs now fall back to a generic material label rather than exposing raw IDs in the chat answer.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Sidebar Tooltip Contrast Fix

- Fixed unreadable sidebar hover descriptions in light mode.
- Added a dedicated tooltip class for sidebar navigation tooltips rendered by Ant Design outside the sidebar DOM tree.
- Set tooltip background/text/arrow colors explicitly for light and dark mode.
- Kept selected sidebar menu text black/readable in light mode.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Teacher Knowledge Gap UX Refresh

- Reworked `Class Knowledge Gap Heatmap` into a clearer `Knowledge Gap Overview`.
- Added high-risk, needs-attention, and strong-topic summary counters.
- Grouped topics into actionable columns: `Review first`, `Add practice`, and `Stable topics`.
- Added guidance text explaining what each topic state means and a suggested next step for teachers.
- Added empty state for classes with no knowledge gap data yet.
- Improved class card keyboard accessibility and class ID fallback selection.
- Added responsive CSS so the topic columns stack cleanly on smaller screens.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Portal Split Phase 2

- Reduced portal file weight without changing routes, endpoints, or UI behavior.
- Extracted student support state/API flow into `src/hooks/useStudentSupport.js`.
- Extracted student chat layout into `src/pages/student/StudentChatTab.jsx`.
- Extracted student support tab composition into `src/pages/student/StudentSupportTab.jsx`.
- Extracted teacher live chat flow into `src/hooks/useTeacherLiveChat.js`.
- Extracted teacher materials/assignments state and handlers into `src/hooks/useTeacherMaterialsAssignments.js`.
- Fixed `TeacherPortal` runtime prop issue by passing `currentUser` from `App.jsx`.
- `StudentPortal.jsx` is now smaller, and `TeacherPortal.jsx` dropped to under 300 lines.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Frontend Clean Architecture Split Phase 1

- Added `docs/FE_ARCHITECTURE.md` with safe frontend split rules, folder responsibilities, API rules, and refactor checklist.
- Moved student AI answer review config/copy into `src/constants/answerReview.js`.
- Extracted `AnswerFeedbackControls` from `ChatWorkspace` so the chat workspace focuses on orchestration.
- Moved KnowledgeCandidate options/status labels into `src/constants/knowledgeFlow.js`.
- Added `src/utils/permissions.js` for role-based UI permissions.
- Extracted teacher answer mode UI into `TeacherAnswerModeSelector`.
- Extracted KnowledgeCandidate review list into `KnowledgeCandidateReviewList`.
- Reduced `ChatWorkspace.jsx` and `TeacherSupportQueueTab.jsx` size without changing API endpoints or behavior.

**Tested**
- `npm run build`: pass.

### 2026-07-02 - Teacher Mentor Backend Flow Alignment

**Summary**
- Cập nhật FE teacher/mentor để khớp các API backend mới hơn cho class material, assignment, quiz publish target và live chat helper.

**Changed**
- `src/services/api.js`: 
  - `deleteAssignment(assignmentId, teacherId)` gửi `teacherId` query theo BE.
  - `getClassStudents(courseId, classId, teacherId?)` hỗ trợ guard teacher assigned class.
  - `getChatUnread(userId, role)` hỗ trợ `role=MENTOR`.
  - `deleteMaterial/reindexMaterial/reindexCourseMaterials` hỗ trợ `teacherId`.
- `src/services/teacherApi.js`: expose thêm material/chat helpers cho teacher flow.
- `src/pages/teacher/QuizAssignments.jsx`: sửa target publish selected students từ `STUDENTS` sang `SELECTED_STUDENTS`.
- `src/pages/TeacherPortal.jsx`:
  - Teacher class material upload chỉ nhận PDF, gửi đủ `uploaderRole=TEACHER`, `teacherId`, `classId`.
  - Sau upload/reindex/delete material reload lại list course/class materials.
  - Publish assignment gọi API thật `POST /mentor/courses/{courseId}/classes/{classId}/assignments/upload`.
  - Assignment target dùng `ALL_CLASS` hoặc `SELECTED_STUDENTS` đúng BE.
  - Thêm list class assignments, download assignment file, delete assignment trước khi có submission.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Backend Learning Flow UX Alignment

- Student AI feedback now maps to backend review types: `QUALITY_FEEDBACK`, `ANSWER_DISPUTE`, `SOURCE_CONFLICT`, and `MISSING_MATERIAL`.
- Feedback success copy now states that AI will not learn until mentor/senior review.
- Teacher support answer flow defaults to `Reply to student only`.
- `Propose reusable AI knowledge` is explicit and limited to academic candidate types: `ACADEMIC_KNOWLEDGE`, `MATERIAL_CORRECTION`, `FAQ_CLARIFICATION`.
- Policy, grading, deadline, class-rule, and assignment-specific answers are shown as reply-only guidance, not reusable AI knowledge.
- Knowledge Candidate labels now use backend-aligned wording: `Pending senior approval`, `Approved into AI knowledge`, `Rejected`.
- Candidate approve/reject payloads include reviewer identity and note/reason fields.
- Admin sidebar no longer exposes `Payments & Plans`; stale billing tab falls back to dashboard.
- Admin diagnostics shows `Backend direct` or `n8n harness enabled` based on env.

**Tested**
- `npm run build`: pass.

### 2026-07-02 - Shared Course Materials Table Overflow Fix

**Summary**
- Sửa bảng `Shared Course Materials` bị tràn khỏi màn hình/card khi title, source URL hoặc filename quá dài.

**Changed**
- `src/pages/admin/academic/CourseMaterialsTab.jsx`: thêm `scroll.x`, `tableLayout="fixed"`, width rõ cho các cột và ellipsis cho title/source/date.
- `src/index.css`: thêm style riêng cho `.admin-materials-table-card` và `.admin-materials-table` để scroll ngang nằm trong card, không kéo layout toàn trang.

**Tested**
- `npm run build`: pass.

### 2026-07-02 - Admin Academic Layout De-overlap

**Summary**
- Giảm cảm giác chồng chéo trong Admin Academic bằng layout scope riêng, spacing rõ hơn và bảng tự scroll ngang.

**Changed**
- `src/pages/admin/AdminAcademic.jsx`: thêm class scope `admin-academic-page/admin-academic-tabs`, chuyển search row sang class reusable, chuẩn hóa source text material.
- `src/index.css`: thêm style riêng cho Admin Academic card/tabs/table/form/search row, mobile responsive và dark mode.

**Tested**
- `npm run build`: pass.

## [2026-07-02] Admin Academic Tab Split
- Tách `src/pages/admin/AdminAcademic.jsx` theo từng tab để giảm chồng chéo UI và dễ scale thêm CRUD/API mới.
- Thêm folder `src/pages/admin/academic/` gồm:
  - `TermsTab.jsx`
  - `CoursesTab.jsx`
  - `ClassSectionsTab.jsx`
  - `StudentEnrollmentsTab.jsx`
  - `StudentImportTab.jsx`
  - `CourseMaterialsTab.jsx`
  - `EntityRecordModal.jsx`
  - `adminAcademicUtils.js`
- `AdminAcademic.jsx` giữ vai trò container/state/API orchestration, còn từng tab chỉ render UI và gọi callback được truyền xuống.
- Tách modal View/Edit dùng chung cho Term/Course/Class/Enrollment/Material sang `EntityRecordModal.jsx`.
- Tách state/API logic ra hook:
  - `hooks/useAcademicRecords.js`: Terms/Courses/Class Sections/Student Enrollments loader/create/delete/search.
  - `hooks/useCourseMaterials.js`: Course Materials upload, polling, download/reindex/delete, website import refresh.
  - `hooks/useStudentImport.js`: Excel template, class lookup, dry-run/import result.
- Gom helper lấy id/code và trạng thái indexing material vào `adminAcademicUtils.js` để tránh lặp logic trong bảng/action.
- Giữ nguyên endpoint, behavior upload/import/action menu/confirm hiện tại; refactor theo hướng an toàn, không đổi route hoặc API contract.

**Tested**
- `npm run build`: pass.

**Notes**
- Không đổi API hoặc behavior CRUD/upload/import; chỉ chỉnh layout/UX để giảm đè cột và rối mắt.

### 2026-07-02 - AI Answer Heading And Source Rendering Fix

**Summary**
- Sửa câu trả lời AI khi heading tiếng Việt thiếu dấu, source chỉ hiện material ID, và heading bị gắn `[#]` gây nhiễu.

**Changed**
- `src/utils/markdownPreprocessor.js`: normalize các heading tiếng Việt không dấu phổ biến, nhận diện `Lưu ý để học tốt hơn` để tạo suggestion link, và tách raw material IDs trong section nguồn thành list item.
- `src/utils/sourceLabels.js`: nhận diện raw Mongo material id 24 ký tự để map sang tên material.
- `src/components/markdown/MarkdownRenderer.jsx`: bỏ autolink heading `[#]`; vẫn giữ markdown heading sạch.

**Tested**
- `npm run build`: pass.

**Notes**
- FE chỉ normalize các section label quen thuộc để tránh tự thêm dấu sai vào nội dung chuyên môn.

### 2026-07-02 - Auto Refresh Material Indexing Status

**Summary**
- Course Materials tự cập nhật status `PROCESSING` sang `INDEXED/FAILED` mà không cần refresh tay.

**Changed**
- `src/pages/admin/AdminAcademic.jsx`: thêm polling im lặng mỗi 2.5 giây khi có material đang indexing.
- Tái sử dụng normalizer material list để tránh lệch shape response giữa load thường, polling và retry sau upload/import.

**Tested**
- `npm run build`: pass.

**Notes**
- Polling tự dừng khi không còn material ở trạng thái `PROCESSING/PENDING/INDEXING/QUEUED`.

### 2026-07-02 - Website URL Material Import Uses Backend TOC

**Summary**
- Cập nhật Admin Course Materials theo BE flow mới: analyze URL bằng backend `url-toc`, chọn chapter/section, rồi import bằng `import-url`.

**Changed**
- `src/services/api.js`: thêm `previewMaterialUrlToc(courseId, payload)`.
- `src/components/importWebsite/ImportWebsiteModal.jsx`: đổi thành flow `Analyze URL` → chọn tối đa 50 TOC items → `Import Selected`.
- `src/pages/admin/AdminAcademic.jsx`: đổi nút thành `Import Website URL`, hiển thị badge `Website/PDF`, disable download cho `HTML_URL`.
- `src/hooks/useDocumentationCrawler.js`: bỏ re-export tới crawler FE cũ đã bị xóa, giữ compatibility hook báo dùng backend URL import.
- `src/index.css`: thêm style TOC list responsive và dark mode.

**Tested**
- `npm run build`: pass.

**Notes**
- BE trả TOC bằng field `items`, không phải `chapters`.
- Website import không tạo PDF; backend lưu text HTML_URL và index nền.

### 2026-06-30 - Import Website As PDF

**Summary**
- Thêm luồng Admin Course Materials import website documentation thành một PDF text thật rồi upload qua endpoint material PDF hiện có.

**Changed**
- Thêm modal `Import Website as PDF` với analyze URL, page selection, Markdown preview, progress 7 bước, PDF download và upload.
- Thêm crawler/extractor/PDF/upload modules dùng `DOMParser`, `@mozilla/readability`, `turndown`, `markdown-it`, `@react-pdf/renderer`, `@fontsource/noto-sans`.
- Gắn nút import vào Admin `Course Materials`; upload vẫn gọi `apiService.uploadMaterial(courseId, formData)`.
- Thêm xử lý CORS/timeout/invalid URL/no pages rõ ràng; CORS-blocked sites được báo là unsupported trong frontend-only mode.
- Giới hạn upload material thường thành PDF-only để khớp backend hiện tại.

**Tested**
- `npm run build`: pass.

**Notes**
- Không đổi backend. Website import chỉ chạy với website cho phép browser fetch/CORS.

### 2026-06-30 - Simplified Answer Action Buttons

**Summary**
- Bỏ các nút follow-up dễ tạo prompt nhiễu và làm RAG trả `không có nội dung đủ phù hợp`.

**Changed**
- `src/pages/student/AnswerActionBar.jsx`: remove `Cho ví dụ`, `Tạo câu hỏi luyện tập`, `Xem xét code của tôi`.
- Action bar câu trả lời thường chỉ giữ `Giải thích đơn giản hơn` và `Hỏi mentor`.
- Trạng thái thiếu tài liệu/lỗi LLM vẫn chỉ hiển thị action phục hồi phù hợp như `Retry` hoặc `Ask mentor`.

**Tested**
- `npm run build`: pass.

## [2026-06-30] Click-To-Learn Suggestions Open Real Chat Turn
- `Learning Progress` suggestion text can now be clicked directly, not only through the `Study now` button.
- `Study now` sends the clicked suggestion to `POST /api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn` with the current `conversationId`.
- FE opens the `conversationId` returned by BE and reloads chat history so students see the real AI learning turn saved by backend.
- If chat history is not immediately available, FE renders the returned answer as a fallback message pair.
- Duplicate `SUGGESTION_ALREADY_USED` responses are shown as a friendly state instead of bypassing the backend rule with a normal chat prompt.

**Tested**
- `npm run build`: pass.

**Notes**
- Nếu muốn tạo câu hỏi luyện tập nên dùng tab `Practice Quizzes`, vì flow quiz có API riêng và kiểm soát tài liệu tốt hơn chat follow-up.

### 2026-06-30 - Grounded Follow-Up Chat Actions

**Summary**
- Sửa lỗi các nút follow-up dưới câu trả lời AI gửi prompt quá dài/nhiễu, làm backend RAG trả `Tài liệu hiện có... không có nội dung đủ phù hợp`.

**Changed**
- `src/pages/student/AnswerActionBar.jsx`: đổi prompt của `Explain simpler`, `Give example`, `Create practice question` để bám vào câu hỏi gốc/topic gốc, chỉ dùng answer cũ làm context phụ ngắn.
- `src/pages/student/AnswerActionBar.jsx`: nếu câu trả lời đã là trạng thái thiếu tài liệu/không đủ context thì không hiện các nút follow-up nữa, chỉ hiện `Ask mentor`.

**Tested**
- `npm run build`: pass.

**Notes**
- Backend vẫn quyết định RAG có đủ tài liệu hay không; FE chỉ giảm prompt noise để retrieval đúng topic hơn.

### 2026-06-30 - Friendly AI Service Error Recovery

**Summary**
- Cải thiện UX khi backend trả lỗi `AI Tutor chưa thể gọi dịch vụ LLM`: không để người dùng chỉ thấy lỗi thô, mà có hướng xử lý rõ ràng.

**Changed**
- `src/hooks/useStudentChatController.js`: nhận diện lỗi LLM/timeout trong response hoặc catch error, thay bằng message thân thiện và đánh dấu message `retryable`.
- `src/pages/student/AnswerActionBar.jsx`: với message lỗi chỉ hiện `Retry` và `Ask mentor` để giảm rối.
- `src/pages/StudentPortal.jsx`: nối `Retry` gửi lại câu hỏi cũ; `Ask mentor` tạo escalation bằng `aiResponse/reason` đúng payload backend rồi chuyển sang tab `1-on-1 Support`.
- `src/pages/student/ChatWorkspace.jsx`, `src/pages/student/ChatWorkspace.css`: thêm banner lỗi AI service trong bubble, hỗ trợ dark mode.

**Tested**
- `npm run build`: pass.

**Notes**
- Lỗi gốc vẫn cần BE/provider xử lý nếu OpenRouter free model timeout hoặc fail. FE hiện chỉ giúp user retry/escalate rõ ràng hơn.

### 2026-06-30 - Clickable Study Tips In AI Answers

**Summary**
- Khôi phục khả năng bấm vào các dòng trong section `Lưu ý để học tốt hơn` của câu trả lời AI để analyze/generate study suggestions.

**Changed**
- `src/utils/markdownPreprocessor.js`: tự nhận diện section heading `Lưu ý...`, chuyển bullet/plain lines trong section đó thành link nội bộ `#ai-study-tip-*`; renderer hiện có biến link này thành button clickable.
- Giữ nguyên meaning của nội dung AI, không đụng code block, table, source material hoặc link đã có.

**Tested**
- `npm run build`: pass.

**Notes**
- Node import trực tiếp source file không chạy vì Vite dùng extensionless imports; app build/runtime vẫn OK.

### 2026-06-30 - Stable Confirm Card Position

**Summary**
- Sửa lỗi confirm card xuất hiện sai vị trí hoặc nhảy lung tung khi mở từ menu ba chấm trong sidebar/table.

**Changed**
- `src/components/common/EntityActionMenu.jsx`: lấy vị trí anchor từ nút ba chấm thật thay vì item trong dropdown menu.
- `src/components/common/confirmDialog.jsx`: clamp confirm card trong viewport, ưu tiên hiện dưới nút action và tự chuyển lên trên nếu không đủ chỗ; đóng confirm khi resize/scroll để tránh kẹt sai vị trí.
- `src/index.css`: thêm wrapper style cho action trigger và reset `right/bottom` cho confirm card dạng anchored.

**Tested**
- `npm run build`: pass.

**Notes**
- Build vẫn còn warning chunk lớn từ markdown/quiz stack trước đó; không liên quan đến confirm dialog.

### 2026-06-30 - SurveyJS Quiz Renderer

**Summary**
- Cài SurveyJS để format self-study/assigned quiz đẹp hơn và render câu hỏi trắc nghiệm như một quiz form chuyên nghiệp.

**Changed**
- `package.json`, `package-lock.json`: thêm `survey-react-ui` và `survey-core`.
- `src/pages/student/QuizRunner.jsx`: thay render Ant `Radio.Group` thủ công bằng SurveyJS `Survey` + `Model`, map BE questions/options sang survey schema, giữ payload submit backend `{ answers: [{ questionId, selectedAnswer }] }`.
- `src/pages/student/Quiz.css`: thêm style SurveyJS light/dark mode theo theme AI Tutor, bo góc, hover/selected state và spacing.

**Tested**
- `npm run build`: pass.

**Notes**
- SurveyJS làm `StudentPortal` chunk lớn hơn đáng kể. Nếu performance cần chặt hơn, bước tiếp theo nên lazy-load riêng `PracticeQuizzes/QuizRunner` hoặc dynamic import SurveyJS.

### 2026-06-30 - Learning Progress Connected To Study And Quiz Flow

**Summary**
- Sửa `Learning Progress` để đúng nghĩa là màn hành động học tập theo backend memory: xem context memory, học ngay từ suggestion, tạo quiz từ suggestion, và thấy course/class đang được theo dõi.

**Changed**
- `src/config/navigation.js`: thêm tab student `Practice Quizzes`.
- `src/pages/StudentPortal.jsx`: nối `LearningProgress` sang chat bằng `Study now`, nối sang `PracticeQuizzes` bằng `Create quiz`, truyền memory summary/recent questions/course/class.
- `src/pages/student/LearningProgress.jsx`: thêm course/class scope, memory summary, recent learning signals, action buttons `Study now`, `Create quiz`, `Pin/Unpin`.
- `src/pages/StudentPortal.jsx`, `src/App.jsx`: bỏ fallback/mock learned topics, weak topics và suggestion mẫu để dashboard chỉ hiển thị dữ liệu memory/backend thật.
- `src/services/api.js`: thêm helper `learnSuggestion(studentId, courseId, payload)` cho endpoint BE `/api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn`.
- `src/services/normalizers.js`, `src/App.jsx`: giữ thêm `summary`, `recentQuestions`, `recentAnswers`, `updatedAt`, `classId` từ student memory.
- `src/index.css`: thêm style cho memory context, recent questions và suggestion actions.

**Tested**
- `npm run build`: pass.

**Notes**
- `Study now` hiện mở AI Tutor Chat và gửi prompt theo course/class để câu trả lời được lưu trong conversation history. Helper `learnSuggestion` đã có sẵn nếu sau này muốn dùng flow BE direct không qua chat history.

### 2026-06-30 - ChatGPT Style Conversation History Sidebar

**Summary**
- Nâng cấp sidebar lịch sử chat student theo hướng ChatGPT/Claude: group theo thời gian, search, New Chat rõ ràng, skeleton loading, animation khi conversation đổi vị trí và responsive tablet/mobile.

**Changed**
- `src/pages/student/ChatSessionsPanel.jsx`: tách render thành `ConversationGroup`, `ConversationItem`, `ConversationMenu`, `ConversationSkeleton`, `EmptyState`; sort theo `lastMessageAt` giảm dần; group `Today`, `Yesterday`, `Previous 7 Days`, `Previous 30 Days`, `Older`; local infinite render sau 50 conversation.
- `src/hooks/useStudentChatController.js`: thêm loading state cho sessions, load conversations theo `courseId`, optimistic update `lastMessageAt` và đưa conversation hiện tại lên đầu ngay sau khi gửi tin nhắn; hỗ trợ backend trả `conversationId` mới.
- `src/services/api.js`, `src/services/conversationApi.js`, `src/services/normalizers.js`: bổ sung `courseId` cho conversation APIs, thêm search/pin facade và chuẩn hóa `lastMessageAt/messageCount`.
- `src/pages/StudentPortal.jsx`, `src/index.css`, `src/pages/student/ChatWorkspace.css`: thêm mobile drawer cho chat history, tablet collapsed sidebar, dark mode và styling neutral/minimal.

**Tested**
- `npm run build`: pass.

**Notes**
- FE vẫn dùng endpoint thật của dự án `/api/ai/conversations`, không đổi sang endpoint mẫu `/api/conversations`.
- Build vẫn có warning chunk lớn do stack markdown/Shiki đã thêm trước đó.

### 2026-06-30 - React Markdown AI Answer Renderer

**Summary**
- Chuyển renderer câu trả lời AI sang stack markdown chuẩn để hỗ trợ table, checklist, LaTeX, heading anchor và code highlight đẹp hơn.

**Changed**
- `package.json`, `package-lock.json`: thêm `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-slug`, `rehype-autolink-headings`, `rehype-pretty-code`, `shiki`, `@tailwindcss/typography`, `katex`.
- `src/components/AiAnswer.jsx`: dùng `MarkdownHooks` để chạy được async plugin `rehype-pretty-code`; vẫn giữ normalize AI output cho plain heading/table loose và giữ safe rendering với `skipHtml`.
- `src/components/AiAnswer.jsx`: thêm KaTeX math, GFM table/checklist, heading anchor, copy icon cho code/table/source/result.
- `src/pages/student/ChatWorkspace.css`: bổ sung style markdown prose, KaTeX, Shiki code block, checklist, link và dark mode.

**Tested**
- `npm run build`: pass.

**Notes**
- `@tailwindcss/typography` đã được thêm theo stack yêu cầu, nhưng app hiện chưa bật Tailwind pipeline nên typography được map bằng CSS hiện tại.
- `rehype-pretty-code/shiki` làm build sinh thêm nhiều chunk language/theme; chức năng ổn, tối ưu bundle có thể làm ở phase sau.

### 2026-06-30 - AI Answer Formatting For Plain Headings, Math, Tables, And Sources

**Summary**
- Cải thiện renderer câu trả lời AI để format được kiểu output backend/LLM đang trả: heading plain text tiếng Việt, công thức LaTeX, bảng markdown có dòng trống, kết quả và nguồn material.

**Changed**
- `src/components/AiAnswer.jsx`: nhận diện heading plain text, block công thức `\[...\]`/`$$...$$`, inline math `\(...\)`, bảng markdown loose, dòng `Kết quả:`, và `materialId=...`.
- `src/pages/student/ChatWorkspace.css`: thêm style light/dark mode cho math block, inline math, result callout, source pill.

**Tested**
- `npm run build`: pass.

**Notes**
- Chưa thêm KaTeX/Markdown dependency; renderer vẫn là safe custom parser, không dùng `dangerouslySetInnerHTML`.

### 2026-06-30 - Longer Timeout For AI And Quiz Requests

**Summary**
- Sửa lỗi FE abort request quá sớm với message `Request timed out. Please try again.` khi backend cần thêm thời gian để RAG/LLM tạo câu trả lời hoặc quiz.

**Changed**
- `src/config/env.js`: tăng fallback `VITE_API_TIMEOUT_MS` từ 15 giây lên 60 giây.
- `src/services/apiClient.js`: thêm `API_TIMEOUTS` và sửa `request()` để truyền `timeoutMs` xuống `httpRequest`.
- `src/services/api.js`: AI chat, Code Mentor, code upload dùng timeout 180 giây; quiz generation dùng timeout 240 giây; material upload dùng timeout constant 180 giây.
- `src/services/api.js`, `src/services/studentApi.js`, `src/services/teacherApi.js`: bổ sung/expose quiz helper còn thiếu để UI quiz gọi đúng service layer.

**Tested**
- `npm run build`: pass.

**Notes**
- Nếu request vẫn timeout sau 180-240 giây thì nên đổi BE sang job/polling thay vì giữ HTTP request mở quá lâu.

### 2026-06-30 - Full Class Code Display In Student Chat

**Summary**
- Sửa class selector trong AI Tutor Chat để hiện đầy đủ mã lớp kiểu `Class SE1832` và không hiển thị class cũ không thuộc enrollment.

**Changed**
- `src/pages/student/ChatWorkspace.jsx`: class dropdown rộng hơn, selected label dùng mã lớp đầy đủ, không tự thêm stale `classId` vào options.
- `src/pages/StudentPortal.jsx`: chặn gửi chat nếu class hiện tại không nằm trong danh sách class hợp lệ của student.

**Tested**
- `npm run build`: pass.

**Notes**
- Class option vẫn lấy từ enrollment backend; nếu class không hiện, cần kiểm tra `GET /api/students/{studentId}/enrollments` có trả `classId` hay không.

### 2026-06-30 - Canonical Course ID For AI Tutor Chat

**Summary**
- Sửa lỗi FE có thể giữ/gửi alias course như `OSG` trong khi backend material/RAG dùng canonical `courseId` là `OSG202`.

**Changed**
- `src/hooks/useStudentEnrollmentOptions.js`: nếu state cũ là prefix/alias như `OSG`, tự resolve sang enrollment canonical như `OSG202` và class đúng.
- `src/features/student/hooks/useStudentEnrollments.js`: đồng bộ resolver cho architecture hook mới.
- `src/pages/student/ChatWorkspace.jsx`: không tự thêm courseId invalid vào dropdown; nếu value không nằm trong options thì hiển thị placeholder chọn course.
- `src/pages/StudentPortal.jsx`: chặn gửi AI chat nếu course hiện tại không nằm trong course options canonical.
- `docs/BE_FIX_REQUESTS_FROM_FE.md`: ghi rõ bằng chứng `OSG` rỗng, `OSG202` có material; BE alias mapping chỉ là optional.

**Tested**
- `npm run build`: pass.
- Local API verify:
  - `GET /api/courses/OSG/materials`: `count=0`.
  - `GET /api/courses/OSG202/materials`: có material indexed.
  - `POST /api/ai/query` với `OSG`: escalated/no sources.
  - `POST /api/ai/query` với `OSG202`: trả lời được, có source.

**Notes**
- Nếu user vẫn thấy `OSG`, cần reload FE để hook đọc lại enrollments và ghi đè session state sang `OSG202`.

### 2026-06-30 - Core Button UI And Support Flow Fixes

**Summary**
- Chuẩn hóa button/action menu theo hướng ChatGPT minimal và sửa các flow core: conversation delete, mentor support live chat, pinned messages, course material upload.

**Changed**
- `src/components/common/confirmDialog.jsx`: confirm chung chuyển sang popup nhỏ có thể neo gần action menu, click ngoài để đóng.
- `src/pages/student/ChatSessionsPanel.jsx`: bỏ `Modal.confirm`, dùng `EntityActionMenu` và confirm chung cho delete conversation.
- `src/pages/StudentPortal.jsx`, `src/pages/student/MentorSupport.jsx`, `src/pages/TeacherPortal.jsx`: hỗ trợ status `IN_CHAT`, gửi support chat kèm `senderRole`, đảo history về thứ tự đọc tự nhiên và disable send khi đang gửi.
- `src/pages/admin/AdminAcademic.jsx`: Course Materials upload có cooldown/polling sau timeout, action delete neo gần menu, Student Enrollment search disable khi input rỗng.
- `src/pages/student/ChatWorkspace.jsx`, `src/pages/student/ChatWorkspace.css`: pin message icon-only, top pinned bar giữ giới hạn 3 và scroll tới message.
- `src/components/common/StatusTag.jsx`, `src/index.css`: thêm label trạng thái support mới và style action/confirm dark mode.

**Tested**
- `npm run build`: pass.

**Notes**
- `AdminUsers` và `AdminBilling` vẫn còn dùng `Popconfirm`; chưa đổi vì ngoài phạm vi core flow lần này.

### 2026-06-30 - Mentor Choice Shows AI Tutor Chat Question

**Summary**
- Làm rõ luồng chọn mentor: mentor được chọn để trả lời đúng câu hỏi đã phát sinh trong AI Tutor Chat.

**Changed**
- `src/pages/student/MentorSupport.jsx`: đổi copy thành `Which mentor would you like to answer this AI Tutor Chat question?` và hiển thị preview câu hỏi gốc trước nút chọn mentor.
- `src/pages/student/MentorSelectModal.jsx`: modal chọn mentor nhận `escalation` và hiển thị block `Question from AI Tutor Chat`.
- `src/pages/StudentPortal.jsx`: truyền `selectedEscalation` xuống `MentorSelectModal`.
- `src/index.css`: thêm style light/dark cho block preview câu hỏi.

**Tested**
- `npm run build`: pass.

**Notes**
- Preview lấy theo thứ tự `question`, `questionPreview`, `title` từ escalation backend.

### 2026-06-29 - Admin Academic CRUD Actions For New Backend APIs

**Summary**
- Cập nhật FE theo nhóm CRUD mới của backend cho Semester, Course, ClassSection, CourseEnrollment, CourseMaterial metadata và Assignment service helpers.

**Changed**
- `src/services/api.js`: thêm helper `get/update/delete` cho semesters, courses, class sections, enrollments, assignments và course material metadata.
- `src/services/adminApi.js`, `src/services/teacherApi.js`, `src/services/fileApi.js`: expose lại các helper mới để chuẩn bị tách service domain dần.
- `src/components/common/EntityActionMenu.jsx`: thêm component menu 3 chấm dùng chung cho row actions.
- `src/pages/admin/AdminAcademic.jsx`: Terms, Courses, Class Sections, Student Enrollments và Course Materials dùng action menu 3 chấm; thêm View/Edit modal chung và delete/remove dùng confirm chung.
- `src/config/navigation.js`: chỉnh mô tả Teacher Materials đúng flow mới: teacher xem course materials và publish class assignments.

**Tested**
- `npm run build`: pass.
- Swagger BE local đã verify các endpoint CRUD mới đều tồn tại.

**Notes**
- Teacher Assignment UI chưa có assignment list riêng để gắn View/Edit/Delete trực tiếp; hiện mới bổ sung service helpers cho lát UI tiếp theo.
- ID chính như `courseId`, `classId`, `studentId` được khóa trong edit modal để tránh gọi sai path update/delete.

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

## [2026-06-30] FE API Coverage Phase 1
- Tạo tài liệu `docs/FE_API_COVERAGE.md` liệt kê các API của Backend và trạng thái cover ở Frontend.
- Chuẩn bị kế hoạch hoàn thiện các Phase cho Admin, Teacher, Student, loại bỏ hoàn toàn các phần thanh toán (Billing/Payment).

## [2026-06-30] Production AI Answer Renderer
- Thay `src/components/AiAnswer.jsx` bằng wrapper mỏng dùng renderer mới để không vỡ import hiện tại.
- Thêm `src/components/markdown/MarkdownRenderer.jsx` hỗ trợ Markdown, GFM table/task list, LaTeX KaTeX, heading anchor, safe links, image zoom, và fallback khi render lỗi.
- Thêm component dùng chung: `CodeBlock`, `CopyButton`, `MarkdownTable`, `MarkdownImage`, `MarkdownErrorBoundary`.
- Thêm `src/utils/markdownPreprocessor.js` để sửa các lỗi format AI hay gặp như bảng/list bị ngắt dòng, heading không có markdown, nhiều dòng trống, delimiter toán `\\[ \\]`.
- Thêm `src/utils/markdownSecurity.js` để chặn URL nguy hiểm; renderer vẫn dùng `skipHtml` để tránh XSS từ raw HTML.
- Thêm dependency `react-syntax-highlighter` và chỉ register các language phổ biến để tránh kéo toàn bộ bộ highlight vào build.
- Cập nhật `ChatWorkspace.css` cho typography, code block, table, image, KaTeX, error fallback, loading skeleton, dark mode và reduced motion.
- Cập nhật `ChatLoadingSteps.jsx` thêm markdown skeleton khi AI đang sinh câu trả lời.

**Tested**
- `npm run build`: pass.

## [2026-06-30] AI Answer Source Filename And Study Tip Analyze
- Map `materialId=...` từ AI answer/source evidence sang filename bằng danh sách `courseMaterials` đang load ở FE.
- Thêm `src/utils/sourceLabels.js` để chuẩn hóa `materialId/documentId/sourceMaterialId -> fileName/sourceFileName/title`.
- `AnswerEvidence` và `AiAnswer` dùng cùng source map nên không còn hiển thị raw material id nếu FE có metadata tài liệu.
- Section `Lưu ý để học tốt hơn` trong AI answer được format thành các study-tip item có underline khi hover.
- Click vào study-tip sẽ gọi lại `refreshSuggestions(tipText)`, gửi tip đó vào `POST /api/tutor/improve-suggestions` dưới field `question`.
- Cập nhật `apiService.getSuggestions(studentId, courseId, options)` hỗ trợ `classId`, `question`, `includeAiSuggestion`.
- Giữ nội dung study-tip được click thành suggestion ưu tiên trong `Learning Progress`, mở tab progress sau khi phân tích, và lọc các suggestion lỗi LLM để người dùng không thấy raw failure text.

**BE Flow Note**
- BE suggestion không tự đọc trực tiếp text đang hiển thị trong chat.
- Khi FE gửi `question`, BE ghi nó vào `StudentCourseMemory.recentQuestions`, sau đó build suggestions từ course-scoped memory: `weakTopics`, `recentQuestions`, `improveSuggestions`; nếu `includeAiSuggestion=true` thì LLM dùng snapshot memory đó.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Chat Source Download Links In AI Answer

- Nối `onDownloadSource` từ `ChatWorkspace` vào `AiAnswer` và `MarkdownRenderer`.
- Các dòng nguồn trong phần markdown như `Nguồn tài liệu đã dùng` giờ render thành link/button tải tài liệu nếu FE có material id.
- `sourceLabels` nhận thêm `_id` từ material metadata để map Mongo material id ổn định hơn.
- Giữ nút copy trên source pill như cũ.

**Tested**
- `npm run build`: pass.

## [2026-07-09] Optional n8n Harness Fallback Hardening

- Đổi local default `VITE_N8N_ENABLED=false` để FE chạy ổn bằng Spring Boot backend khi không test n8n.
- Tăng default n8n timeout lên `15000ms`.
- `n8nClient` parse cả JSON trả về dạng text, bắt empty/malformed response để fallback backend thay vì làm UI crash.
- `n8nService` normalize chat response `RAG_TUTOR/CODE/ESCALATE` về shape FE đang dùng.
- Bỏ toast “n8n offline/fallback” cho user; chỉ log console và hiển thị kết quả cuối cùng từ backend fallback.
- Quiz vẫn backend-direct, không nối `quiz-generate`/`quiz-submit` vì workflow n8n hiện còn response student quiz rỗng.

**Tested**
- `npm run build`: pass.
