# AI Tutor Frontend Structure Guide

This guide records the production structure target after aligning the FE with the backend learning-flow BRD.

## Runtime

- `src/main.jsx` mounts `src/app/AppProviders.jsx` and `src/app/AppRouter.jsx`.
- `src/app/routes.js` is the source of truth for the canonical route, role, and tab mapping.
- `src/app/AppRouter.jsx` owns the real React Router `Routes` tree; `WorkspaceRoute` mounts only the workspace required by the current URL.
- `src/App.jsx` owns the authenticated shell and exposes shared runtime values through `Outlet` context.
- `src/App.jsx` is a thin authenticated composition layer; it must not own role business logic.
- `src/app/workspaces/StudentWorkspace.jsx` owns student identity/enrollment context. Teacher and Admin workspaces own only identity/context forwarding and route-page selection.
- Student, Teacher, and Admin route pages are lazy-loaded independently so opening one tab does not initialize API controllers for the other tabs.
- `src/features/auth/LoginPage.jsx` is the public auth-page entry; its visual parts live under `components`.
- `src/features/auth/hooks` owns login-form and persisted-session state.
- `src/features/auth/services/tokenStorage.js` is the only owner of JWT browser storage.
- `src/app/useAppNavigation.js` owns URL route sync, active role/tab, theme class toggling, and persisted UI context.
- `src/app/layouts/AuthedLayout.jsx` owns the shared authenticated header/sidebar/toast shell.
- `src/app/layouts/AuthedLayout.css` owns authenticated shell sizing, scroll boundaries and responsive layout. Do not move these rules back into `index.css`.
- `src/features/student/learning/useStudentLearningController.js` owns Student Learning Progress, suggestions, memory updates, pinned suggestions, and answer review submission.
- `src/features/student/learning/useImprovePlans.js` owns improve-plan loading and completion; the Learning Progress page composes focused overview, memory, suggestion, plan, and edit-modal components.
- `src/features/student/chat/usePinnedChatMessages.js` owns backend-persisted message pins, the three-pin limit, legacy migration, and jump/highlight state.
- `src/features/student/chat/useAnswerFeedback.js` owns answer-review validation, payload mapping, form state, and duplicate-submit lock.
- `src/features/student/chat/StudentChatPage.jsx` composes chat-only controllers and resources. `useStudentChatTabController.js` owns its local state and events.
- `src/features/student/chat/useConversationSessions.js` owns conversation CRUD, history loading, activity ordering, and turn-limit state.
- `src/features/student/chat/conversations/*` owns conversation grouping, row rendering, loading/empty states, and the 10-question display helpers.
- `src/features/student/materials/StudentMaterialsPage.jsx` owns material/assignment loading; `MaterialsAssignmentsView.jsx` composes the route UI; `components/*` owns course context, assignment list/details, and course-material presentation; `useStudentMaterialsController.js` owns only submission form state and actions.
- `src/hooks/useStudentAssignmentsController.js` joins assignment and submission resources so status, score, feedback, and submitted-file download stay consistent after refresh.
- `src/features/student/learning/useStudentLearningActions.js` owns page-level suggestion/plan actions used by Learning Progress.
- `src/features/student/quizzes/usePracticeQuizzes.js` owns self-study/assigned quiz loading, generation, start, submit, review, and retry state; quiz panels remain presentational.
- `src/pages/student/ChatWorkspace.jsx` only composes chat context, header, pinned bar, message timeline, and composer.
- `src/pages/student/ChatMessageList.jsx` renders message turns and owns per-message mentor support presentation state.
- `App.jsx` is a thin shell and must not receive feature business logic.
- `StudentPortal.jsx`, `TeacherPortal.jsx`, and the aggregate teacher runtime controller have been removed. Do not recreate role-level switch components.
- Student page containers live under `features/student/{chat,learning,quizzes,materials,mentor-review}`.
- Teacher page containers live under `features/teacher/{classes,quizzes,materials,grading,review}`.
- `src/features/teacher/materials/TeacherMaterialsPage.jsx` is the route controller, while `TeacherMaterialsView.jsx` only composes presentational cards, tables, and dialogs.
- `useTeacherAssignmentsController.js` owns assignment draft/list/edit/publish state; `useTeacherMaterialController.js` owns material upload/reindex/delete state. Do not merge these concerns back into one route-level hook.
- `src/pages/teacher/QuizAssignments.jsx` is a compatibility facade. Quiz assignment state and API mutations live in `features/teacher/quizzes/useQuizAssignmentsController.js`; generation, draft, list and publish UI live in focused `components/*` files.
- `src/pages/teacher/TeacherGradingTab.jsx` only selects the active grading mode. Submission navigation, file-assignment grading and quiz-result review are separate components under `features/teacher/grading/components`.
- `src/components/importWebsite/ImportWebsiteModal.jsx` is shared by Admin and Teacher. It must use the backend `url-toc -> selection -> import-url` flow; do not add browser crawling, direct import before analysis, or a mock-success path.
- Admin page containers live under `features/admin/{dashboard,users,academic}`.
- Admin account, mentor and support-request resources are owned by `features/admin/users/useAdminUsersController.js`; each Admin Users tab has an independent table component under `features/admin/users/components`.
- Route pages compose focused hooks; presentational screens under `pages/student` and `pages/teacher` must remain API-agnostic.
- URL routes are canonical for navigation:
  - Student: `/student/chat`, `/student/progress`, `/student/quizzes`, `/student/materials`, `/student/mentor-review`
  - Teacher: `/teacher/classes`, `/teacher/quizzes`, `/teacher/materials`, `/teacher/grading`, `/teacher/review-queue`
  - Teacher Tutor V2: `/teacher/expert-training?view=overview|work|content|evaluation`
  - Admin: `/admin/dashboard`, `/admin/users`, `/admin/academic`
  - Admin Tutor V2: `/admin/expert-training?view=overview|work|content|evaluation`
