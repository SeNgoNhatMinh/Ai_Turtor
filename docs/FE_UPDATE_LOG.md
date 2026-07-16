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

## [2026-07-16] Functional Student Chat Prompt Starters

**Summary**
- Fixed the four empty-chat prompt buttons so they send a real AI Tutor request instead of only filling the composer.

**Changed**
- Routed prompt starters through the same validated, request-locked `sendText()` flow as normal chat submissions.
- Reworded each starter to include course-material context and a complete request that can be answered immediately.
- Disabled starters while enrollment context is unavailable or AI is already responding.

**Tested**
- Verified prompt clicks reach the shared chat submit controller without changing backend payload contracts.

## [2026-07-16] Vietnamese Chat UI And UTF-8 Title Repair

**Summary**
- Fixed mojibake conversation titles such as `Cuá»™c trÃ² chuyá»‡n má»›i` and standardized the Student Chat experience in Vietnamese.

**Changed**
- Added a safe Windows-1252/Latin-1 to UTF-8 repair utility and applied it to conversation list, active chat, backend, and n8n titles.
- Added a Vietnamese fallback title, `Cuộc trò chuyện mới`, when a title is empty or still malformed.
- Translated visible chat history, course switching, turn limit, composer, loading, pin, answer evidence, feedback, suggestion, and teacher-support copy.
- Kept backend role, status, review type, and API payload enums unchanged.

**Tested**
- Added contract tests for malformed and valid Vietnamese text.
- Verified conversation normalization repairs the reported title without changing valid Vietnamese.

## [2026-07-16] Remove Explain More Simply Action

**Summary**
- Removed the `Explain more simply` follow-up action from AI answers.

**Changed**
- Deleted the action and its unused prompt-building helper from `AnswerActionBar`.
- Kept retry and mentor-review recovery actions unchanged.

**Tested**
- Final lint/build verification completed after the change.

## [2026-07-16] Demo-Friendly Entity Names

**Summary**
- Replaced visible internal user, mentor, enrollment, quiz-session, support-ticket, and material IDs with human-readable names or neutral workflow labels.

**Changed**
- Added a shared person-name resolver so IDs remain API values and React keys but are not rendered as display text.
- Admin enrollment now searches and selects students by name/email, while still submitting the backend student ID.
- Class teacher, student roster, grading, quiz publishing, answer review, and support screens now prefer names and email metadata.
- Preserved course/class codes because they are academic identifiers used by users, not opaque database IDs.

**Tested**
- `npm run check`: pass (lint, 33 contract tests, 11 unit/component tests, production build).
- `npm run dead-code`: pass.
- `npm run test:e2e`: pass, 6/6 desktop/mobile route checks.
- `git diff --check`: pass.

**Notes**
- If a backend response contains only an opaque person ID and no resolvable account metadata, FE shows a neutral `Student`, `Teacher`, or `Mentor` label instead of exposing the raw ID.

## [2026-07-16] Admin Route-Level Feature Pages

**Summary**
- Applied the same route-level feature architecture to Admin and removed the final role-level portal switch.

**Changed**
- Added lazy Admin Dashboard, Users, and Academic page containers under `features/admin`.
- Split the aggregate admin runtime into a Dashboard controller and a mutation-locked mentor import hook.
- Reduced `AdminWorkspace` to route-page selection and removed `AdminPortal.jsx` plus `useAdminRuntimeController.js`.
- Preserved the existing Admin page spacing in a feature-owned responsive stylesheet.
- Replaced deprecated Admin `Tabs.TabPane`, `Statistic.valueStyle`, `Alert.message`, and `Modal.destroyOnClose` usage with current Ant Design APIs.
- Fixed the diagnostics trace action to load the clicked trace ID immediately and replaced unstable random table keys.

**Tested**
- `npm run lint`: pass after route extraction.
- `npm run build`: pass with separate Admin Dashboard, Users, and Academic chunks.
- `npm run test:e2e`: pass, 6/6 including Admin Dashboard, Users, and Academic routes on desktop/mobile.

**Notes**
- Existing `pages/admin/*` files remain presentational/feature orchestrators; no backend endpoint or route changed.

## [2026-07-16] Student And Teacher Route-Level Feature Pages

**Summary**
- Removed the remaining role-level Student/Teacher portal switches and isolated each main route into its own lazy feature page.

**Changed**
- Added five Student pages under `features/student`: Chat, Learning Progress, Practice Quizzes, Materials, and Mentor Review.
- Added five Teacher pages under `features/teacher`: Classes, Quizzes, Materials, Grading, and Review.
- Reduced `StudentWorkspace` to enrollment/identity composition and `TeacherWorkspace` to identity/page selection.
- Removed unused `StudentPortal.jsx`, `TeacherPortal.jsx`, `useTeacherRuntimeController`, and `useCodeMentorController`.
- Added a StrictMode-safe route handoff for `Study now` responses and `Create quiz` suggestion topics so navigation does not lose user context.
- Each route now initializes only its own API hooks and data loaders.

**Tested**
- `npm run lint`: pass.
- `npm test`: pass, 34 tests.
- `npm run build`: pass with independent Student and Teacher page chunks.
- `npm run dead-code`: pass.
- `npm run test:e2e`: pass, 4/4 desktop/mobile tests.
- `git diff --check`: pass.

**Notes**
- Presentational screens remain under `src/pages/student` and `src/pages/teacher`; they can be moved later without changing route/controller ownership.

## [2026-07-16] Canonical Routing And Controller Boundaries

**Summary**
- Completed the next production refactor phase without changing backend endpoints, UI routes, or business behavior.

