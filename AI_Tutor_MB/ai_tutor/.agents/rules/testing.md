# Verification
- Establish existing analyzer/test failures before modifying app code; separate regressions from baseline.
- Format only touched Dart files; run flutter analyze and targeted flutter test.
- Add provider overrides/fakes for widget tests; no live backend credentials.
- Assert action callbacks, validation, routing and async states in addition to appearance.
- Goldens require controlled fonts, locale, surface size and platform; never overwrite baselines blindly.
- UI-only changes require check-ui plus semantic diff review. Byte checks do not cover logic in presentation.
- If Flutter hangs/fails, report the exact outcome; do not infer SDK lock without evidence or kill unrelated processes.
- Windows cannot verify local iOS signing/builds; report remaining device/platform checks.
