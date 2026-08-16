import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/router/routes.dart';
import '../../core/theme/app_colors.dart';
import '../../features/notifications/application/notifications_controller.dart';
import 'plugpro/plugpro_design_system.dart';

class NotificationBellAction extends ConsumerWidget {
  const NotificationBellAction({super.key, this.onOrange = false});

  /// Giữ tương thích — mọi variant dùng style PlugPro viền cam.
  final bool onOrange;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(notificationCountProvider);

    return PlugProIconButton(
      icon: LucideIcons.bell,
      badge: count > 0,
      onTap: () => context.push(AppRoutes.notifications),
    );
  }
}
