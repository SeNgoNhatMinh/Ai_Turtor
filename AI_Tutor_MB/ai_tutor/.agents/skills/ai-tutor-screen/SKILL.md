---
name: ai-tutor-screen
description: "Build or adjust an AI Tutor Flutter screen with existing providers, routing, localization and complete async states."
---
# AI Tutor screen

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [ui-ux-checklist](../../references/ui-ux-checklist.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read flutter, design-system, accessibility and ui-preservation rules; determine new-feature versus UI-only scope.
2. Inspect nearest existing screen and the exact provider/state APIs. Do not invent methods based on naming.
3. Map screen inputs, role, navigation parameters, lifecycle and all visible async states.
4. Compose small shared widgets with stable keys and narrow watches; keep network calls out of build.
5. Preserve action validation, enabled/pending behavior, keyboard/back and controller disposal.
6. For UI-only changes use the redesign baseline workflow; for new logic use ai-tutor-feature.
7. Add widget tests for relevant states, actions and navigation with provider overrides.

## Deliver
Screen implementation, behavior/state coverage and verification gaps.
