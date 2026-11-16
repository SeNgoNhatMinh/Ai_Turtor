# Context-Aware Personalized RAG Tutor

## Current chat lifecycle (audit)

`POST /api/ai/query` → `TutorController`

1. Resolve support-level / teacher directives (no behavior retrieve yet).
2. Classify intent (CODE / ESCALATE / RAG modes).
3. Build **Student Learning Context** (`StudentLearningContextService`) — topic-filtered memory + quiz evidence + temporary affect.
4. Build **TeachingPlan** (`TeachingOrchestrator`) — APPROVED strategies only.
5. Knowledge RAG prepare/retrieve/ground (`CourseAnswerPipelineService`).
6. Prompt: role → RAG rules → teaching style → personalization → ACTIVE PEDAGOGICAL DIRECTIVES → **STUDENT LEARNING CONTEXT** → COURSE MATERIAL → question.
7. Generate (3 workers) → commit strategy executions → save exchange → adaptive review hooks.

## Separation of sources

| Source | Role |
| --- | --- |
| COURSE MATERIAL CONTEXT | Factual authority (RAG) |
| STUDENT LEARNING CONTEXT | How to personalize explanation |
| ACTIVE TEACHING STRATEGIES | Teacher-approved persistent style |
| Temporary interaction signal | Tone/pacing only |

## Reused

- `TeachingOrchestrator` / `TeachingStrategyCatalog` / APPROVED-only retrieval
- `StudentCourseMemory` + weak/learned topics
- `LearningEvidence` entity (now wired from `QuizService` submit + teacher review)
- Adaptive Learning Review teacher approval gate

## New

- `StudentLearningContext` + `StudentLearningContextService`
- `LearnerAffectDetector` (rule-based, optional)
- Prompt section rename `LEARNER MEMORY` → `STUDENT LEARNING CONTEXT`
- Quiz → LearningEvidence production writes

## Same question, different students

Same RAG materials + different contexts:

- Student A: gap on for-loop + APPROVED `STEP_BY_STEP` → small ordered steps, misconception callout.
- Student B: theory OK, weak practice + APPROVED `GUIDED_PRACTICE` → scaffolded exercise, less definition.
- Student C: recent high quiz + APPROVED `INDEPENDENT_CHALLENGE` → concise, deeper check.

Personalization never invents course facts outside retrieved materials.
