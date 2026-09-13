# Runtime adapters
Verified against documentation on 2026-09-07; installed versions and managed policy can differ.

## Shared instructions
Codex: AGENTS.md plus direct .agents/skills discovery.
Cursor: AGENTS.md plus .cursor/rules and direct .agents/skills discovery.
.agents/rules is canonical documentation: Codex is routed by AGENTS.md; Cursor .mdc adapters point to the same files.
Do not create duplicate copies of all skills in .cursor/skills or the user home.
Invoke in plain language in either product; Codex supports $skill-name and Cursor's skill picker uses /skill-name where supported.

## Hooks
Codex .codex/hooks.json uses SessionStart/PreToolUse/PostToolUse with matcher groups.
Cursor .cursor/hooks.json uses sessionStart/preToolUse/postToolUse and version: 1.
Both invoke the same dependency-free Node script with an explicit adapter argument.
Open/start sessions in the Flutter folder containing pubspec.yaml. Relative hook commands intentionally do not use the parent monorepo Git root.
Node >=18 must be on PATH in the editor's process environment.
Codex project hooks require a trusted project layer and review of the exact definitions through /hooks on supporting CLI versions. Never bypass hook trust.
Cursor: inspect Hooks settings/output; workspace trust and organization policies may affect execution. Restart/reload and inspect actual logs if not loaded.
Skill discovery and hooks are distinct: a skill can work even when hooks are unavailable/disabled.

## Guard behavior and limits
Session hook reminds the agent of project guidance. Pre-edit hook denies recognized direct edits to generated Dart, and protected paths during an active UI baseline.
Post-tool hook reports protected-file drift while a baseline is active.
No hook automatically installs, formats, tests, commits, fixes code or retries forever.
Unrecognized tools, shell writes, disabled hooks and UI logic inside allowed files can bypass pre-edit detection; check-ui and human/agent review remain required.
Hook errors warn and fail open so a broken helper cannot brick the project. Explicit policy denials are blocking for supported events.
No filesystem/network security boundary is claimed. Scripts do not read transcript files, tokens or environment dumps.

Sources:
- https://developers.openai.com/codex/skills/
- https://developers.openai.com/codex/guides/agents-md/
- https://learn.chatgpt.com/docs/hooks
- https://cursor.com/docs/skills
- https://cursor.com/docs/rules
- https://cursor.com/docs/hooks
