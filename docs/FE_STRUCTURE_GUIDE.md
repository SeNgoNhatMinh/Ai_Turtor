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
- `src/services/n8nService.js` owns workflow methods and canonical response normalization.
- `src/features/ai-harness/quizGateway.js` owns the optional quiz harness feature flag and backend-direct fallback policy.
- Chat/review/teacher/senior AI workflows may use n8n; academic CRUD, enrollment, material, and canonical read APIs stay backend-direct.
- In production strict mode, never replay a timed-out mutation through another transport. Refetch the canonical backend resource instead.

## Performance Rules

- Keep role workspaces lazy and load only the active Teacher/Admin tab.
- Lazy-load optional dialogs such as Profile and website import.
- Do not add a global provider for a feature used by one dialog or one page.
- Keep markdown, syntax highlighting, quiz runner, tables, and material tools in feature chunks.
- Check production chunk output with `npm run build` after moving an import.

## Migration Rules

- Migrate one feature at a time; run `npm run build` after each feature.
- Do not add fake/default `courseId`, `classId`, `studentId`, or `teacherId`.
- Keep account roles canonical: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
- Treat ChatRoom sender roles `STUDENT` and `MENTOR` as transport labels only; `MENTOR` is not an account role.
- Keep `/api/chat/**` and `/ws/chat` participant access tied to the JWT-authenticated user.
- Do not add payment/subscription UI back to the main app.
- Prefer Ant Design plus shared components: `EntityActionMenu`, `ConfirmCard`, `StatusTag`, and `data-table`.
- Keep route paths stable so refresh/deep link works for every main workspace.
