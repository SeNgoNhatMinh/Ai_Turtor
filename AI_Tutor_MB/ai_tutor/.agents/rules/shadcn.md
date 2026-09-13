# shadcn_ui integration
- User selected the Flutter package shadcn_ui. shadcn_flutter and React shadcn/ui are different projects.
- Read .agents/references/shadcn-integration.md before dependencies or app-level edits.
- Verify package API and SDK constraints from official package docs and actual pubspec.lock at implementation time.
- No package is currently installed by this agent kit. Do not assume ShadButton imports compile today.
- Preserve Material widgets/localizations/GoRouter/Riverpod/realtime during incremental coexistence.
- Build one theme bridge and reuse wrappers; do not globally replace MaterialApp.router or create a second router.
- Test overlays, dialogs, bottom sheets, focus and back navigation on actual target platforms.
