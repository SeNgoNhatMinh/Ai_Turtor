# FE API Coverage Map

This document tracks the integration status of Backend APIs into the Frontend UI.

## Legend
- `UI done`: Fully implemented in UI.
- `service only`: Exists in `services/`, but no UI screen uses it yet.
- `missing UI`: Both service and UI are missing.
- `not UI-facing`: Debug/internal or excluded (e.g., Payment).

## 1. Auth & Profile
- `POST /api/auth/login` - `UI done`
- `POST /api/auth/register` - `UI done`
- `GET /api/users/{id}/profile` - `missing UI`
- `PUT /api/users/{id}/profile` - `missing UI`
- `PUT /api/users/{id}/password` - `missing UI`

## 2. Student Features (Chat, Memory, Quiz, Improve)
- `GET/POST/PATCH/DELETE /api/ai/conversations` - `UI done`
- `POST /api/ai/query` - `UI done`
- `GET /api/student/memory/{userId}` - `UI done`
- `POST /api/tutor/quizzes/generate` - `UI done` (Generated via Chat)
- `POST /api/tutor/quizzes/{id}/submit` - `UI done`
- `GET /api/tutor/quizzes/{id}` - `missing UI` (History detail view)
- `GET /api/improve-plans` - `missing UI`
- `GET /api/improve-plans/latest` - `missing UI`
- `PUT /api/improve-plans/{id}/complete` - `missing UI`

## 3. Teacher Features (Classes, Assignments, Quiz, Support, Knowledge)
- `GET /api/classes` - `UI done`
- `GET/POST/PUT/DELETE /api/assignments` - `missing UI`
- `GET/POST /api/assignments/{id}/submissions` - `missing UI`
- `PUT /api/tutor/quizzes/{id}/teacher-review` - `missing UI`
- `GET/PUT /api/support/escalations` - `missing UI` (Actions missing)
- `GET/POST /api/knowledge-candidates` - `missing UI` (Actions missing)

## 4. Admin Features (Academic, Users, Materials)
- `CRUD /api/semesters` - `missing UI`
- `CRUD /api/courses` - `missing UI`
- `CRUD /api/classes` - `missing UI`
- `CRUD /api/enrollments` - `missing UI`
- `CRUD /api/users` - `missing UI`
- `CRUD /api/course-materials` - `missing UI`
- `POST /api/course-materials/{id}/reindex` - `missing UI`
- `POST /api/mentors/import` - `missing UI`
- `POST /api/enrollments/import` - `missing UI`

## 5. Billing & Payment
- *Skipped as requested.* - `not UI-facing`

## 6. Diagnostics
- `GET /api/admin/harness/logs` - `missing UI`
