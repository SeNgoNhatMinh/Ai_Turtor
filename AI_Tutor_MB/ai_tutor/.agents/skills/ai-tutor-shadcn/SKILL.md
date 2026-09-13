---
name: ai-tutor-shadcn
description: "Integrate or migrate AI Tutor Flutter components to the shadcn_ui package without replacing Riverpod, GoRouter or existing behavior."
---
# AI Tutor shadcn

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [shadcn-integration](../../references/shadcn-integration.md)
- [project-map](../../references/project-map.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read shadcn.md and ui-preservation.md. Confirm authorization for dependency and app-shell integration.
2. Verify current SDK/lockfile and official shadcn_ui compatibility/docs. Never substitute shadcn_flutter or React packages.
3. Explain if the compatible release requires an SDK upgrade and obtain direction before that separate migration.
4. Record exact baseline exceptions before authorized app/pubspec changes. Add only the dependency version selected from verified constraints.
5. Integrate documented Material coexistence while preserving RealtimeBootstrap, localization, theme state and router identity.
6. Bridge tokens and one existing shared component first; migrate one representative screen.
7. Check overlays, back navigation, focus, keyboard, semantics and both themes; run dependency resolution, analyzer and targeted tests.
8. If package resolution or coexistence fails, report evidence and next options; do not rewrite architecture to force success.

## Deliver
Selected compatible dependency/API evidence, incremental integration diff and explicit regression results.
