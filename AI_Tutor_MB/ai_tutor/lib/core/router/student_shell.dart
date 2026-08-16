import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/student_bottom_nav.dart';
import '../../shared/widgets/plugpro/plugpro_design_system.dart';
import 'routes.dart';

class StudentShell extends StatelessWidget {
  const StudentShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final location = GoRouterState.of(context).uri.path;
    final currentIndex = AppRoutes.studentShellRoutes.indexWhere(
      (route) => location.startsWith(route),
    );
    final index = currentIndex >= 0 ? currentIndex : 0;

    return Scaffold(
      backgroundColor: AppColors.homeBgBottom,
      body: PlugProBackground(child: child),
      bottomNavigationBar: StudentBottomNav(
        currentIndex: index,
        onTap: (i) => context.go(AppRoutes.studentShellRoutes[i]),
        items: [
          StudentBottomNavItem(
            label: l10n.tabHome,
            icon: LucideIcons.home,
          ),
          StudentBottomNavItem(
            label: l10n.tabAskCoc,
            icon: LucideIcons.sparkles,
            isCenter: true,
          ),
          StudentBottomNavItem(
            label: l10n.tabProfile,
            icon: LucideIcons.user,
          ),
        ],
      ),
    );
  }
}
