# Frontend UI Action Coverage

## Audit Snapshot

Audit date: `2026-07-20`.

- Canonical runtime routes: `16`.
- JSX files containing button controls: `69`.
- Static button nodes: `182`.
- Static `onClick` bindings: `172`.
- Contract tests: `84` passing.
- Component/unit tests: `79` passing.
- Desktop/mobile app-shell E2E checks: `18` passing.

Static counts are inventory signals, not proof that every live backend mutation succeeds. n8n, RAG, indexing, WebSocket, and permission-sensitive actions still require the live scenarios listed below.

## Action Contract

Every mounted action must follow these rules:

1. A visible action has a real handler or is disabled with a useful explanation.
2. Mutations lock while pending so double clicks cannot create duplicate requests.
3. Success is shown only after a valid API receipt; local state, toast, or WebSocket data cannot manufacture success.
4. Canonical REST refetch restores state after a mutation or realtime notification.
5. Cancel never calls the destructive endpoint.
6. Technical backend/n8n errors are normalized before reaching users.
7. Keyboard users can activate row-level navigation with `Enter` or `Space`.

## Removed Or Corrected Controls

| Area | Removed/corrected behavior | Reason |
|---|---|---|
| App sidebar | Removed static `Backend API Connected`, `MongoDB Running`, and `Elasticsearch Ready` indicators | They were hard-coded claims, not health checks. |
| Header | Removed the Admin account-role switch | It changed UI workspace without changing authenticated permissions. |
| Teacher roster | Removed the `Support` row action | It only displayed `Opening support chat...` and had no API or route. |
| Empty Student chat | Removed the context-free `Nhờ mentor hỗ trợ` starter | Mentor escalation must be attached to a real question/AI answer. |
| Teacher classes | Removed duplicate refresh control | Both buttons performed the same refetch. |
| Student materials | Removed/disabled downloads without a real file; website materials show a type label | Prevents fake PDF actions for `HTML_URL` records. |
| Suggestions/markdown tips | Hide or disable controls when their callback/context is unavailable | Prevents clickable no-op UI. |
| Account display | Removed invented fallback person names | UI must not present fake identities. |
| Admin dashboard | Removed fake weekly-activity chart and fallback log row | Diagnostics now show API data or an explicit error state only. |

The real Mentor Support action remains under an AI answer because it carries question, conversation, course, and class context required by the backend.

## Automated Coverage

| Area | Coverage | Evidence |
|---|---|---|
| App chrome | Fake health and role-switch regressions | `tests/components/UiActionSafety.test.jsx`, `tests/uiActions.test.js` |
| Conversation mutations | Create/rename/delete lock and failure preservation | `tests/components/useConversationSessions.test.jsx` |
| Conversation navigation | Keyboard activation and menu propagation | `tests/components/UiActionSafety.test.jsx` |
| Prompt starters | Only valid course-learning prompts are mounted | `tests/components/PromptStarters.test.jsx` |
| Teacher official answer | Pending lock; failed request keeps typed answer | `tests/components/TeacherReviewPage.test.jsx` |
| Answer review | Missing callbacks disable controls | `tests/components/AnswerReviewCard.test.jsx` |
| Teacher grading | Reviewed state is read-only; pending final review is locked | `tests/components/TeacherGradingTab.test.jsx` |
| Admin dashboard | Real action navigation and no fabricated activity/log state | `tests/components/AdminDashboard.test.jsx` |
| Website material import | Admin/Teacher must analyze backend TOC and select entries before import | `tests/components/ImportWebsiteModal.test.jsx` |
| Material processing | Accepted upload keeps `materialId`, blocks duplicate processing upload and exposes indexing state | `tests/components/TeacherMaterialUploadCard.test.jsx`, `tests/components/materialsApi.test.js` |
| Student next steps | Only pending canonical assignment/quiz/support records become actions | `tests/studentNextSteps.test.js` |
| Teacher action center | Queue item routes to its owning feature and remains disabled without class scope | `tests/components/TeacherActionCenter.test.jsx` |
| Review history | Resolved Answer Review is read-only and cannot submit another decision | `tests/components/AnswerReviewCard.test.jsx` |
| Runtime routes | Unexpected API requests return `501` and fail E2E | `tests/e2e/app-shell.spec.js` |

The detailed per-button acceptance matrix is maintained in `docs/FE_BUTTON_ACTION_TEST_PLAN.md`.

## Live Verification Still Required

Run these against isolated demo data; they intentionally are not simulated as successful by the frontend:

- Student chat modes through n8n: `RAG`, `CODE`, and `ESCALATE`.
- Conversation rollover after the eleventh Student question.
- Pin persistence after logout/login.
- Mentor offer, selection, ChatRoom messages, final Teacher answer, and room close.
- Senior/Admin KnowledgeCandidate approve and reject with canonical RAG status.
- PDF/URL material indexing transitions through WebSocket plus REST refetch.
- AI-assisted file grading and Teacher final-score confirmation.
- Tutor V2 contribution approval/evaluation workflows.

## Result

No mounted runtime control intentionally reports a fake success or remains as a toast-only placeholder. Local-only controls are limited to legitimate UI state such as tabs, selection, preview, theme, and modal open/close.
