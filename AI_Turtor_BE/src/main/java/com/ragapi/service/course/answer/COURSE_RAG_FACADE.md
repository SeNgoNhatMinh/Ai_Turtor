# Course Answer RAG facade (no `CourseRagService`)

The Knowledge RAG entry point is `CourseAnswerService` → `CourseAnswerPipelineService`.

| Concern | Owner |
| --- | --- |
| Request policy / conversational gates | `policy/CourseAnswerRequestPolicyService` |
| Material retrieval | `search/CourseContextRetrievalService` |
| Improve-plan priority chunks | `context/CourseImprovePlanContextService` (via `CourseLessonContextService`) |
| Grounding | `grounding/CourseAnswerGroundingService` |
| Evidence / sources | `grounding/CourseAnswerEvidenceService` |
| Cache | `orchestration/CourseAnswerCacheStageService` |
| Prompt + workers | `generation/*` + `CourseAnswerGenerationStageService` |
| Support level prompt rules | `generation/SupportLevelPrompt` (enum; not `String.contains`) |
| Result assembly | `orchestration/CourseAnswerResultService` |

## Teaching personalization (separate from Knowledge RAG)

Teaching style is resolved by `service.behavior.plan.TeachingOrchestrator` into an immutable `TeachingPlan`, then composed into the pedagogical prompt block. Do **not** retrieve teaching behaviors inside the search package.

| Layer | Owner |
| --- | --- |
| Teacher UI | FE `features/teacher/teaching-methods` — Phương pháp giảng dạy AI |
| Teacher policy / support level | `PedagogicalDirectiveService` (directive-only early path) |
| Behavior ranking | `TeachingBehaviorRetrievalService` with `recordUsage=false` during plan resolve |
| Conflict / cap | `TeachingBehaviorConflictPolicy` (max 3 ranked) |
| Commit after generation | `TeachingOrchestrator.commitApplied` / `commitCacheHit` / `commitFailed` |
| Execution statuses | `APPLIED`, `SKIPPED`, `FAILED`, `CACHE_HIT` (CACHE_HIT never counts as applied) |

## Improve-plan provenance

`RagQueryIntent.sourceChunkIds` must pin textbook chunks **before** semantic candidate merge (`CourseRetrievalMergeService.pinPriorityChunks`). When material ids are missing, `CourseImprovePlanContextService` derives them from hierarchical chunk ids (`{materialId}:chapter:...`). Missing pins are logged as warnings — never silently dropped without a log line.
