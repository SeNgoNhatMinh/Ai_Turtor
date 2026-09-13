---
name: ai-tutor-design-system
description: "Create or evolve the AI Tutor Flutter token system and shared component contracts across Material and shadcn_ui; use for theme consistency and design tokens."
---
# AI Tutor design-system

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [shadcn-integration](../../references/shadcn-integration.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Inventory core/theme and shared Fpt/portal/plugpro components; read design-system and shadcn rules.
2. Map semantic roles for backgrounds, surfaces, foregrounds, borders, primary/accent, success/warning/error, typography and spacing.
3. Preserve themeModeControllerProvider and context.fpt consumers while introducing a compatible bridge.
4. Keep light and dark theme decisions paired. Avoid hardcoded colors in screen widgets and duplicate token sources.
5. Preserve wrapper public APIs, states and semantics; document any necessary breaking interface change before proceeding.
6. Test theme switching, disabled/error/focus states and long/large text on representative components.

## Deliver
Token/component changes with migration notes, consumers affected and theme verification.
