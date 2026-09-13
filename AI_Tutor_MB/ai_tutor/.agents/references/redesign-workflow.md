# UI-only workflow
1. Inspect requested screen, its consumers/providers, repositories and navigation. Read-only if user wants a preview.
2. Fill templates/redesign-brief.md: current behavior matrix, design intent, allowed paths, untouched contracts, test plan.
3. If no agreed direction, show a concise proposal for one representative screen. Do not perform a global redesign by assumption.
4. For authorized implementation, run snapshot-ui before any edits. It hashes current protected files, including user edits.
5. Implement a small screen/component slice. Keep event wiring, providers and identifiers unchanged.
6. Use shadcn integration skill only if the slice needs the package or app bridge and that expansion is authorized.
7. Run check-ui, touched-file formatting check, analyzer, targeted tests. Inspect diff manually for behavior embedded in presentation.
8. Compare screenshots/device behavior in both themes, keyboard and large text. If no device is available, disclose this.
9. Fill templates/verification.md. Finish the baseline only after checks pass. Never rebaseline a regression to make the check green.

Protected-file guard is opt-in per task and local to this checkout, not per conversation.
If localization regeneration is authorized, list each generated output as an exact --allow exception before flutter gen-l10n. The direct-edit hook still denies hand edits to generated Dart. Review the regenerated output diff.
Do not run concurrent redesign tasks sharing one baseline. A new checkout needs its own baseline.
