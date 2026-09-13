# Observed project map
Inspected 2026-09-07; re-check touched source because this is a working tree, not a frozen contract.

## Entry and architecture
- lib/main.dart: app startup and ProviderScope.
- lib/app.dart: RealtimeBootstrap -> MaterialApp.router; appRouterProvider, themeModeControllerProvider, Vietnamese locale and delegates.
- lib/core/router/app_router.dart and router_helpers.dart: GoRouter and role helpers; student/teacher/admin shells.
- lib/core/network/: separate Spring/n8n Dio, JWT headers, realtime services and n8n payload context.
- lib/features/: admin, ai_tutor, assignments, auth, classes, courses, dashboard, escalation, home, inbox, learning, live_lessons, materials, memory, notifications, profile, quiz, senior, shell, teacher_assignments.
- Features reuse data/application/presentation layers where present. Do not create empty layers for symmetry.
- lib/shared/models and lib/shared/widgets: shared contracts and reusable components.
- lib/l10n/: Vietnamese source ARB plus generated localization code. Inspect l10n.yaml before generation.
- test/core/network/dio_client_test.dart and test/features/live_lessons/live_lesson_utils_test.dart are existing test anchors.

## Current stack
Dart constraint ^3.9.2 (NOT Flutter version); installed SDK observed Flutter 3.35.7/Dart 3.9.2.
Riverpod 2.6.1, GoRouter 14.8.1, Dio 5.8.0+1 constraints. Read lockfile for resolved versions.
Material, Google Fonts, Lucide, markdown/highlight, fl_chart, websocket and YouTube iframe already exist.
shadcn_ui is not a dependency at kit creation. Do not add shadcn_flutter by mistake.
Codegen dependencies exist but this does not justify a new generated architecture.

## Theme and wrappers
Read lib/core/theme/app_theme.dart, app_tokens.dart, theme_extensions.dart, app_spacing.dart, app_radius.dart, app_typography.dart and app_motion.dart.
Insets: 4/8/12/16/24/32/48; screen horizontal 16. Preserve semantic intent when proposing changes.
FptThemeColors/context.fpt already has light/dark semantics. Navy/orange exists, but a final redesign direction still needs agreement.
FptButton, FptCard, FptTextField, existing portal and plugpro components are migration points, not disposable duplicates.

## Working-tree precautions
The Git root is above this Flutter folder. Run kit commands here, not at the backend root.
There are pre-existing app changes and deleted old mobile/API documents; do not restore them.
If Git reports ownership errors, request a scoped safe.directory workaround; never change global Git trust silently.
