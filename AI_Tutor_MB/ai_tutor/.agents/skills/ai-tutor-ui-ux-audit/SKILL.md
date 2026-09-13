---
name: ai-tutor-ui-ux-audit
description: "Audit usability and accessibility of AI Tutor Flutter screens, especially chat, quiz, courses and teacher queues; use for UI/UX review without automatic fixes."
---
# AI Tutor ui-ux-audit

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [ui-ux-checklist](../../references/ui-ux-checklist.md)
- [project-map](../../references/project-map.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Inspect source and available screenshots/device states; distinguish source-inferred risks from reproduced defects.
2. Walk through each user task and loading/empty/error/offline/disabled/success state.
3. Check touch targets, text scaling, Vietnamese wrapping, semantics, focus, keyboard insets, contrast, themes and motion.
4. Inspect chat Markdown/citations/scroll/composer, quiz submission, course reading and role-specific actions as applicable.
5. Report prioritized findings with path/location, affected user, reproduction/evidence and smallest suggested fix.
6. Do not implement unless asked. A screenshot does not establish screen-reader behavior or runtime performance.

## Deliver
Prioritized actionable findings and a validation plan, with confirmed versus unverified observations.
