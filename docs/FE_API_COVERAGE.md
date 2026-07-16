# FE API Coverage Map

This document tracks backend API coverage in the React frontend.

## Legend
- `UI done`: Exposed in a user-facing screen.
- `service only`: Helper exists, but UI is not part of the current demo scope.
- `partial`: The main flow exists, but one optional or scalable workflow is still limited.
- `BE gap`: FE cannot complete a clean workflow because no canonical read/list endpoint exists.
- `out of scope`: Intentionally hidden or not needed for demo.

## Audit Basis
- Re-audited on `2026-07-16` against the latest Java controllers, `FE_EDUCATION_FLOW_HANDOFF_VI.md`, `FE_API_BUSINESS_LOGIC_VI.md`, and the checked-in n8n workflow JSON.
- Controller code and the checked-in n8n workflow take precedence over older handoff text when documents disagree.
- “UI done” means the canonical endpoint is reachable from a visible flow; it does not mean every backend alias has a separate button.

## Demo Readiness
- Core student, teacher, and admin learning flows are demo-ready.
- The frontend covers all minimum screens listed in the current education handoff: AI chat/review, mentor selection and ChatRoom, quizzes, teacher review, senior candidate approval, academic administration, and materials.
- Payment/subscription UI is intentionally out of scope.
- n8n remains optional; backend direct is the stable local demo path.
- The remaining items are non-blocking optional coverage or require a better backend list endpoint; see `Known Remaining Gaps`.

## 1. Auth & Profile
- `POST /api/users/login` - `UI done`
- `POST /api/users/register` - `UI done`
- `GET /api/users/profile` - `UI done`
- `GET /api/users/{userId}/profile` - `UI done`
- `PUT /api/users/{userId}/profile` - `UI done`
- `PUT /api/users/{userId}/password` - `UI done`

## 2. Student Chat & Support
- `GET /api/ai/conversations?userId=&courseId=` - `UI done`
- `GET /api/ai/conversations/search?userId=&keyword=&courseId=` - `UI done`
- `POST /api/ai/conversations` - `UI done`
- `PATCH /api/ai/conversations/{conversationId}` - `UI done`
- `DELETE /api/ai/conversations/{conversationId}` - `UI done`
- `GET /api/ai/conversations/{conversationId}/messages` - `UI done`
- `GET /api/ai/conversations/{conversationId}/pinned-messages` - `UI done`
- `PATCH /api/ai/conversations/{conversationId}/messages/{messageId}/pin` - `UI done`
- `DELETE /api/ai/conversations/{conversationId}/messages/{messageId}/pin` - `UI done`
- `POST /api/ai/query` - `UI done`
- `POST /api/tutor/intent-classify` - `service only`
- `POST /api/code-mentor/query` - `UI done` through AI chat CODE routing
- `POST /api/code-mentor/upload` - `out of scope`; chat accepts pasted code, but there is no separate code-file upload UI
- `POST /api/tutor/escalations` - `UI done`
- `POST /api/tutor/escalations/select` - `UI done`
- `POST /api/tutor/escalations/cancel` - `UI done`
- `GET /api/tutor/escalations/history` - `UI done`
- `POST /api/chat/send` - `UI done`
- `GET /api/chat/history` - `UI done`
- `GET /api/chat/detail` - `UI done`
- `POST /api/chat/mark-read` - `UI done`
- `POST /api/chat/close` - `UI done`
- `GET /api/chat/unread` - `UI done`

## 3. Student Learning Progress & Quiz
- `GET /api/students/{studentId}/dashboard` - `UI done`
- `GET /api/tutor/students/{studentId}/courses/{courseId}/memory` - `UI done`
- `PUT /api/tutor/students/{studentId}/courses/{courseId}/memory` - `UI done`
- `POST /api/tutor/students/{studentId}/courses/{courseId}/memory/pinned-suggestions` - `UI done`
- `DELETE /api/tutor/students/{studentId}/courses/{courseId}/memory/pinned-suggestions` - `UI done`
- `POST /api/tutor/improve-suggestions` - `UI done`
- `GET /api/students/{studentId}/improve-plans` - `UI done`
- `GET /api/students/{studentId}/courses/{courseId}/improve-plan` - `UI done`
- `PUT /api/improve-plans/{planId}/complete` - `UI done`
- `POST /api/tutor/students/{studentId}/courses/{courseId}/suggestions/learn` - `UI done`
- `POST /api/tutor/students/{studentId}/courses/{courseId}/quizzes/generate` - `UI done`
- `GET /api/tutor/students/{studentId}/courses/{courseId}/quizzes` - `UI done`
- `GET /api/tutor/quizzes/{quizSessionId}` - `UI done`
- `POST /api/tutor/quizzes/{quizSessionId}/submit` - `UI done`
- `GET /api/tutor/students/{studentId}/courses/{courseId}/quiz-assignments` - `UI done`
- `POST /api/tutor/quiz-assignments/{assignmentId}/attempts` - `UI done`
- `GET /api/students/{studentId}/assignments` - `UI done`
- `GET /api/students/{studentId}/submissions` - `UI done`; merged into assignment status/result
- `POST /api/students/assignments/{assignmentId}/submit` - `UI done`
- `GET /api/assignments/{assignmentId}/file` - `UI done`
- `GET /api/submissions/{submissionId}/file` - `UI done`

