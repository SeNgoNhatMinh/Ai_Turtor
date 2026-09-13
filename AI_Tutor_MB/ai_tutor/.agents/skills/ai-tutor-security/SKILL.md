---
name: ai-tutor-security
description: "Review AI Tutor Flutter authentication, role access, learner data, external content and secrets without silently changing business policy."
---
# AI Tutor security

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [api-contract](../../references/api-contract.md)
- [project-map](../../references/project-map.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read security and api-state rules. Establish the review scope and inspect source without dumping credentials.
2. Trace token persistence/headers/logout, file access, role-gated actions, deep links and websocket session cleanup.
3. Review external links/Markdown/RAG rendering and sensitive diagnostics. Client checks never replace server authorization.
4. Distinguish exploitable evidence from defense-in-depth suggestions; avoid attacking production services.
5. Report severity, affected path, preconditions, impact and least-disruptive remediation.
6. Implement only authorized fixes and regression tests; do not rotate keys, alter roles or weaken checks by inference.

## Deliver
Evidence-backed findings with redacted examples and explicit scope limitations.
