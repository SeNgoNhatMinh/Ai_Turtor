# AI worker rollout and operations

## Production flow

1. `CourseAnswerPreparationService` prepares the request and retrieves course chunks/context once.
2. `CourseAnswerCacheStageService` checks for a cached answer. Cache hits can bypass generation.
3. `CourseAnswerGenerationStageService` builds the primary grounded-answer prompt and submits three independent generation tasks to `AiWorkerOrchestrator`.
4. Worker 1 generates the primary answer; Worker 2 generates a quiz; Worker 3 generates deep-study material. Each receives the original question and shared retrieved course context, not sibling worker output.
5. Existing grounding/completeness and recovery logic applies to Worker 1's answer only. Backend code then appends successful optional sections without an extra LLM synthesis call.
6. `CourseAnswerGenerationService` performs existing post-generation completion behavior. Learning Path remains retrieval-only and must not invoke this generation fan-out.

## Worker execution and failure handling

- Bounded executor defaults: core pool 3, max pool 6, queue capacity 24.
- Per-worker orchestrator wait timeout: 60 seconds in the current generation stage.
- Worker 1 is required for a usable answer. Quiz and deep-study outputs are optional; if either optional task fails, times out, or is rejected, its section is omitted while other available sections are retained.
- Cache hits, policy short-circuits, and retrieval-only Learning Path requests may skip worker execution. Do not interpret absence of worker events for those requests as a pipeline failure.
- A timeout bounds how long the orchestrator waits but does not guarantee cancellation of a provider call already running. Configure HTTP connect/read/call deadlines at the provider client.
- Avoid retries across all workers when only one task fails. Track provider limits, queue rejections, and end-to-end latency before raising concurrency.

## Observability

MongoDB collection `ai_worker_trace_events` stores lifecycle events with a shared trace ID, worker ID/name, stage, status, duration, and sanitized details. Successful output previews are stored as separate `OUTPUT` events, capped at 1,200 characters. Admin API: `GET /api/admin/ai-worker-traces?limit=150`.

The admin panel at `/admin/ai-logs/history` polls every five seconds. It shows execution status independently from output-preview events. Output previews are truncated and basic secret-like patterns are redacted; treat them as potentially sensitive and restrict the endpoint to authorized administrators.

## Rollout checklist

1. Merge backend PR #11 and deploy the backend before relying on the frontend panel in PR #12.
2. Run backend tests and the frontend production build.
3. Ask a normal, uncached grounded course question that passes policy.
4. Confirm Worker 1, Worker 2, and Worker 3 have events under the same trace ID, with separate answer/quiz/deep-study output previews.
5. Test partial failure, timeouts, and queue saturation; confirm the main answer and available optional sections behave as expected.
6. Monitor p50/p95 latency, provider usage, answer grounding, quiz correctness, and required lesson/remediation structure before enabling broadly.
