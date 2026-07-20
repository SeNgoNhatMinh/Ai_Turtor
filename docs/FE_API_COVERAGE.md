# FE API Coverage Map

This document tracks backend API coverage in the React frontend.

Action-level QA cases for the visible UI are maintained in `docs/FE_BUTTON_ACTION_TEST_PLAN.md`.

## Legend
- `UI done`: Exposed in a user-facing screen.
- `service only`: Helper exists, but UI is not part of the current demo scope.
- `partial`: The main flow exists, but one optional or scalable workflow is still limited.
- `BE gap`: FE cannot complete a clean workflow because no canonical read/list endpoint exists.
- `out of scope`: Intentionally hidden or not needed for demo.

## Audit Basis
- Re-audited on `2026-07-19` against the latest Java controllers, `FE_WEBSOCKET_TEACHER_EXAM_GUIDE_VI.md`, and the checked-in n8n workflows.
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
- `POST /api/mentor/assignments/{assignmentId}/answer-key` - `UI done`; private DOCX/PDF/TXT answer-key upload
- `POST /api/mentor/assignment-submissions/{submissionId}/ai-grade` - `UI done`; direct path when the optional n8n grading workflow is disabled
- `POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate` - `UI done`
- `POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/manual` - `UI done`; Teacher Online Quiz JSON import/create flow
- `PUT /api/tutor/quiz-assignments/{assignmentId}` - `UI done`
- `DELETE /api/tutor/quiz-assignments/{assignmentId}` - `UI done`
- `POST /api/tutor/quiz-assignments/{assignmentId}/publish` - `UI done`
- `GET /api/tutor/teachers/{teacherId}/quiz-assignments` - `UI done`
- `GET /api/tutor/teachers/{teacherId}/quiz-attempts` - `UI done`; paginated teacher quiz review list
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

## 6. Tutor V2 Expert Co-Training
- `POST /api/v2/expert-training/coverage/analyze` - `UI done`; Senior/Admin only
- `GET /api/v2/expert-training/coverage-gaps` - `UI done`
- `POST /api/v2/expert-training/tasks` - `UI done`
- `GET /api/v2/expert-training/tasks` - `UI done`
- `POST /api/v2/expert-training/tasks/{id}/assign` - `UI done`; self-claim flow
- `POST /api/v2/expert-training/gold-qa` - `UI done`
- `GET /api/v2/expert-training/gold-qa` - `UI done`
- `POST /api/v2/expert-training/gold-qa/{id}/approve|reject` - `UI done`; Senior/Admin only
- `POST /api/v2/expert-training/rubrics` - `UI done`; FE validates weights total `1.0`
- `GET /api/v2/expert-training/rubrics` - `UI done`
- `POST /api/v2/expert-training/rubrics/{id}/approve|reject` - `UI done`; Senior/Admin only
- `POST /api/v2/expert-training/eval-runs` - `UI done`; Senior/Admin only
- `GET /api/v2/expert-training/eval-runs` - `UI done`
- `GET /api/v2/expert-training/eval-runs/{id}` - `UI done`; per-case comparison

Tutor V2 is available at `/teacher/expert-training` and `/admin/expert-training`. The same lazy feature applies role-aware actions: Teacher contributes; Senior/Admin can analyze, approve/reject and run evaluation. `TRAINING` approval is rendered as `INDEXED`; `EVALUATION` approval is rendered as a private `APPROVED` holdout.

## 7. Diagnostics
- `GET /api/harness/logs` - `UI done`
- `GET /api/harness/error-logs` - `UI done`
- `GET /api/harness/traces/{traceId}` - `UI done`

## 8. Billing & Payment
- Subscription/payment endpoints - `out of scope`

## 9. Optional n8n Harness
- `/webhook/student-chat` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/answer-review` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/teacher-answer-escalation` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/senior-resolve-answer-review` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/senior-knowledge-approval` - `UI done`, controlled by `VITE_N8N_ENABLED`
- `/webhook/quiz-generate` - `feature flagged`, requires both `VITE_N8N_ENABLED=true` and `VITE_N8N_QUIZ_ENABLED=true`
- `/webhook/quiz-submit` - `feature flagged`, requires both `VITE_N8N_ENABLED=true` and `VITE_N8N_QUIZ_ENABLED=true`
- `/webhook/teacher-assignment-ai-grade` - `feature flagged`, requires both `VITE_N8N_ENABLED=true` and `VITE_N8N_ASSIGNMENT_GRADING_ENABLED=true`; failures are not replayed as duplicate backend mutations
- Tutor V2 mutation webhooks - `UI done`, controlled by both `VITE_N8N_ENABLED=true` and `VITE_N8N_TUTOR_V2_ENABLED=true`:
  - `/webhook/v2-coverage-analyze`
  - `/webhook/v2-gold-qa-submit`
  - `/webhook/v2-rubric-submit`
  - `/webhook/v2-gold-qa-approve`
  - `/webhook/v2-rubric-approve`
  - `/webhook/v2-eval-run`
- Tutor V2 rejects remain backend-direct because the checked-in n8n workflow has no reject webhook.
- All current n8n workflows receive JWT through `Authorization`; FE no longer copies the token into JSON bodies by default.
- Tutor V2 evaluation uses `VITE_N8N_TUTOR_V2_TIMEOUT_MS` with a `300000ms` default to match the long-running workflow node.
- Runtime verification and the three-workflow mapping are recorded in `docs/FE_N8N_THREE_WORKFLOW_VERIFICATION.md`.

## 10. Realtime Events
- `GET ws(s)://{backend}/ws/events?token={JWT}` - `UI done`; one authenticated app-level connection
- Material indexing, assignment assigned/submitted/reviewed, AI grading, and Tutor V2 task/contribution/evaluation events trigger canonical HTTP refetches.
- Tutor V2 subscriptions cover `EXPERT_TASK_*`, `GOLD_QA_*`, `RUBRIC_*`, and `EVAL_RUN_*`; duplicate `type + entityId + status` envelopes are ignored briefly.
- Reconnecting to `/ws/events` triggers a canonical refresh of the active Tutor V2 course.
- WebSocket events never manufacture upload, submission, grading, or review success in frontend state.

n8n is an orchestration layer, not the canonical data store. FE refetches canonical backend resources after mutations and does not call an LLM provider directly.

The older `BACKEND_API_FE_HANDOFF.md` still mentions `/teacher-answer` in two places. The checked-in workflow, current education handoff, and backend smoke scripts use `/teacher-answer-escalation`; FE intentionally follows the executable workflow.

## 11. Known Remaining Gaps
- The generic `GET /api/tutor/answer-reviews` history endpoint has no standalone all-history screen. Mentor and senior pending queues, which are required by the BRD, are complete.
- Code Mentor file upload has no separate UI. Pasted code and CODE routing work through Student Chat.
- Backend aliases and legacy dashboard/payment endpoints are intentionally not duplicated in UI when a canonical endpoint already covers the same business action.