**Changed**
- Replaced the route-sync-only shell with a canonical React Router `Routes` tree and nested authenticated `Outlet`.
- Added `WorkspaceRoute` so each URL mounts only its Student, Teacher, or Admin workspace and preserves role guards.
- Removed duplicated `activeTab` state; the URL route is now the source of truth for selected navigation.
- Grouped Student and Teacher portal inputs by navigation, identity, and feature controller ownership instead of flat prop lists.
- Extracted Student conversation CRUD/history/turn-limit state into `useConversationSessions`; `useStudentChatController` now focuses on AI request handling.
- Split the 507-line Teacher runtime into dashboard, grading, and review-queue feature hooks; the runtime composer is now 33 lines.
- Moved Confirm Card and Website Import styles out of global `index.css` and removed the redundant Login import of the global stylesheet.

**Tested**
- `npm run lint`: pass.
- `npm test`: pass, 34 tests including canonical route contracts.
- `npm run build`: pass.
- `npm run dead-code`: pass.
- `npm run test:e2e`: pass, 4/4 desktop/mobile tests.
- `git diff --check`: pass.

**Notes**
- `index.css` still contains older page-level rules. Continue moving only well-bounded feature blocks; avoid a bulk CSS rewrite.

## [2026-07-16] FE Feature Modules, Lazy Chunks, And Regression Tests

**Summary**
- Completed the remaining frontend-only cleanup phase without changing backend endpoints or portal behavior.

**Changed**
- Moved Student chat, learning-action, and materials controllers from `pages` into domain-owned `features/student/*` modules.
- Reduced `ChatSessionsPanel.jsx` to a small composition layer and extracted conversation grouping, states, item rendering, and utilities.
- Reduced `AdminAcademic.jsx` to a tab orchestrator; extracted entity CRUD control and lazy-loaded academic tabs.
- Reduced `TeacherMaterialsAssignmentsTab.jsx` to a composition layer; extracted columns, upload/publish cards, and resource tables.
- Split Quiz, Learning Progress, and Admin Academic CSS by feature ownership; global CSS output dropped from about `121 KB` to `110 KB`.
- Lazy-loaded quiz runner/result and Admin Academic tabs. `PracticeQuizzes` is about `19 KB`, while `AdminAcademic` is about `25 KB` before gzip.
- Extracted the pure n8n response contract into `features/ai-harness/n8nResponse.js` while preserving the public `n8nService` interface.
- Added dependency-free Node tests for n8n envelopes, chat rollover/session helpers, quiz normalizers, validators, and markdown URL security.

**Tested**
- `npm test`: pass, 20 tests.
- `npm run lint`: pass with 0 errors and 0 warnings.
- `npm run build`: pass.

**Notes**
- Browser-level responsive/dark-mode checks and live backend/n8n E2E remain environment-dependent; unit tests cover the deterministic FE contracts only.

## [2026-07-16] Student Feature Decomposition And Live n8n Verification

**Summary**
- Completed the next maintainability phase for Student Chat, Learning Progress, and Practice Quizzes, then verified the active n8n workflows against the real local backend.

**Changed**
- Split the 2,901-line Student Chat stylesheet into layout, messages, markdown, message actions, history, support, dark-mode, and responsive feature styles.
- Centralized remaining visible Student Chat copy in English while retaining Vietnamese phrases only for backend-response detection.
- Reduced `LearningProgress.jsx` to a 247-line orchestrator with focused overview, memory, suggestions, improve-plan, modal, utility, and plan-controller modules.
- Reduced `PracticeQuizzes.jsx` from 576 to 176 lines; moved quiz state/API actions to `usePracticeQuizzes` and extracted reusable generate, assigned, history, item, stat, and utility modules.
- Added `docs/FE_N8N_E2E_REPORT.md` with a credential-free result matrix and required backend/n8n fixes.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 0 errors and 0 warnings.
- Live n8n: CODE, ESCALATE, senior approve and senior reject passed.
- Quiz remained backend-direct with `VITE_N8N_QUIZ_ENABLED=false`.

**Notes**
- RAG is blocked by backend embedding generation.
- Teacher final answer succeeds backend-direct but fails in its n8n workflow.
- Rollover and pin persistence require persisted message IDs/exchanges from the backend workflow before they can be verified.
- Final responsive/dark-mode visual QA remains manual because the local Codex browser harness could not initialize.

## [2026-07-16] Chat Workspace Decomposition And Markdown Bundle Split

**Summary**
- Reduced Student Chat component complexity and stopped loading KaTeX for every ordinary AI answer.

**Changed**
- Reduced `ChatWorkspace.jsx` from 773 lines to 210 lines by extracting the header, pinned bar, message timeline, composer, pin controller, and answer-feedback controller.
- Kept backend pin persistence, three-message limit, feedback payloads, mentor escalation cards, course-switch confirmation, and the 10-question counter unchanged.
- Split `MarkdownDocument` from `MathMarkdownDocument`; KaTeX, `remark-math`, and `rehype-katex` now load only when normalized content contains math delimiters.
- Kept malformed LaTeX fallback, safe `skipHtml` rendering, code-block lazy loading, tables, source links, and streaming cursor behavior.
- Displayed the enrolled class label in the read-only chat context instead of preferring the internal option value.

**Measured**
- `AiAnswer` default chunk: approximately `451.67 KB` to `159.31 KB` (`137.16 KB` to `49.36 KB` gzip).
- Optional math chunk: approximately `271.57 KB`, loaded only for answers containing formulas.
- `ChatWorkspace.jsx`: 773 lines to 210 lines.

**Tested**
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.

**Notes**
- `ChatWorkspace.css` remains large and should be split by chat layout, markdown, support, and responsive concerns in a separate low-risk CSS phase.

