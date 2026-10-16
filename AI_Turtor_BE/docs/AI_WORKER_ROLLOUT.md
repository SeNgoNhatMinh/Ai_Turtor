# AI Worker rollout plan (in-process Spring Boot)

## Current architecture assessment

The existing course-answer path is already staged:

1. `CourseAnswerPreparationService` prepares the request and retrieves course chunks/context.
2. `CourseAnswerCacheStageService` checks for a cached answer.
3. `CourseAnswerGenerationStageService` builds the prompt, calls the current provider chain, applies grounding/completeness guards, and returns the result.
4. `CourseAnswerGenerationService` owns post-generation completion, including the mandatory remediation headings.

The Learning Path path is intentionally retrieval-only. Do not add generation workers to `retrieveLearningPath`: it must not generate an answer that is discarded.

## Phase 1 implemented here

- Add a bounded `aiWorkerExecutor` isolated from the MVC request executor.
- Add a generic `AiWorkerOrchestrator` for independent tasks with timeout and partial-success results.
- Return explicit `SUCCESS`, `FAILED`, `TIMED_OUT`, or `REJECTED` status for each worker.
- Do not change RAG retrieval, prompt construction, response DTOs, provider routing, cache keys, persistence, or student-facing behavior.
- No provider API keys or secrets are stored in source control.

This is a safe foundation, not yet a change that fans out the production answer path. It deliberately avoids adding extra LLM calls to every student question before the actual latency bottleneck and cost are measured.

## Suggested first integration

For a future lesson-generation use case, pass the already-retrieved course context to independent tasks. Keep the primary explanation as the required result; examples or practice questions may be optional results. Merge only validated outputs and retain successful parts if an optional task fails. Do not retrieve RAG context separately in each worker.

For remediation, keep both `Conceptual Explanation` and `Visual Representation` mandatory. If either section is absent, run the existing completion/validation path; never treat a partial worker result as a complete remediation answer.

## Limits and operations

Defaults: core pool 3, max pool 6, queue capacity 24, per-worker timeout 25 seconds. Tune these using observed LLM latency and provider rate limits. A timeout bounds how long the orchestrator waits; it does not guarantee cancellation of an already-running network call, so provider-level HTTP deadlines remain required.

- Monitor worker status, duration, rejection count, and end-to-end RAG stages.
- Keep retries limited and per-task; do not retry every worker when only one fails.
- Do not use Llama Prompt Guard as a content-generation model. If later enabled, use it only for input-risk classification and fail safely on classifier errors.
- Run backend tests and compare p50/p95 latency and LLM request/cost counts before enabling any production fan-out.
