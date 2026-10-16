# Three-worker answer pipeline

## Roles

- Worker 1 — Answer Generator: creates the first grounded draft using the existing course RAG context and provider chain.
- Worker 2 — Grounding & Accuracy Reviewer: checks the draft against the same retrieved context and reports unsupported claims, contradictions, and missing key points.
- Worker 3 — Final Answer Refiner: revises the draft using the review report while preserving course-grounded facts and required response structure.

## Runtime behavior

Worker 2 and Worker 3 run after Worker 1 because they depend on its draft and review result. This is a sequential three-stage pipeline, not three parallel generators. It adds two utility-model calls to normal generated answers, so measure end-to-end p50/p95 latency and provider usage before enabling broadly.

Workers 2 and 3 use the existing server-side provider utility-generation route; no additional API key is needed. They do not run when an existing policy returns an immediate response, grounding blocks generation, a cached answer is returned, or a retrieval-only Learning Path request is handled. Trace events mark these paths as skipped/cached instead of claiming all workers ran.

## Observability

Every regular answer request receives an `aiTraceId`. MongoDB collection `ai_worker_trace_events` stores sanitized lifecycle events with worker ID, stage, status, model route, duration, and short detail. Admin API: `GET /api/admin/ai-worker-traces?limit=150`.

Admin UI route: `/admin/ai-logs/history`; the live three-worker panel refreshes every five seconds.

## Rollout checklist

1. Merge the backend PR and frontend PR, or deploy a release containing both changes.
2. Rebuild/redeploy the backend container and frontend image.
3. Ask a normal grounded course question that is not cached.
4. Open Admin → AI Logs → History and confirm Worker 1, Worker 2, Worker 3 all have events under the same trace ID.
5. Check statuses, durations, and errors; verify the final student answer remains grounded and retains required lesson/remediation sections.
6. Monitor latency, provider usage, and false changes in answer quality before keeping the pipeline enabled broadly.