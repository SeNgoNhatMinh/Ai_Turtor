# AI Behavioral Teaching Strategy Recommendation

## Audit summary (Phase 1)

| Claimed component | Reality in repo |
| --- | --- |
| 5 Learning Cycles | `AdaptiveReviewPolicy.CYCLE_SIZE = 5` student questions (+ early triggers). Not five named pedagogical cycles. |
| Learning Evidence entity | Exists but **unwired**. Reviews use chat-derived `List<Map>` in `AdaptiveLearningReview.evidence`. |
| LearnerTopicState | **Does not exist**. Closest: `StudentTeachingProfile`, `weakTopics`, review `knowledgeGaps`. |
| Pedagogical Planner | **Does not exist**. Closest: `TeachingOrchestrator.resolvePlan`. |
| Teacher checkbox approval | **Exists** in `AdaptiveLearningReviewPanel` → `POST .../decision`. |
| Strategy catalog | Hard-coded Vietnamese labels in `ExplanationStyles` (6 styles). |

### Critical gap vs product requirement

Today `TeachingBehaviorRetrievalService.isActive` treats **student-scoped `AI_PENDING` as active**, so AI recommendations change tutor answers **before** teacher approval. Auto `applySupportLevelAutomatically` also writes a CONFIRMED AI `PedagogicalDirective`.

Target rule: **only teacher-approved strategies** enter Active Teaching Context.

## Target architecture (Phase 2)

```text
Student Q/A + quiz  →  Adaptive cycle (5 Q / early)
        →  EvidenceFacts + LLM structured recommendations (catalog codes only)
        →  AdaptiveLearningReview PENDING (recommendations NOT active)
        →  Teacher checkbox approve/reject
        →  TeachingBehavior APPROVED (student+course scope)
        →  TeachingOrchestrator Active Teaching Context
        →  Tutor prompt (method only; RAG remains factual authority)
```

### Reuse

- Review cadence, evidence build, decide API, StrategyChooser UI
- `TeachingBehavior` lifecycle (`AI_PENDING` → `APPROVED`/`REJECTED`)
- `TeachingOrchestrator` / `TeachingPlan` / `commitApplied`
- `PedagogicalDirective` for **teacher-controlled** notes only

### New / evolved

| Piece | Approach |
| --- | --- |
| Strategy Catalog | Java catalog with stable `strategyCode` + teaching instruction (expandable; no hard-coded prompt soup) |
| Recommendation | Structured items on review (`strategyCode`, reason, evidence refs, confidence…) |
| Active context | Load **APPROVED** student+course behaviors (+ optional teacher COURSE assignments) into prompt block |
| Support level | Keep for Learning Path counts / quiz counts / session label; **stop AI auto-writing style directives**; style moves to strategies |

### Support level map

| Usage | Keep / refactor |
| --- | --- |
| Learning Path lesson counts (6/5/3) | **Keep** as path difficulty, not teaching style |
| Worker-2 quiz count | **Keep** (business structure), optional later migrate |
| `SupportLevelPrompt.personalizationRules` / activeLevelReminder as style | **Refactor**: prefer Active Teaching Strategies; suppress auto AI directive style |
| Adaptive `decideTargetLevel` → auto CONFIRMED directive | **Refactor**: store suggestion only until teacher decide |
| `TeachingBehavior.supportLevels` filter | Keep for compatibility; strategies become primary |

## Compatibility

- Keep `teachingRecommendations: List<String>` for old FE/clients; add parallel structured field.
- Mongo: additive fields only (`strategyCode` on behavior, structured recommendations on review).
- No deletion of `supportLevel` columns/enums.

## Implementation notes (delivered)

1. `TeachingStrategyCatalog` — 10 stable codes + teaching instructions + `activeContextBlock`.
2. Review LLM prompt asks for `strategyRecommendations`; parser drops unknown codes / weak confidence.
3. `AI_PENDING` no longer enters tutor retrieval (`isActive` = APPROVED only).
4. AI no longer auto-confirms support-level directives; suggestion awaits teacher `decide`.
5. `TeachingOrchestrator.promptBlock` prefers Active Teaching Strategies catalog block.
6. FE `StrategyChooser` shows checkbox recommendations with reason/evidence; pending = not yet in chat.
