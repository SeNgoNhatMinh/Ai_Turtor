---
name: ai-tutor-project
description: "Explain or navigate the AI Tutor Flutter project, its agent kit, architecture and safe workflow; use for onboarding and choosing project skills."
---
# AI Tutor project

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [runtime-compatibility](../../references/runtime-compatibility.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read the actual entrypoint, pubspec and relevant feature before giving architecture advice.
2. Explain the selected Riverpod/GoRouter/Dio structure and Spring versus n8n split. Mark source-observed behavior versus unverified backend expectations.
3. Route UI-only work to ai-tutor-redesign; visual exploration to ai-tutor-frontend-design; dependency integration to ai-tutor-shadcn; bug diagnosis to ai-tutor-debug.
4. Do not run implementation steps for a request to preview, explain or review.
5. Explain skills, canonical rules, runtime adapters and optional UI baseline separately. Never claim hooks are active just because JSON exists.

## Deliver
A short project-specific answer with relevant source paths, recommended next skill and any missing evidence.