## 4. Teacher
- `GET /api/mentors/{teacherId}/dashboard` - `UI done`
- `GET /api/mentors/{teacherId}/class-sections` - `UI done`
- `GET /api/tutor/escalations/teachers/{teacherId}` - `UI done`
- `POST /api/tutor/escalations/{id}/answer` - `UI done`
- `GET /api/tutor/answer-reviews/mentor-pending` - `UI done`
- `GET /api/tutor/answer-reviews/senior-pending` - `UI done`
- `POST /api/tutor/answer-reviews/{id}/senior-resolve` - `UI done`
- `GET /api/tutor/escalations/knowledge-candidates` - `UI done`
- `POST /api/tutor/escalations/knowledge-candidates/{id}/approve` - `UI done`
- `POST /api/tutor/escalations/knowledge-candidates/{id}/reject` - `UI done`
- `POST /api/mentor/courses/{courseId}/classes/{classId}/assignments/upload` - `UI done`
- `GET /api/mentor/courses/{courseId}/classes/{classId}/assignments` - `UI done`
- `GET /api/assignments/{assignmentId}` - `UI done`
- `PUT /api/mentor/assignments/{assignmentId}` - `UI done`
- `DELETE /api/mentor/assignments/{assignmentId}` - `UI done`
- `GET /api/mentor/assignments/{assignmentId}/submissions` - `service only`; class-wide submission list is the current grading UI
- `GET /api/mentor/courses/{courseId}/classes/{classId}/submissions` - `UI done`
- `PUT /api/mentor/submissions/{submissionId}/review` - `UI done`
- `POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate` - `UI done`
- `PUT /api/tutor/quiz-assignments/{assignmentId}` - `UI done`
- `DELETE /api/tutor/quiz-assignments/{assignmentId}` - `UI done`
- `POST /api/tutor/quiz-assignments/{assignmentId}/publish` - `UI done`
- `GET /api/tutor/teachers/{teacherId}/quiz-assignments` - `UI done`
- `PUT /api/tutor/quizzes/{quizSessionId}/teacher-review` - `UI done`
- `GET /api/tutor/courses/{courseId}/memories` - `UI done`

## 5. Admin Academic, Users, Materials
- `GET /api/admin/dashboard/stats` - `UI done`
- `GET/PATCH/DELETE /api/admin/users` - `UI done`
- `GET/PATCH/DELETE /api/admin/mentors` - `UI done`
- `POST /api/mentors/import` - `UI done`
- `GET /api/mentors/import/template` - `UI done`
- `GET /api/mentors/import/template.xlsx` - `UI done`
- `PATCH /api/admin/teachers/{teacherId}/role` - `UI done`; promote/demote and relogin notice
- `CRUD /api/admin/semesters` - `UI done`
- `CRUD /api/admin/courses` - `UI done`
- `PATCH /api/admin/courses/{courseId}/complete` - `UI done`
- `CRUD /api/admin/courses/{courseId}/class-sections/{classId}` - `UI done`
- `PATCH /api/admin/courses/{courseId}/class-sections/{classId}/complete` - `UI done`
- `CRUD /api/admin/enrollments` - `UI done`
- `POST /api/admin/class-sections/{courseId}/{classId}/students/import` - `UI done`
- `GET /api/admin/class-sections/students/import/template` - `UI done`
- `GET /api/admin/class-sections/students/import/template.xlsx` - `UI done`
- `POST /api/courses/{courseId}/materials/upload` - `UI done`
- `POST /api/courses/{courseId}/materials/url-toc` - `UI done`
- `POST /api/courses/{courseId}/materials/import-url` - `UI done`
- `GET /api/courses/{courseId}/materials` - `UI done`
- `GET /api/courses/{courseId}/materials/{materialId}` - `UI done`
- `PUT /api/courses/{courseId}/materials/{materialId}` - `UI done`
- `GET /api/courses/{courseId}/materials/{materialId}/pdf` - `UI done`
- `POST /api/courses/{courseId}/materials/reindex` - `UI done`
- `POST /api/courses/{courseId}/materials/{materialId}/reindex` - `UI done`
- `DELETE /api/courses/{courseId}/materials/{materialId}` - `UI done`

## 6. Diagnostics
- `GET /api/harness/logs` - `UI done`
- `GET /api/harness/error-logs` - `UI done`
- `GET /api/harness/traces/{traceId}` - `UI done`

## 7. Billing & Payment
- Subscription/payment endpoints - `out of scope`

## 8. Optional n8n Harness
- `/webhook/student-chat` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/answer-review` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/teacher-answer-escalation` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/senior-resolve-answer-review` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/senior-knowledge-approval` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/quiz-generate` - `feature flagged`, requires both `VITE_N8N_ENABLED=true` and `VITE_N8N_QUIZ_ENABLED=true`
- `/webhook/quiz-submit` - `feature flagged`, requires both `VITE_N8N_ENABLED=true` and `VITE_N8N_QUIZ_ENABLED=true`

n8n is an orchestration layer, not the canonical data store. FE refetches canonical backend resources after mutations and does not call an LLM provider directly.

The older `BACKEND_API_FE_HANDOFF.md` still mentions `/teacher-answer` in two places. The checked-in workflow, current education handoff, and backend smoke scripts use `/teacher-answer-escalation`; FE intentionally follows the executable workflow.

## 9. Known Remaining Gaps
- Teacher quiz review is visible in `Submission Grading`, but FE currently builds that queue by reading each class student's quiz history. This is demo-ready but not scalable. A backend `GET teacher quiz attempts pending review` endpoint is needed before the FE can paginate a canonical queue (`BE gap`).
- The generic `GET /api/tutor/answer-reviews` history endpoint has no standalone all-history screen. Mentor and senior pending queues, which are required by the BRD, are complete.
- Code Mentor file upload has no separate UI. Pasted code and CODE routing work through Student Chat.
- Backend aliases and legacy dashboard/payment endpoints are intentionally not duplicated in UI when a canonical endpoint already covers the same business action.
