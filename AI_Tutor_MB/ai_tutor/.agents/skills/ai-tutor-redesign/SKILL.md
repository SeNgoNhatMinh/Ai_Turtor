---
name: ai-tutor-redesign
description: "Redesign existing AI Tutor Flutter screens while preserving business logic, state, APIs and navigation; use for UI-only changes or redesign previews."
---
# AI Tutor redesign

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [redesign-workflow](../../references/redesign-workflow.md)
- [ui-ux-checklist](../../references/ui-ux-checklist.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read rules/ui-preservation.md, design-system.md, accessibility.md and testing.md. Inspect the existing screen and its controller/repository consumers.
2. Record actions, callbacks, validation, provider reads, route parameters, async and session behavior using templates/redesign-brief.md.
3. For preview requests, present the brief and stop without editing. Otherwise establish one visual direction; ask before a material expansion.
4. Start snapshot-ui before implementation. If app/router-shell/dependency integration is authorized, name only the exact additional allowed files with --allow. Do not add data/application directories to evade protection.
5. Implement one screen or component slice using existing public interfaces. Use ai-tutor-shadcn if authorized integration is necessary.
6. Run check-ui and targeted regression checks; manually compare behavior in allowed presentation files. Report device/visual gaps.
7. Run finish-ui only after the verification record is satisfactory; a failed baseline must be investigated, not overwritten.

## Deliver
Before/after summary, preserved contracts, changed paths and verification record; no implied guarantee from hashes alone.
