# Current client contracts
This is a source-observed map, not a promise about a deployed backend. Re-read exact call sites.

## Auth and networking
auth_repository persists auth_token/user_id/role and profile metadata using secure storage and rejects an empty token.
springDioProvider and n8nDioProvider attach JWT. 401 handling excludes login/register.
Dio configuration has separate CRUD/AI/chat/auth timeouts. Preserve them.
n8n normalization keeps the base /webhook path by stripping the workflow's leading slash.
withN8nContext adds traceId and optional sessionId/authToken. Never log those values.

## AI workflows
- AiTutorRepository: REST conversation/history/search/pin; n8n /student-chat and /answer-review. Code mentor currently delegates to ask.
- Quiz: self-practice generate/submit and teacher AI draft use /quiz-generate and /quiz-submit; assignment/history/publish/review remain repository-specific REST.
- Teacher inbox: /teacher-answer-escalation.
- Senior: /senior-resolve-answer-review and /senior-knowledge-approval.
Do not substitute outdated /teacher-answer or assume all quiz actions are REST.

## Invariants
Preserve course.id versus course.code and class/user/session identifiers at each call site.
Preserve TEACHER, MENTOR, SENIOR_MENTOR, ADMIN mappings and student/teacher/admin route behavior.
Preserve pending/disabled states, CancelToken disposal, optimistic IDs, deduplication, pinning, evidence and history reconciliation.
Handle existing daily-limit/429 and conflict/409 behavior without inventing universal numeric limits.
Preserve realtime subscriptions, logout cleanup, live-lesson playback clock and voice lifecycle.
A route bypass or insecure policy found during redesign is a separate finding, not permission to repair unrelated logic.

## Old sources
The generic global AI Tutor skill's no-JWT and simplified quiz assumptions conflict with current code.
The example flutter-dart skill uses additional stacks not selected here.
The reference ZIP is a source of ideas, not a ready-made Flutter runtime or authority to run hooks.