- Tutor V2 keeps selected work and review context in query parameters (`task`, `review`) so refresh and deep links do not lose the active record.
- Shared workflow primitives live under `src/components/common`: `ScopeBar`, `MetricStrip`, `WorkflowStepper`, `ActionQueue`, `MasterDetailLayout`, and `StatusLabel`.
- Shared workflow primitive styles live in `src/components/common/WorkflowUI.css`; feature styles should extend semantic classes instead of duplicating inline status/layout CSS.
- Canonical Vietnamese status metadata lives in `src/utils/statusLabels.js`; feature pages must not create competing status-label maps.

## Business Flow Rules

- Backend BRD is the source of truth.
- Student chat is scoped by `studentId + courseId`.
- Class section comes from enrollment and is read-only in Student Chat.
- Escalation starts as a support request, then follows `PENDING_OFFER -> OFFERED -> IN_CHAT -> COMPLETED` when a teacher is available.
- Student selects a matched teacher before backend creates a `ChatRoom`; both participants then use `/api/chat/**` and `/ws/chat`.
- The teacher's official final answer is separate from ordinary ChatRoom messages and may optionally propose a `KnowledgeCandidate`.
- Student feedback and teacher answers never train AI directly.
- Only senior/admin-approved `KnowledgeCandidate` is indexed into RAG.
- Payment/subscription is out of the core demo and must not be reintroduced into navigation/runtime.

## Service Structure

UI and controller code imports the domain API that owns its backend contract:

- `conversationApi`
- `materialsApi`
- `studentLearningApi`
- `quizApi`
- `assignmentApi`
- `aiTutorApi`
- `profileApi`
- `teacherApi`
- `teacherReviewApi`
- `adminAcademicApi`
- `adminUsersApi`
- `diagnosticsApi`
- `supportChatApi`
- `n8nService` for AI harness workflows only

All file downloads must use authenticated blob helpers in their owning service. Do not use `window.open` for protected `/api/**/file` endpoints because it cannot attach the JWT header.

The legacy `src/services/api.js` facade has been removed. Do not recreate a global API object; add a method to the owning domain service instead.

