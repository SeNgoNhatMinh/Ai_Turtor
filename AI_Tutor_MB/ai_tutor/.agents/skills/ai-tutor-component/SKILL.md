---
name: ai-tutor-component
description: "Create or refactor reusable AI Tutor Flutter widgets, including shadcn_ui-backed controls, while preserving callbacks and accessibility."
---
# AI Tutor component

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [ui-ux-checklist](../../references/ui-ux-checklist.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read flutter and design-system rules. Search existing shared widgets and call sites before adding another component.
2. Document constructor inputs, callback semantics, loading/disabled/error states, focus/controller ownership and semantics.
3. Keep components presentation-focused; no repository/service calls or hidden provider-side mutations.
4. Prefer a compatible evolution of Fpt wrappers; use installed, verified shadcn APIs only.
5. Test callback counts, disabled/pending behavior, validation, semantics, themes and long labels.
6. Do not dispose externally owned controllers. Check all call sites for interface regressions.

## Deliver
Small reusable component with stable contract and focused tests.
