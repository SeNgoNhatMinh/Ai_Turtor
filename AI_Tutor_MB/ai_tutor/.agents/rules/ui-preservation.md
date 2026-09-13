# UI-only preservation
- Record screen inputs, provider reads, actions, validations, states and navigation before editing.
- Allowed by default: features/**/presentation, shared/widgets, core/theme, core/icons, assets, localization source ARB and tests.
- Protected by default: all other lib code, pubspec/lock, platform configuration and runtime configuration.
- Application shell integration, router-shell visuals or dependency changes require explicit scoped approval and a named baseline exception.
- Localization regeneration requires exact approved generated-output exceptions before flutter gen-l10n; never edit generated Dart by hand.
- Do not change repository/controller/model behavior, payloads, auth, role gating, retries, cancellation, identifiers or callback semantics.
- UI code can contain logic: an allowed file is NOT blanket permission to change that logic.
- Start snapshot-ui before edits; run check-ui after edits and before completion. Do not overwrite a failed baseline.
- If the task is analysis-only, do not start a snapshot or edit files.