## AI Harness Boundary

- `src/features/ai-harness/trace.js` owns the request envelope (`traceId`, stable tab `sessionId`, `authToken`).
- `src/services/n8nClient.js` owns transport, timeout, abort, webhook URL, and technical error normalization.
- `src/features/ai-harness/n8nResponse.js` owns the pure response envelope validation and canonical RAG/CODE/ESCALATE normalization.
- `src/services/n8nService.js` owns workflow transport methods and delegates response normalization to the pure harness module.
- `src/features/ai-harness/quizGateway.js` owns the optional quiz harness feature flag and backend-direct fallback policy.
- `src/features/ai-harness/expertTrainingGateway.js` owns the optional Tutor V2 harness flag. When enabled, V2 mutations stay on n8n and are never replayed through a second transport after an uncertain failure.
- Chat/review/teacher/senior AI workflows may use n8n; academic CRUD, enrollment, material, and canonical read APIs stay backend-direct.
- In production strict mode, never replay a timed-out mutation through another transport. Refetch the canonical backend resource instead.

## Performance Rules

- Keep role workspaces and route pages lazy; load only the active Student, Teacher, or Admin screen.
- Keep `src/index.css` limited to tokens, reset and genuinely global compatibility rules; shell and feature layout rules belong beside their owners.
- Lazy-load optional dialogs such as Profile and website import.
- Do not add a global provider for a feature used by one dialog or one page.
- Keep markdown, syntax highlighting, quiz runner, tables, and material tools in feature chunks.
- Keep KaTeX and math parsing behind `MathMarkdownDocument`; ordinary AI answers must not download the math bundle.
- Keep Student Chat CSS separated by layout, messages, markdown, message actions, history, support, dark mode, and responsive ownership under `src/features/student/chat/styles`.
- Keep confirm-card and website-import styles beside their components instead of adding them back to `index.css`.
- Keep Quiz CSS under `src/features/student/quizzes/styles`; page-owned Learning Progress and Admin Academic CSS stay beside their page orchestrators.
- Keep Admin Academic tab views under `src/pages/admin/academic` and their shared entity mutation controller under `src/features/admin/academic`.
- Keep Teacher material columns/cards/tables and route orchestration under `src/features/teacher/materials`.
- Keep Tutor V2 shared UI, controller, validation and styles under `src/features/expert-training`; Teacher and Admin routes must lazy-load the same feature instead of duplicating portal logic.
- Keep shared Teacher display/record helpers under `src/features/teacher/shared`; `pages/teacher` must not own reusable logic.
- Check production chunk output with `npm run build` after moving an import.

## Frontend Verification

- `npm test` runs dependency-free unit tests for deterministic FE contracts.
- `npm run lint` validates React hooks, imports, and JavaScript quality.
- `npm run build` validates Vite module paths, lazy chunks, JSX, and production bundling.
- `npm run check` runs lint, tests, and build in that order.
- `npm run test:e2e -- --workers=2` verifies the desktop/mobile route shell, dark mode and overflow guards with strict API mocks.
- `npm run dead-code` and `git diff --check` are required before delivery.
- Add tests when changing n8n response envelopes, conversation limits, quiz normalizers, input validation, or markdown URL handling.
- Live backend/n8n behavior and responsive/dark-mode visuals still require integration/manual testing; unit tests must not claim those flows passed.

## Migration Rules

- Migrate one feature at a time; run `npm run build` after each feature.
- Do not add fake/default `courseId`, `classId`, `studentId`, or `teacherId`.
- Keep account roles canonical: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
- Treat ChatRoom sender roles `STUDENT` and `MENTOR` as transport labels only; `MENTOR` is not an account role.
- Keep `/api/chat/**` and `/ws/chat` participant access tied to the JWT-authenticated user.
- Do not add payment/subscription UI back to the main app.
- Prefer Ant Design plus shared components: `EntityActionMenu`, `ConfirmCard`, `StatusTag`, and `data-table`.
- Keep route paths stable so refresh/deep link works for every main workspace.
