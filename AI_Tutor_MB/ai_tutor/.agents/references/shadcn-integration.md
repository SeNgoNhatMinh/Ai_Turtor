# Incremental shadcn_ui migration
Selected library: Flutter shadcn_ui, not the React library or shadcn_flutter.

## Before adding a dependency
Read pubspec.yaml, pubspec.lock, flutter --version and package SDK constraints.
Verify compatible APIs/version in package documentation at implementation time:
- https://pub.dev/packages/shadcn_ui
- https://mariuti.com/flutter-shadcn-ui/
- https://github.com/nank1ro/flutter-shadcn-ui
Do not blindly pin the latest version or copy examples from a different package.
If compatibility requires upgrading Flutter, stop and explain the impact before doing it.

## Integration shape to verify
The library documents Material coexistence through ShadApp.custom/appBuilder and ShadAppBuilder.
Use the API of the selected compatible release, not an untested universal code snippet.
Retain the existing MaterialApp.router, the same GoRouter instance, localization delegates, ProviderScope, RealtimeBootstrap and theme-mode controller.
App-level integration needs explicit allowed paths (usually lib/app.dart, pubspec.yaml, pubspec.lock); check whether more files are actually needed first.
Map one shared set of semantic tokens into Material and Shad themes. Keep context.fpt valid during migration.

## Sequence
Theme bridge -> existing shared wrappers -> one screen -> regression checks -> next screen.
Keep wrapper callbacks, validators, focus nodes/controllers and disabled/loading contracts stable.
Do not introduce a competing ui/ directory unless reuse has been inspected and the distinction is justified.
Keep native mobile navigation, SafeArea and keyboard handling; do not imitate a desktop web dashboard.
Exercise menus/popovers/dialogs/toasts, nested navigators, back, scroll, light/dark, text scale and Vietnamese labels.
No mass rename, router rewrite, state-management migration or backend changes belong in this migration.
