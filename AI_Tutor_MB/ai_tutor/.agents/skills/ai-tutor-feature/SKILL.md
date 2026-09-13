---
name: ai-tutor-feature
description: "Implement an explicitly requested AI Tutor Flutter feature using the existing Riverpod, GoRouter and Spring/n8n architecture."
---
# AI Tutor feature

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [api-contract](../../references/api-contract.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Clarify acceptance criteria and inspect neighboring feature patterns before choosing new files.
2. Read flutter, api-state, security and testing rules. Verify backend contracts if new endpoints or payloads are needed.
3. Reuse repositories/models/providers; do not introduce a second state-management or DI framework.
4. Keep IO in data and orchestration in application; build presentation with existing theme/wrappers and role-aware navigation.
5. Preserve session, cancellation and subscription cleanup; cover loading/empty/error and invalid inputs.
6. Write targeted provider/repository/widget tests with fakes. Run analyzer and relevant tests.
7. Do not reuse a UI-only baseline to authorize business changes. If one is active, resolve the task scope before continuing.

## Deliver
Implemented acceptance criteria, touched contracts, tests and any backend-dependent gaps.
