# Prompt Guard Worker 2/3

## Integration

`PromptGuardService` is wired into `CourseAnswerPreparationService` before course-context retrieval. When enabled, Worker 2 and Worker 3 run in parallel through the bounded `AiWorkerOrchestrator`. A clear malicious classification returns a safe refusal before RAG retrieval. Classifier/network failures are fail-open so temporary Groq outages do not make the tutor unavailable.

The workers are input-risk classifiers only; they do not generate tutor answers. Learning Path remains retrieval-only.

## Environment variables

Set these in the backend deployment environment (never in frontend Vite variables):

- `AI_WORKER_PROMPT_GUARD_ENABLED=true` to enable the feature; default is `false`.
- `GROQ_API_KEY` must contain a valid Groq server-side key.
- `AI_WORKER_PROMPT_GUARD_BASE_URL=https://api.groq.com/openai/v1`
- `AI_WORKER_PROMPT_GUARD_WORKER_2_MODEL=meta-llama/llama-prompt-guard-2-22m`
- `AI_WORKER_PROMPT_GUARD_WORKER_3_MODEL=meta-llama/llama-prompt-guard-2-86m`
- `AI_WORKER_PROMPT_GUARD_TIMEOUT_SECONDS=8`

Docker Compose now forwards these settings to the backend container. The `.env.deploy.example` documents the names; it intentionally leaves the feature disabled by default.

## Rollout checklist

1. Confirm both model IDs are available to the Groq account and the deployment has a valid `GROQ_API_KEY`.
2. Set `AI_WORKER_PROMPT_GUARD_ENABLED=true` in the backend environment only.
3. Rebuild/redeploy the backend container so the new Java code is running.
4. Test a normal academic question, a direct prompt-injection attempt, and a Vietnamese-language injection.
5. Check backend logs for worker status/duration without logging prompts or credentials.
6. Monitor false positives, request latency, and provider usage before keeping it enabled broadly.

Prompt Guard 2 models have a 512-token context window. Input is split into short segments before classification. The 22M model is optimized for low latency and English detection; the 86M model has broader multilingual support. Neither classifier is a complete security boundary, so retain existing policy and grounding guards.

## API reference

Groq documents both model IDs and the OpenAI-compatible Chat Completions endpoint:
- https://console.groq.com/docs/model/meta-llama/llama-prompt-guard-2-22m
- https://console.groq.com/docs/model/meta-llama/llama-prompt-guard-2-86m