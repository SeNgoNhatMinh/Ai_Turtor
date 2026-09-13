---
name: ai-tutor-build-release
description: "Prepare or verify AI Tutor Flutter builds and release readiness, including Android signing and environment configuration."
---
# AI Tutor build-release

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Read release and security rules. Confirm platform, artifact and whether publication is actually authorized.
2. Inspect current pubspec, SDK, app identifiers, permissions, signing and dart-define configuration.
3. Flag debug release signing and sample identifiers as readiness gaps; don't fabricate production credentials.
4. Run the approved build target and record exact command/outcome; don't upload or publish as part of verification.
5. Check artifacts, version, environment, startup and critical flows on an appropriate device when available.
6. On Windows explicitly mark iOS compilation/signing as unverified without a macOS runner.
7. Do not change global SDK/editor/CI settings or store configuration without authorization.

## Deliver
Build evidence, artifact location if produced, release blockers and remaining platform checks.
