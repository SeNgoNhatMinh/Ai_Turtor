---
name: ai-tutor-test
description: "Add or run focused AI Tutor Flutter regression tests for repositories, providers, widgets and UI redesign preservation."
---
# AI Tutor test

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [testing](../../references/testing.md)
- [api-contract](../../references/api-contract.md)
- [ui-ux-checklist](../../references/ui-ux-checklist.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read testing.md rule. Establish the current baseline and inspect existing network/live-lesson tests.
2. Choose unit/provider/widget/integration level appropriate to the changed behavior; don't mock away the assertion target.
3. Use deterministic fake data, provider overrides, fixed clocks/locales and no live credentials.
4. Test callbacks, pending/disabled states, failure/retry, route arguments and disposal where applicable.
5. For visual changes, add stable goldens only if the environment supports reproducible fonts/platform; inspect updates.
6. Run targeted tests first, then broader checks proportionate to scope. Report exact commands and exit outcomes.
7. Keep kit test results separate from Flutter tests and manual device checks.

## Deliver
Tests or a read-only test plan as requested, command evidence and uncovered scenarios.
