# Three-worker learning content pipeline

## Worker responsibilities

- **Worker 1 — Answer Generator:** produces the primary grounded answer using the student's question and the already-retrieved course RAG context.
- **Worker 2 — Quiz Generator:** independently creates five multiple-choice questions, four options per question, the correct answer, and a concise explanation.
- **Worker 3 — Deep Study Titles:** independently lists 3–5 short clickable deep-study topic titles grounded in the retrieved course context. It does not write a long essay.

These are separate generation tasks, not a reviewer/refiner chain. Worker 2 and Worker 3 do not receive or revise Worker 1's output. All three receive the original question and shared retrieved course context.

## Runtime behavior

The three tasks run concurrently through `AiWorkerOrchestrator`. Backend code applies answer grounding/completeness checks to Worker 1's answer before appending the optional quiz and deep-study sections. It then combines the validated answer and available optional sections deterministically; it does not call another LLM to rewrite or synthesize their content.

Worker 1's answer is required for a usable response. If Worker 2 or Worker 3 fails, times out, or is rejected, its section is omitted and successful sections are retained. Cached answers, policy short-circuits, and retrieval-only Learning Path requests may skip the pipeline, so not every incoming request should be expected to execute all three workers.

The three tasks use the existing server-side provider chain; no separate worker API keys are required. Orchestrator timeout bounds the wait but does not guarantee cancellation of an already-running provider HTTP call, so provider-level deadlines are still required.

## Observability

MongoDB collection `ai_worker_trace_events` records lifecycle events for each worker under a shared `aiTraceId`. Successful output excerpts are separately stored as `OUTPUT` events and truncated for admin inspection. Admin endpoint: `GET /api/admin/ai-worker-traces?limit=150`.

The frontend panel at `/admin/ai-logs/history` polls the trace endpoint every five seconds. Expand an output event to inspect that worker's generated excerpt. The worker cards report execution status separately from output-preview events.

## Rollout checklist

1. Merge and deploy backend PR #11, then deploy frontend PR #12 (or release both together).
2. Send a normal, uncached course question that passes policy and retrieval.
3. Open Admin → AI Logs → History and confirm all three workers have events with the same trace ID.
4. Expand each output event and verify that the answer, quiz, and deep-study content have distinct responsibilities.
5. Test partial failure, provider timeout, and pool saturation; confirm the UI never reports a missing output as success.
6. Run backend tests and frontend build, then monitor p50/p95 latency, provider usage, grounding, quiz correctness, and lesson/remediation formatting before broad production enablement.
