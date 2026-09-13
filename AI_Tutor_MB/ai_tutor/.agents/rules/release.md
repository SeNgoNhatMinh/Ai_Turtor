# Build and release
- Read current pubspec and platform config, not sample application IDs.
- Keep API_BASE_URL and N8N_WEBHOOK configuration external; never hardcode production secrets.
- Verify version/build number, assets, permissions, deep links and release signing explicitly.
- Current Android release configuration uses debug signing: not distribution-ready until separately configured.
- Do not generate keys, alter identities, publish stores, upload builds or change CI credentials without authorization.
- Use an approved target build; distinguish compilation from runtime/device validation.
- iOS release verification needs an authorized macOS/Xcode environment.
