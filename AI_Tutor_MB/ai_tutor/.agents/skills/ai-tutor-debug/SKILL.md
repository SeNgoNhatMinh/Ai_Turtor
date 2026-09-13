---
name: ai-tutor-debug
description: "Diagnose AI Tutor Flutter failures involving UI, Riverpod, JWT, Dio, n8n, chat or realtime; implement a fix only when requested."
---
# AI Tutor debug

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [api-contract](../../references/api-contract.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Collect the symptom, reproduction, expected/actual result and sanitized logs. Never request real tokens.
2. Read the exact screen -> controller/provider -> repository -> network path and relevant rules.
3. Test hypotheses with bounded read-only checks. Separate UI rendering from state, transport, contract and backend causes.
4. Check n8n base-path normalization, JWT expiry, identifiers, cancellation and subscriptions when relevant.
5. For diagnose-only requests, report the cause and minimal fix without writing files.
6. For authorized fixes, isolate the root cause, add a regression test and avoid unrelated refactors.
7. Report unresolved hypotheses honestly; do not infer an SDK lock from a hanging process alone.

## Deliver
Reproduction evidence, root cause/confidence, scoped fix if authorized and regression result.
