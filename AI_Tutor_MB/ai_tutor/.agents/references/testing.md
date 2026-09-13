# Verification commands and evidence
Run from the Flutter folder. Do not launch expensive checks automatically on every hook event.

Kit:
```powershell
node .agents/scripts/agent-kit.mjs doctor
node .agents/scripts/agent-kit.mjs validate
node --test .agents/tests/kit.test.mjs
```

App after authorized app changes:
```powershell
dart format --output=none --set-exit-if-changed <touched-dart-files>
flutter analyze
flutter test test/core/network/dio_client_test.dart
flutter test test/features/live_lessons/live_lesson_utils_test.dart
flutter test <new-or-affected-test-file>
node .agents/scripts/agent-kit.mjs check-ui
```
Angle-bracket arguments are placeholders, not literal commands.
Record pre-existing failures before editing; do not promise all tests pass based on kit tests.
Use provider overrides/fakes, fixed locales/sizes/fonts and mock time where needed. No real JWT/backend in widget tests.
Add tests for changed button wiring, form errors, pending actions, navigation and preserved state.
Goldens are a visual aid, not proof of functional equivalence. Review deliberate golden updates.
If SDK commands stall, inspect the process/output safely and report the actual blocker. Do not silently reset SDK caches.
