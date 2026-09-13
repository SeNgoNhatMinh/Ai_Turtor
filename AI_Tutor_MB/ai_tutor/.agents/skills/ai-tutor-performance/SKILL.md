---
name: ai-tutor-performance
description: "Measure and improve AI Tutor Flutter scrolling, rebuilds, chat rendering and live-lesson performance without changing behavior."
---
# AI Tutor performance

## Load first
Read the root AGENTS.md and .agents/rules/core.md.
- [project-map](../../references/project-map.md)
- [testing](../../references/testing.md)
Paths mentioned in workflow steps are relative to .agents/ unless prefixed lib/, test/ or pubspec.
Read only additional rules/references needed for the current task.

## Workflow
1. Confirm whether measurement only or optimization is authorized. Read flutter and ui-preservation rules.
2. Identify a reproducible target and capture profile-mode evidence on a representative device; don't use debug timings as release claims.
3. Inspect rebuild boundaries, list virtualization, markdown/code/image cost, expensive synchronous parsing and subscriptions.
4. Optimize only measured bottlenecks; keep cancellation, ordering, state restoration and playback behavior.
5. Compare before/after frame timing, memory or rebuild measurements under the same workload.
6. If no device/profiler exists, label source review as hypotheses rather than measured gains.

## Deliver
Measured bottleneck and improvement evidence, or clearly labeled hypotheses and profiling steps.
