# Frontend n8n End-to-End Verification

## Scope

- Verification date: 2026-07-16.
- Frontend: `http://localhost:5173`.
- Spring Boot: `http://localhost:8085`.
- n8n: `http://localhost:5678` using production webhooks.
- Runtime mode: n8n enabled and strict for AI/Human-in-the-loop mutations.
- Quiz harness remained disabled with `VITE_N8N_QUIZ_ENABLED=false`.

No access token, password, or credential is recorded in this report.

## Result Matrix

| Flow | Result | Evidence / blocker |
|---|---|---|
| Student `CODE` | Pass | The student-chat webhook returned canonical `CODE`, confidence and `conversationId`; FE normalization accepted the response. |
| Student `ESCALATE` | Pass | The webhook created an escalation; mentor offer/select then created a ChatRoom through canonical backend APIs. |
| Student `RAG` | Blocked by backend runtime | Intent classification selected RAG, but direct `/api/ai/query` failed with `Failed to generate embedding`; n8n therefore escalated instead of returning a grounded RAG answer. |
| Teacher final answer through n8n | Failed in workflow | `/teacher-answer-escalation` returned a failed business envelope. The same canonical payload succeeded backend-direct, proving the payload/business API can work and isolating the issue to the n8n workflow node. |
| Senior approve candidate | Pass | `/senior-knowledge-approval` approved the backend-created candidate. |
| Senior reject candidate | Pass | `/senior-knowledge-approval` rejected a second candidate with a rejection reason. |
| Conversation rollover after 10 student questions | Blocked by persistence | CODE responses did not persist a conversation message sequence and RAG could not run because embedding failed. No canonical 10-question conversation was available to verify rollover. |
| Pin persistence after logout/login | Blocked by missing persisted message IDs | The successful CODE envelope did not return `userMessageId` or `assistantMessageId`, and no persisted messages were available to pin through the conversation API. |
| Quiz through n8n | Not enabled by design | Quiz remains backend-direct until n8n returns a complete canonical quiz session for both generate and submit. |

## Required Backend / n8n Fixes

1. Restore embedding generation so `/api/ai/query` can complete a real RAG request.
2. Fix the n8n `teacher-answer-escalation` request/response node; the canonical backend mutation accepts the same payload.
3. Fix harness error logging so a failed node is not recorded as success and expression text is evaluated instead of stored literally.
4. Return canonical `userMessageId` and `assistantMessageId` from every persisted student-chat branch.
5. Ensure every chat branch persists the exchange and returns the backend conversation state needed for the 10-question limit and pin APIs.
6. Repair stale class-section teacher references where seeded class data contains a legacy teacher ID rather than the current teacher UUID.

## Frontend Safeguards Confirmed

- n8n HTTP 200 responses with failed business bodies are treated as errors.
- Strict mode does not replay an uncertain mutation through Spring Boot.
- User-facing UI receives friendly errors; technical workflow details stay in diagnostics/console.
- CODE/RAG/ESCALATE aliases, confidence, sources, IDs and improve suggestions are normalized into one FE response contract.
- Teacher/senior mutations are locked against duplicate clicks and refetch canonical backend state after completion or uncertain failure.
- Quiz remains backend-direct while the quiz harness feature flag is off.

## Visual Verification

Build and static responsive/dark-mode CSS checks passed. Automated browser visual verification could not run in the current Codex browser environment because the local browser harness failed to initialize. Student Chat, Learning Progress, Practice Quizzes, Teacher Review and Admin Academic still require a final manual viewport pass in Chrome at desktop, tablet and mobile widths.
