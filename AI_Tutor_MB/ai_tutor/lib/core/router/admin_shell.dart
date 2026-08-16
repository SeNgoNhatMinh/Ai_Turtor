import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../shared/widgets/widgets.dart';
import '../../shared/widgets/plugpro/plugpro_design_system.dart';
import 'routes.dart';

class AdminShell extends StatelessWidget {
  const AdminShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final currentIndex = AppRoutes.adminShellRoutes.indexWhere(
      (route) => location.startsWith(route),
    );
    final index = currentIndex >= 0 ? currentIndex : 0;

    return Scaffold(
      backgroundColor: AppColors.homeBgBottom,
      body: PlugProBackground(child: child),
      bottomNavigationBar: FptBottomNav(
        currentIndex: index,
        onTap: (i) => context.go(AppRoutes.adminShellRoutes[i]),
        items: const [
          FptBottomNavItem(
            label: 'Dashboard',
            icon: LucideIcons.layoutGrid,
            activeIcon: LucideIcons.layoutGrid,
          ),
          FptBottomNavItem(
            label: 'Người dùng',
            icon: LucideIcons.users,
            activeIcon: LucideIcons.users,
          ),
          FptBottomNavItem(
            label: 'Học thuật',
            icon: LucideIcons.bookOpen,
            activeIcon: LucideIcons.bookOpen,
          ),
          FptBottomNavItem(
            label: 'Import',
            icon: LucideIcons.upload,
            activeIcon: LucideIcons.upload,
          ),
          FptBottomNavItem(
            label: 'Hồ sơ',
            icon: LucideIcons.user,
            activeIcon: LucideIcons.user,
          ),
        ],
      ),
    );
  }
}