## [2026-07-16] AI Harness Contract And Learning Loop Hardening

**Summary**
- Completed the FE harness contract for student chat, answer review, teacher answer, senior review, candidate approval, and feature-flagged quiz workflows.

**Changed**
- Added a shared n8n request envelope with `traceId`, stable per-tab `sessionId`, and auth token propagation.
- Added per-flow timeouts and real request cancellation; Stop now aborts the active chat request instead of only changing UI state.
- Normalized n8n array/data wrappers, failed business responses, confidence, canonical IDs, sources, and improve suggestions.
- Added senior review resolution and quiz gateway methods; quiz harness remains disabled by default behind `VITE_N8N_QUIZ_ENABLED`.
- Fixed conversation history normalization for backend role `STUDENT` while retaining legacy `USER` compatibility.
- Rendered backend `nextImproveSuggestions` with `Study now` and `Create quiz` actions.
- Added mentor-review polling with exponential backoff and conversation refresh after `RESOLVED_INDEXED`.
- Locked senior/candidate mutations against duplicate clicks and refetched canonical queues after both success and uncertain timeout/error states.
- Added development warnings for legacy/unknown account roles; canonical roles remain `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, and `ADMIN`.

**Tested**
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.
- Local runtime health: n8n `5678` returned `200`; backend OpenAPI `8085` returned `200`.

**Notes**
- Live workflow E2E still requires n8n running with active workflows and valid webhook responses.
- Keep `VITE_N8N_QUIZ_ENABLED=false` until quiz workflow output has been verified against the canonical quiz session shape.

## [2026-07-15] Student Mentor Review UI Refresh

- Reworked Student `Mentor Review` into a clearer asynchronous review-ticket UI.
- Simplified the screen back to a two-pane layout: ticket list on the left and ticket detail on the right.
- Replaced chat-history-like ticket rows with dedicated ticket cards showing question preview, timestamp, course/class, status, and answered/waiting state.
- Detail content is separated into Student question, AI answer snapshot, Mentor answer, and protected AI-learning note.
- The first/latest ticket is selected automatically after loading so the panel is useful immediately.
- Removed remaining live-chat assumptions from the student support hook and made ticket loading callback-stable.
- Added responsive and dark-mode styles for the new Mentor Review layout.
- Fixed Mentor Review scrolling so the ticket list and ticket detail body scroll independently instead of clipping long content.
- Removed extra stats/policy/timeline sections after UX feedback that the screen only needs the two main panes.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 11 remaining legacy warnings outside Mentor Review.

## [2026-07-15] Practice Quiz History Response Normalization Fix

- Fixed `TypeError: history is not iterable` in `PracticeQuizzes`.
- Updated `quizApi` domain service to normalize quiz history and assigned quiz responses from common backend shapes such as `quizzes`, `quizSessions`, `assignments`, `items`, `content`, `data`, and `results`.
- Normalized generate/get/submit/start quiz responses through `normalizeQuizSession`.
- Added defensive array guards in `PracticeQuizzes` so raw object responses cannot crash the page render.
- Wrapped quiz loading in `useCallback`, removing the Practice Quizzes hook dependency warning.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 12 remaining legacy warnings outside Practice Quizzes.

## [2026-07-15] App Session, Navigation, And Student Learning Controller Extraction

- Continued the production structure refactor without moving large portal files.
- Added `src/features/auth/useAuthSession.js` so login session persistence, role normalization, and token clearing are no longer owned by `App.jsx`.
- Added `src/app/useAppNavigation.js` so URL route sync, role/tab navigation, theme class toggling, and persisted UI context are centralized.
- Added `src/features/student/learning/useStudentLearningController.js` so Student Learning Progress state, improve suggestions, memory updates, pin/unpin suggestion actions, and answer feedback submission are out of `App.jsx`.
- Switched `App.jsx` to use `src/app/layouts/AuthedLayout.jsx` for the shared header/sidebar/toast shell.
- Reduced `src/App.jsx` from 665 lines at the start of the route-shell work to 370 lines; it now acts mainly as a compatibility wiring layer for the existing portals.
- Removed the duplicate student bootstrap effect that loaded enrollments/chat sessions twice after login.
- Kept existing portal props and backend API contracts unchanged.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 13 remaining legacy warnings outside the new App extraction.

## [2026-07-15] Production Route Shell And BRD Flow Cleanup

- Added `react-router-dom` and a route shell under `src/app` with route mappings for Student, Teacher, and Admin workspaces.
- `App.jsx` now syncs active role/tab from URL paths such as `/student/chat`, `/teacher/review-queue`, and `/admin/academic`.
- Non-admin users can no longer switch role by URL; admin can still switch view modes for demo/admin workflows.
- Added centralized token helpers in `src/features/auth/tokenStorage.js`; auth, backend API, and n8n clients now use the same token boundary.
- Added domain API modules for conversations, materials, assignments, learning, quizzes, teacher review, admin academic/users, and diagnostics while keeping `apiService` as a compatibility facade.
- Removed runtime live mentor chat flow and deleted `TeacherLiveChatTab`, `useTeacherLiveChat`, and realtime chat hook.
- Removed payment/subscription runtime helpers and legacy payment CSS; Admin Dashboard now shows course count instead of subscriptions.
- Improve suggestion pins now use backend memory as source of truth; localStorage pinned suggestion fallback was removed.
- Deleted unused generated `src/output.css` to reduce source weight.
- Added `docs/FE_STRUCTURE_GUIDE.md` with the new target structure and migration rules.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with existing hook dependency warnings only.

## [2026-07-15] Robot Head Performance Fix

- Tối ưu `RobotHeadMascot`: bỏ `setState` trên mỗi `mousemove`, chuyển sang cập nhật CSS variables bằng `requestAnimationFrame`.
- Tắt `followMouse` cho các robot compact lặp lại trong Student Chat messages/loading để tránh nhiều window mouse listeners.
- Giữ animation idle/talking và robot login/main vẫn hoạt động bình thường.

**Tested**
- `npm run lint -- --quiet`: pass.
- `npm run build`: pass.

## [2026-07-15] Full n8n Strict Mode

- Thêm `VITE_N8N_STRICT=true` để AI/Human-in-the-loop không fallback backend khi workflow n8n lỗi.
- Student chat, answer review, teacher answer, senior approve/reject giờ bắt buộc đi qua n8n khi strict bật.
- Giữ webhook teacher answer theo workflow active hiện tại: `/teacher-answer-escalation`.
- Test n8n production webhook cho thấy `student-chat` và `answer-review` đang trả body rỗng; FE strict sẽ yêu cầu n8n Respond JSON để render/confirm thành công.
- Admin Dashboard hiển thị `Full n8n strict` để biết demo đang chạy qua n8n.
- Giữ các CRUD nghiệp vụ thường như materials/classes/quizzes theo backend direct đúng guide.

**Tested**
- `npm run lint -- --quiet`: pass.
- `npm run build`: pass.

## [2026-07-15] Align Escalation UX With Review Learning Loop

- Đọc lại `AI_TUTOR_PLATFORM_GUIDE.md` và `BACKEND_API_FE_HANDOFF.md`: escalation chuẩn là async review ticket, không phải student chat trực tiếp với mentor.
- Đổi Student navigation từ `1-on-1 Support` thành `Mentor Review`.
- Bỏ teacher `1-on-1 Support` khỏi navigation chính; teacher xử lý escalation trong `Support Queue & AI Knowledge`.
- Inline action dưới AI answer đổi sang `Send for review`; không còn chọn mentor/start chat/gửi tin trực tiếp.
- Student `Mentor Review` tab chỉ hiển thị ticket, câu hỏi, AI snapshot, trạng thái, và mentor answer nếu BE trả về.
- Dọn `useStudentSupport` để chỉ load escalation history; không gọi chat history/unread/send message từ student side nữa.
- Cập nhật status label: `IN_CHAT/ASSIGNED/OFFERED` được diễn giải thành review/routing status thay vì live chat.

**Tested**
- `npm run lint -- --quiet`: pass.
- `npm run build`: pass.

## [2026-07-14] Course Switch Inline Confirmation

- Replaced the hard-to-notice global course-switch confirm with an inline banner inside Student Chat.
- Selecting another course no longer immediately changes the dropdown value; the current course stays visible until the student clicks `Switch course`.
- Added `Cancel` / `Switch course` actions in the chat area so switching course history is explicit and less visually jumpy.
- Kept backend behavior unchanged: course switch still resets the active chat and loads that course's conversations only after confirmation.

**Tested**
- `npm run lint -- --quiet`: pass.
- `npm run build`: pass.

## [2026-07-14] Student Chat Read-Only Class Context

- Student chat now lets students switch only between enrolled courses.
- Class section is displayed as a read-only enrollment pill instead of a selectable dropdown.
- The selected course still drives the class automatically through enrollment data, so students cannot accidentally chat with a wrong class context.
- Updated the missing-class helper text to explain that class is assigned from enrollment.

**Tested**
- `npm run lint -- --quiet`: pass.
- `npm run build`: pass.

## [2026-07-14] Student Enrollment Identity Fix

- Checked backend enrollment flow: `/api/academic/students/{studentId}/enrollments` returns `CourseEnrollment[]` and looks up records strictly by `CourseEnrollment.studentId`.
- Switched the student enrollment service call from admin-only `/api/academic/students/{studentId}/enrollments` to student-safe `/api/students/{studentId}/enrollments`; the old path returned 403 for student accounts and made the chat UI think no class existed.
- Updated student enrollment loading to try the login user ID plus fallback lookup IDs, then keep the actual matched `resolvedStudentId`.
- Routed student chat, dashboard, code mentor, assignments, support, and quiz-facing props through the resolved enrollment student ID instead of guessing from login state every time.
- Hardened enrollment parsing for direct arrays and nested course/class response shapes.
- Kept class IDs canonical from backend, including existing `1833` and `SE1833` formats, while still allowing alias matching in selectors.
- Fixed New Chat creation so it sends both `courseId` and `classId` to backend conversation creation.
- Updated Admin enrollment resolver to prefer `studentId/studentCode` when available, then fall back to account UUID.

**Tested**
- `npm run lint -- --quiet`: pass.
- `npm run build`: pass.

## [2026-07-11] Frontend Bundle Lightening

- Lazy-loaded student portal tabs so `StudentPortal` no longer pulls Chat, Learning Progress, Materials, Support, and Practice Quizzes into one large chunk.
- Lazy-loaded `AiAnswer` from `ChatWorkspace`; markdown/math/code rendering now loads only when an AI answer is rendered.
- Lazy-loaded `CodeBlock` inside the markdown renderer so syntax highlighting loads only for answers that contain fenced code blocks.
- Lazy-loaded login/chat robot mascot and replaced `framer-motion` usage with CSS animation plus lightweight mouse tracking.
- Removed `framer-motion` from chat history; conversation list now uses CSS/normal DOM instead of animation runtime.
- Removed unused heavy dependencies:
  - `@react-pdf/renderer`
  - `@react-three/drei`
  - `@react-three/fiber`
  - `three`
  - `jspdf`
  - `@mozilla/readability`
  - `turndown`
  - `markdown-it`
  - `rehype-autolink-headings`
  - `rehype-pretty-code`
  - `shiki`
  - `@tailwindcss/typography`
  - `lottie-react`
  - `survey-core`
  - `survey-react-ui`
  - `zustand`
  - `@fontsource/noto-sans`
- Removed unused runtime preparation/dead-code files:
  - unused `src/app/*` app-shell/store experiment
  - unused `src/features/*` architecture hook scaffolding
  - unused duplicate domain service files such as `studentApi`, `teacherApi`, `chatApi`, `conversationApi`
  - stale `AdminBilling`, `SplineAvatar`, and unused common primitives
- Replaced the unused Lottie quiz submit animation with an existing lightweight icon animation.
- Runtime import graph now has `0` unreachable JS/JSX/TS/TSX files from `src/main.jsx`.
- `node_modules` size dropped from about `414M` to about `346M`.
- Production build no longer reports direct `eval` from `lottie-web`.
- Production build no longer reports chunks larger than 500KB after minification.

**Tested**
- `npm run build`: pass.
- Targeted ESLint for changed performance files: pass.
- `npx eslint . --quiet --format json`: 57 legacy errors remain outside this bundle cleanup.

## [2026-07-10] Student Portal Runtime Refactor Phase 1

- Reduced `src/pages/StudentPortal.jsx` from 486 lines to 282 lines.
- Moved student chat tab behavior into `src/pages/student/hooks/useStudentChatTabController.js`:
  - course switch confirmation
  - chat input/send/stop state
  - answer action handling
  - chat history rename state
  - source download handling
- Moved Learning Progress actions into `src/pages/student/hooks/useStudentLearningActions.js`:
  - auto dashboard refresh on Learning Progress tab
  - `Study now`
  - `Create quiz from suggestion`
- Moved assignment submission local state into `src/pages/student/hooks/useStudentMaterialsController.js`.
- Removed dead code review state/props from `StudentPortal.jsx`; Code Review is no longer exposed as a student navigation tab.
- `StudentPortal.jsx` now passes lint in isolation.

**Tested**
- `npm run build`: pass.
- `npx eslint src/pages/StudentPortal.jsx src/pages/student/hooks/*.js --quiet`: pass.
- `npx eslint . --quiet --format json`: 83 legacy errors remain outside the refactored StudentPortal shell.

## [2026-07-10] App Shell Runtime Refactor Phase 1

- Reduced `src/App.jsx` from a large mixed controller into a thinner runtime shell.
- Moved toast state, code mentor flow, student assignments, course material actions, admin runtime actions, and teacher runtime actions into dedicated hooks.
- Added `src/hooks/useTeacherRuntimeController.js` for teacher dashboard, submissions, support inbox, answer reviews, quiz review, and knowledge candidate actions.
- Removed duplicate teacher handlers from `App.jsx`; teacher portal now receives runtime state/actions from the hook.
- Fixed a legacy toast call in teacher quiz review so it uses the shared one-message toast API correctly.
- `App.jsx` now builds cleanly and no longer appears in the current ESLint error summary.

**Tested**
- `npm run build`: pass.
- `npx eslint . --quiet --format json`: 92 legacy errors remain in portal/component files, but the refactored app shell/hooks are clean.

## [2026-07-10] Admin Academic Table Standardization

- Standardized Admin Academic management tables to use the shared `DataTable` component.
- Converted Courses, Class Sections, and Student Enrollments from Ant Design `Table` to the shared table used by Terms and Course Materials.
- Added `loading` and `emptyText` support to `DataTable` so management screens can share consistent loading and empty states.
- Added Academic table overflow/dark-mode shell styling for consistent layout across Terms, Courses, Classes, Enrollments, and Materials.
- Kept existing CRUD/action menu behavior unchanged.

**Tested**
- `npm run build`: pass.

## [2026-07-10] Frontend Audit Cleanup

- Removed remaining visible Ant Design deprecation warnings in active screens:
  - `Spin tip` -> `Spin description`.
  - Student material cards `bodyStyle` -> `styles.body`.
  - Replaced Ant `List` rendering in student support, learning progress, quiz result, and teacher quiz assignment screens with local semantic markup.
- Switched Admin Users destructive actions from `Popconfirm` to the shared anchored `confirmDanger` dialog.
- Switched legacy Admin Billing destructive actions to the same shared anchored `confirmDanger` dialog.
- Added missing `zustand` dependency because existing `src/app/store/*` files import it.
- Re-ran deprecated API scan; no `bodyStyle`, `dropdownStyle`, `Spin tip`, Ant `List`, `Modal.confirm`, `Popconfirm`, or `dangerouslySetInnerHTML` matches remain in `src`.
- Re-ran lint audit: build is clean, but lint still has legacy React Compiler errors mainly in `App.jsx` and large portal files.

**Tested**
- `npm run build`: pass.

## [2026-07-10] Safe Error Wrapping For BE And n8n Flows

- Stopped showing direct `response.message` from n8n success responses in user toasts for answer review, teacher answer, and senior approve/reject flows.
- Updated old `App.jsx` catch blocks to use `getUserFacingError(...)` for quiz review, student feedback, teacher answer, mentor review, senior review, and knowledge candidate actions.
- Updated login errors to use the same user-facing API error helper.
- Added `N8nError` shaping in `n8nClient`/`n8nService` with safe `userMessage` plus debug-only `rawMessage/details`.
- n8n workflow errors remain console-debuggable while UI sees stable friendly copy or backend fallback results.
- Added `utils/errorMessages.js` to detect technical/LLM/mojibake error text and replace it with safe user copy.
- Hardened student chat controllers so raw LLM service failure text returned as a successful answer is shown as a retryable friendly AI bubble instead.
- Wrapped older code review, assignment submit/download, teacher upload/grade, diagnostics, mentor import, and profile/password flows with safe user-facing errors.

**Tested**
- `npm run build`: pass.

## [2026-07-10] Practice Quizzes UI/UX Refresh

- Reworked the student `Practice Quizzes` screen into a clearer dashboard layout.
- Added a hero section with course/class context and refresh action.
- Added overview stat cards for assigned quizzes, in-progress quizzes, submitted quizzes, and latest activity.
- Redesigned quiz generation as a guided 3-step flow: choose topic, refine topic, choose question count.
- Added suggested topic chips from learning suggestions.
- Replaced flat Ant List rendering for assigned/history quizzes with scannable quiz cards.
- Improved empty states and quick actions for assigned quizzes and quiz history.
- Kept existing quiz APIs and behavior unchanged.

**Tested**
- `npm run build`: pass.

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

## [2026-07-14] Inline Mentor Support In Student Chat

- Thêm `InlineMentorSupport` để chọn mentor ngay dưới câu trả lời AI có `questionEscalationId` hoặc khi student bấm `Hỏi mentor`.
- Flow trong chat giờ khớp BE: tạo/nhận escalation -> `/api/tutor/escalations/offer` -> chọn mentor `/select` -> mở live chat bằng `/api/chat/history` và `/api/chat/send`.
- Không tự chuyển student sang tab support khi bấm hỏi mentor; support gắn với đúng câu hỏi trong đoạn chat hiện tại.
- Sau khi mentor chat bắt đầu, student có thể gửi tin nhắn inline, reload history, end chat, hoặc bấm `Continue with AI Tutor` để quay lại AI chat với prompt tiếp nối.
- Thêm CSS light/dark cho card mentor support để UI gọn hơn, không dùng modal nặng.

**Tested**
- `npm run build`: pass.

## [2026-07-15] Admin Class Teacher Assignment

- Xác nhận BE đã có API tạo/sửa class section với field `teacherId`:
  - `POST /api/admin/courses/{courseId}/class-sections`
  - `PUT /api/admin/courses/{courseId}/class-sections/{classId}`
- Cập nhật Admin Academic -> Class Sections để chọn `Class Teacher / Mentor` bằng dropdown active mentors thay vì nhập tay mentor id.
- Khi chọn mentor, FE gửi kèm `teacherId`, `teacherName`, `teacherEmail` để class route mentor support rõ ràng hơn.
- Edit class section modal cũng dùng dropdown mentor giống màn tạo mới.
- Bảng class section hiển thị tên mentor và id để dễ kiểm tra mapping teacher của lớp.

**Tested**
- Pending.

## [2026-07-15] Mentor Offer UX And BE Escalation History Note

- Sửa bug inline mentor support tự mở khi AI answer có `questionEscalationId` nhưng chưa gọi `/api/tutor/escalations/offer`, dẫn tới list mentor rỗng.
- Card mentor giờ hiển thị collapsed state trước; user bấm `Choose who should help` mới gọi `/offer` và render mentor/teacher đúng route.
- Không bọc lỗi mất history bằng localStorage ở FE; backend conversation history phải là nguồn chuẩn.
- Thêm tài liệu yêu cầu BE sửa `handleEscalationIntent` để lưu exchange vào AI conversation: `docs/BE_FIX_REQUEST_ESCALATION_CHAT_HISTORY.md`.

**Tested**
- Pending.

## [2026-07-14] Student Chat Enrollment Guard

- Bỏ fallback course/class mẫu trong Student Chat (`PRJ301`, `SE1840`) để student mới không thấy lớp ảo.
- Bỏ default cứng `courseId='PRJ301'`, `classId='SE1840'` trong `App.jsx`; context ban đầu giờ là rỗng và phải đến từ enrollment/API thật.
- Guard material/dashboard loaders khi chưa có course để không gọi API bằng course rỗng.
- Chuẩn hóa enrollment mapping hỗ trợ cả `courseId/classId` và `courseCode/classCode`.
- Admin enroll giờ resolve input student/email/code sang đúng `userId` trước khi tạo enrollment.
- Student login load enrollment bằng nhiều định danh (`userId`, `studentId`, `studentCode`, `email`, `_id`) để tránh mismatch giữa account id và enrollment id.
- Chuẩn hóa class code alias: `1833`, `SE1833`, `se1833` được xem là cùng lớp; FE ưu tiên dùng `classCode` đầy đủ nếu BE trả về.
- Admin enroll/import class select ưu tiên `classCode` thay vì `classId` thô để tránh ghi enrollment bằng mã lớp ngắn.
- Nếu student chưa được enroll lớp nào, chat input/send/new chat bị khóa và hiển thị banner `Enrollment required`.
- Guard thêm ở controller để không gửi request AI/n8n/backend khi thiếu `courseId` hoặc `classId`.

**Tested**
- Pending.

## [2026-07-11] ESLint Legacy Debt Cleanup

- Xử lý toàn bộ 57 lỗi ESLint legacy còn sót sau refactor.
- Dọn import/biến không dùng để giảm code chết trong component Student/Teacher/Admin.
- Sửa các effect gọi `setState` đồng bộ bằng callback defer hoặc state cập nhật tại event handler.
- Tách `ConfirmCard` khỏi `confirmDialog` để hết lỗi Fast Refresh `only-export-components`.
- Sửa `vite.config.js` không dùng `__dirname` trong ESM.

**Tested**
- `npm run lint -- --quiet`: pass.
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

## [2026-07-10] Demo API Coverage And Backend Pinned Chat

- Chuyển pinned message trong Student Chat từ localStorage sang backend endpoints:
  - `GET /api/ai/conversations/{conversationId}/pinned-messages`
  - `PATCH /api/ai/conversations/{conversationId}/messages/{messageId}/pin`
  - `DELETE /api/ai/conversations/{conversationId}/messages/{messageId}/pin`
- Giữ giới hạn 3 pinned messages theo BE và hiển thị loading trên icon pin khi đang gọi API.
- Thêm migration một lần từ localStorage pin cũ sang BE để không làm mất pin đã tạo trước khi cập nhật.
- Thêm Admin Academic actions:
  - `Mark course complete`
  - `Mark class complete`
- Các action complete dùng confirm dialog chung và gọi API lifecycle của BE.
- Teacher `Assigned Classes` hiển thị thêm `Course Memory Signals` từ `GET /api/tutor/courses/{courseId}/memories`.
- Cập nhật `docs/FE_API_COVERAGE.md` theo trạng thái hiện tại để chuẩn bị demo.
- Đổi `CourseMaterialsTab` từ `bodyStyle` deprecated sang `styles.body`.

**Tested**
- `npm run build`: pass.
# 2026-07-16 - Mentor Review full student question

- Fixed Mentor Review details to prioritize the backend `originalQuestion` field instead of a shortened preview field.
- Kept ticket-list previews compact while allowing the selected ticket question to wrap and display in full.
- Selecting a ticket now calls `GET /api/tutor/escalations/{id}` and merges the complete escalation, latest mentor answer, and learning-review status into the detail panel.

# 2026-07-16 - Frontend AI Harness BRD

- Added `docs/FE_AI_HARNESS_BRD.md` as the implementation source for the frontend n8n AI Harness.
- Documented backend-direct versus n8n responsibilities, all seven harness workflows, request/response contracts, role permissions, state mapping, retry safety, diagnostics, acceptance criteria, and implementation phases.
- Recorded current integration gaps and source precedence so future Codex changes do not use stale webhook paths or outdated business flows.

# 2026-07-16 - Remove Unused Cloudflare Worker

- Removed the unused `worker` Cloudflare CORS proxy project and its obsolete setup README.
- Removed `VITE_CORS_PROXY_URL` from frontend runtime and local environment configuration.
- Kept website material import on the canonical backend flow: `url-toc` -> selected sections -> `import-url` using server-side Jsoup.
- Updated crawler architecture documentation to state that no frontend proxy/worker is part of the runtime.

# 2026-07-16 - Mentor Review Question Card Layout Fix

- Prevented Student Question, AI snapshot, waiting state, and learning note sections from shrinking inside the scrollable Mentor Review detail column.
- The detail container now owns vertical scrolling while each content block keeps its full natural height.
- Fixed the ticket status tag being stretched vertically by the detail header flex layout.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 11 existing warnings and 0 errors.

# 2026-07-16 - FE Reliability, Test Coverage, And Backend Contract Audit

- Added Vitest, Testing Library, Playwright, bundle visualization, and Knip checks without changing backend contracts.
- Added shared async loading/error/empty states, a recoverable application error boundary, accessible confirmation focus handling, request cache/deduplication, abort handling, and mutation locks.
- Added desktop/mobile E2E coverage for login, enrollment-scoped Student Chat, route navigation, dark mode, and horizontal overflow.
- Re-audited FE against the latest Java controllers and education handoff instead of relying only on the previous coverage document.
- Fixed Admin user updates to use the backend `PATCH` contract and exposed `TEACHER` / `SENIOR_MENTOR` promote-demote actions.
- Completed assignment metadata edit, student submission status/result loading, and authenticated submission downloads.
- Fixed the Teacher submission download path and removed unauthenticated `window.open` downloads.
- Added WebSocket reconnect with canonical REST history synchronization and a five-second REST fallback.
- Locked published quiz assignments to read-only actions and moved teacher result review guidance to Submission Grading.
- Documented remaining non-blocking gaps in `docs/FE_API_COVERAGE.md` instead of marking every endpoint as fully covered.

**Tested**
- `npm run check`: pass (`22` contract tests, `9` component/unit tests, lint, production build).
- `npm run test:e2e`: pass (`4` desktop/mobile app-shell tests).
- `npm run dead-code`: pass with no unused files, dependencies, or exports.

# 2026-07-16 - Runtime Workspaces And Bundle Cleanup

- Reduced `App.jsx` from a role-wide controller to a thin auth, navigation, layout, and workspace composition layer.
- Added isolated lazy workspaces for Student, Teacher, and Admin so only the signed-in role initializes its controllers.
- Lazy-loaded individual Teacher/Admin tabs and optional Profile/website import dialogs.
- Migrated core runtime controllers from the 845-line `apiService` facade to focused domain services.
- Added `aiTutorApi`, `teacherApi`, and `profileApi`; expanded quiz, review, diagnostics, admin user, and support domain APIs.
- Fixed Teacher quiz grading history to use the existing normalized `getStudentQuizHistory` API instead of the missing legacy `getStudentCourseQuizzes` method.
- Replaced the app-wide TanStack Query provider with a small profile hook and removed the unused global dependency.
- Stabilized hook dependencies and documented the TanStack Table compiler exception locally.
- Initial JavaScript entry chunk dropped from about `348 kB` to `148 kB`; Teacher workspace dropped from about `131 kB` to `20 kB`, and Admin workspace from about `59 kB` to `4 kB` before opening a tab.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 0 errors and 0 warnings.

# 2026-07-16 - Complete Domain API Migration

- Migrated every Student, Teacher, and Admin page/hook away from the legacy global `apiService` facade.
- Expanded focused services for improve plans, teacher quiz assignments, course memory, academic CRUD/lifecycle, mentor administration, escalation administration, and student import.
- Changed website import to receive `materialsApi` explicitly instead of a generic service object.
- Deleted the unused 845-line `src/services/api.js` compatibility facade after import-graph verification.
- Removed unused starter assets and the unreferenced `App.css` file.
- Updated structure and crawler documentation to use domain service ownership as the only supported API pattern.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 0 errors and 0 warnings.
- `rg` confirms there are no runtime imports or references to `apiService`.

# 2026-07-16 - Material And Assignment Display Names

- Normalized backend `sourceFileName` into the shared course-material model used by Student and Teacher screens.
- Removed raw material ID fallbacks from Materials & Assignments file-name columns.
- Assignment attachment details now show `attachmentFileName` or the assignment title instead of the assignment ID.
- Material IDs remain internal and are only used for download/reindex/delete API calls.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 11 existing warnings and 0 errors.

# 2026-07-16 - Canonical Roles And Two-Way Teacher Support Chat

- Standardized authenticated account roles to `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, and `ADMIN` through `src/constants/roles.js`.
- Separated canonical account role from lowercase workspace routing and ChatRoom sender labels.
- Removed email-based role inference; persisted login sessions are normalized back to the canonical backend role.
- Added `SENIOR_MENTOR` to Admin user filtering/editing and changed website material uploader role from legacy `MENTOR` to `TEACHER`.
- Added `supportChatApi` for escalation offer/select and ChatRoom history/detail/send/read/close endpoints.
- Added a shared support chat hook and UI with JWT WebSocket updates, REST fallback, polling, message deduplication, close/rating, responsive layout, and dark mode.
- Student can create support from an exact AI answer, find the matched class teacher, select the teacher, and chat inline or in Teacher Support history.
- Teacher Support Queue now shows the same ChatRoom before submitting the separate official final answer / optional KnowledgeCandidate proposal.
- Updated status labels and docs to reflect `PENDING_OFFER -> OFFERED -> IN_CHAT -> COMPLETED`.
- Corrected the transport contract: student ChatRoom sender role is `STUDENT`; `MENTOR` is only the teacher-side sender label and is not an account role.

**Tested**
- `npm run build`: pass.
- `npm run lint`: pass with 11 existing warnings and 0 errors.

# 2026-07-16 - Auth Feature Structure Cleanup

- Moved the login page from the generic `src/pages` folder to `src/features/auth/LoginPage.jsx`.
- Split the login hero and authentication card into focused components under `src/features/auth/components`.
- Moved login/register validation, request state, cooldown, and submit handling into `useAuthForm`.
- Kept the existing login/register API contract, visual classes, lazy robot mascot, and user-facing behavior unchanged.
- Updated application and component-test imports so no compatibility page or stale path remains.
- Grouped auth state under `features/auth/hooks` and token persistence under `features/auth/services`.
- Moved reusable Teacher record/class helpers from `pages/teacher` to `features/teacher/shared/teacherUtils.js`.
- Confirmed that the old Student, Teacher, Admin portal files and legacy `teacherPortalUtils.js` no longer exist or have runtime references.

**Tested**
- Login component tests: pass, 2/2.
- `npm run lint`: pass with 0 errors and 0 warnings.
- `npm run build`: pass.
- `npm run test:e2e`: pass, 6/6 desktop/mobile tests.
- Full `npm test`: pass, 34/34 tests.
- `npm run dead-code`: pass with no unused files, dependencies, or exports.
# 2026-07-16 - AI Answer Review Severity And Review Queues

- Aligned Student feedback severity with backend routing: moderate `Not correct` reviews now reach `NEEDS_MENTOR_REVIEW`; serious knowledge errors, source conflicts, and missing material reach `NEEDS_SENIOR_REVIEW`.
- Prevented `Need more detail` quality feedback from entering the Teacher queue.
- Added status-aware Student confirmation messages based on the backend/n8n review response.
- Expanded answer review normalization and Teacher/Senior cards to show student context, course/class, rating, accurate/helpful flags, question, previous AI answer, feedback, suggested correction, and creation time.
- Split queue visibility by canonical role: Teacher sees mentor-pending reviews; Senior Mentor/Admin sees senior-pending reviews and KnowledgeCandidates.
- Added separate senior review notes, corrected answer, and candidate type inputs. Creating a candidate does not imply RAG indexing; final approve/reject remains a separate action.
- Removed the incorrect Teacher action that created a duplicate `AiAnswerReview` instead of resolving the existing ticket.
- Documented the missing backend mentor-resolution mutation in `docs/BE_FIX_REQUEST_ANSWER_REVIEW_MENTOR_RESOLUTION.md`.
# 2026-07-16 - Teacher Quiz Attempt Aggregate API

- Connected Teacher Grading to `GET /api/tutor/teachers/{teacherId}/quiz-attempts` with backend-supported course, class, status, review status, page, and size filters.
- Removed the previous N-request aggregation that fetched quiz history once per student.
- Added a normalized paginated attempt model for auto score, final score, review status, and submission timestamps.
- Teacher Grading now loads full questions/answers only after selecting one attempt through `GET /api/tutor/quizzes/{quizSessionId}`.
- Added Pending/Reviewed/All review filters, loading states, total count pagination, and automatic pending-list refresh after teacher review.
- Student display names are enriched from the already loaded class roster; the quiz-attempt API remains the canonical source for attempt ownership and status.
