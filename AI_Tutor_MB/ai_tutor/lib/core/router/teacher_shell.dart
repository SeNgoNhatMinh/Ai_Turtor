import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../features/inbox/application/teacher_inbox_controller.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/widgets.dart';
import '../../shared/widgets/plugpro/plugpro_design_system.dart';
import 'routes.dart';

class TeacherShell extends ConsumerWidget {
  const TeacherShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final location = GoRouterState.of(context).uri.path;
    final currentIndex = AppRoutes.teacherShellRoutes.indexWhere(
      (route) => location.startsWith(route),
    );
    final index = currentIndex >= 0 ? currentIndex : 0;
    final inboxBadge = ref
        .watch(teacherInboxControllerProvider)
        .maybeWhen(
          data: (data) =>
              data.chatUnread + data.escalationCount + data.reviewCount,
          orElse: () => null,
        );

    return Scaffold(
      backgroundColor: AppColors.homeBgBottom,
      body: PlugProBackground(child: child),
      bottomNavigationBar: FptBottomNav(
        currentIndex: index,
        onTap: (i) => context.go(AppRoutes.teacherShellRoutes[i]),
        items: [
          FptBottomNavItem(
            label: l10n.tabDashboard,
            icon: LucideIcons.layoutGrid,
            activeIcon: LucideIcons.layoutGrid,
          ),
          FptBottomNavItem(
            label: l10n.tabClasses,
            icon: LucideIcons.users,
            activeIcon: LucideIcons.users,
          ),
          FptBottomNavItem(
            label: l10n.tabInbox,
            icon: LucideIcons.inbox,
            activeIcon: LucideIcons.inbox,
            badgeCount: inboxBadge,
          ),
          FptBottomNavItem(
            label: l10n.tabAssignments,
            icon: LucideIcons.clipboardList,
            activeIcon: LucideIcons.clipboardList,
          ),
          FptBottomNavItem(
            label: l10n.tabProfile,
            icon: LucideIcons.user,
            activeIcon: LucideIcons.user,
          ),
        ],
      ),
    );
  }
}
