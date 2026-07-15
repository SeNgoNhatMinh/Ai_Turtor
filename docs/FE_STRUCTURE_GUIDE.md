# AI Tutor Frontend Structure Guide

This guide records the production structure target after aligning the FE with the backend learning-flow BRD.

## Runtime

- `src/main.jsx` mounts `src/app/AppProviders.jsx` and `src/app/AppRouter.jsx`.
- `src/app/routes.js` is the source of truth for route-to-tab mapping.
- `src/App.jsx` is a thin authenticated composition layer; it must not own role business logic.
- `src/app/workspaces/StudentWorkspace.jsx`, `TeacherWorkspace.jsx`, and `AdminWorkspace.jsx` own role-specific controllers and data loading.
- Role workspaces and their portal tabs are lazy-loaded so login and unrelated roles do not download feature code eagerly.
- `src/features/auth/useAuthSession.js` owns the persisted current user, role normalization, and token cleanup.
- `src/app/useAppNavigation.js` owns URL route sync, active role/tab, theme class toggling, and persisted UI context.
- `src/app/layouts/AuthedLayout.jsx` owns the shared authenticated header/sidebar/toast shell.
- `src/features/student/learning/useStudentLearningController.js` owns Student Learning Progress, suggestions, memory updates, pinned suggestions, and answer review submission.
- `src/features/student/learning/useImprovePlans.js` owns improve-plan loading and completion; the Learning Progress page composes focused overview, memory, suggestion, plan, and edit-modal components.
- `src/features/student/chat/usePinnedChatMessages.js` owns backend-persisted message pins, the three-pin limit, legacy migration, and jump/highlight state.
- `src/features/student/chat/useAnswerFeedback.js` owns answer-review validation, payload mapping, form state, and duplicate-submit lock.
- `src/features/student/chat/useStudentChatTabController.js` owns chat-tab state and events; page components must not recreate this controller.
- `src/features/student/chat/conversations/*` owns conversation grouping, row rendering, loading/empty states, and the 10-question display helpers.
- `src/features/student/materials/useStudentMaterialsController.js` owns Student material/assignment data loading and downloads.
- `src/features/student/learning/useStudentLearningActions.js` owns page-level suggestion/plan actions used by Learning Progress.
- `src/features/student/quizzes/usePracticeQuizzes.js` owns self-study/assigned quiz loading, generation, start, submit, review, and retry state; quiz panels remain presentational.
- `src/pages/student/ChatWorkspace.jsx` only composes chat context, header, pinned bar, message timeline, and composer.
- `src/pages/student/ChatMessageList.jsx` renders message turns and owns per-message mentor support presentation state.
- `App.jsx` should stay a thin wiring layer while old portals are migrated. Do not add new business logic there.
- URL routes are canonical for navigation:
  - Student: `/student/chat`, `/student/progress`, `/student/quizzes`, `/student/materials`, `/student/mentor-review`
  - Teacher: `/teacher/classes`, `/teacher/quizzes`, `/teacher/materials`, `/teacher/grading`, `/teacher/review-queue`
  - Admin: `/admin/dashboard`, `/admin/users`, `/admin/academic`

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

The legacy `src/services/api.js` facade has been removed. Do not recreate a global API object; add a method to the owning domain service instead.

## AI Harness Boundary

- `src/features/ai-harness/trace.js` owns the request envelope (`traceId`, stable tab `sessionId`, `authToken`).
- `src/services/n8nClient.js` owns transport, timeout, abort, webhook URL, and technical error normalization.
- `src/features/ai-harness/n8nResponse.js` owns the pure response envelope validation and canonical RAG/CODE/ESCALATE normalization.
- `src/services/n8nService.js` owns workflow transport methods and delegates response normalization to the pure harness module.
- `src/features/ai-harness/quizGateway.js` owns the optional quiz harness feature flag and backend-direct fallback policy.
- Chat/review/teacher/senior AI workflows may use n8n; academic CRUD, enrollment, material, and canonical read APIs stay backend-direct.
- In production strict mode, never replay a timed-out mutation through another transport. Refetch the canonical backend resource instead.

## Performance Rules

- Keep role workspaces lazy and load only the active Teacher/Admin tab.
- Lazy-load optional dialogs such as Profile and website import.
- Do not add a global provider for a feature used by one dialog or one page.
- Keep markdown, syntax highlighting, quiz runner, tables, and material tools in feature chunks.
- Keep KaTeX and math parsing behind `MathMarkdownDocument`; ordinary AI answers must not download the math bundle.
- Keep Student Chat CSS separated by layout, messages, markdown, message actions, history, support, dark mode, and responsive ownership under `src/features/student/chat/styles`.
- Keep Quiz CSS under `src/features/student/quizzes/styles`; page-owned Learning Progress and Admin Academic CSS stay beside their page orchestrators.
- Keep Admin Academic tab views under `src/pages/admin/academic` and their shared entity mutation controller under `src/features/admin/academic`.
- Keep Teacher material columns/cards/tables under `src/features/teacher/materials`; the portal tab only composes them.
- Check production chunk output with `npm run build` after moving an import.

## Frontend Verification

- `npm test` runs dependency-free unit tests for deterministic FE contracts.
- `npm run lint` validates React hooks, imports, and JavaScript quality.
- `npm run build` validates Vite module paths, lazy chunks, JSX, and production bundling.
- `npm run check` runs lint, tests, and build in that order.
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
