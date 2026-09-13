---
name: ai-tutor-review
description: "Review AI Tutor Flutter diffs for regressions, UI-only scope, state/API preservation and maintainability; do not implement review findings automatically."
---
# AI Tutor review

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [api-contract](../../references/api-contract.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Inspect the scoped diff and pre-existing changes; do not attribute unrelated user work to this task.
2. Read applicable rules and trace changed code into consumers, providers and repositories.
3. Prioritize correctness, auth/session, identifiers, lifecycle, accessibility and callback behavior over stylistic preferences.
4. If UI-only, run check-ui when a baseline exists and inspect logic inside allowed presentation files.
5. Run safe relevant diagnostics as needed; no fixes, commits, pushes or deployments for review-only requests.
6. Report actionable findings with path/location, impact and evidence; state clearly if no findings, including residual test gaps.

## Deliver
Findings ordered by importance with evidence and test limitations; no gratuitous code changes.
