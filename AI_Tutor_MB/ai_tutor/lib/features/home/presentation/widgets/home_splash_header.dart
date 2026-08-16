import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../notifications/application/notifications_controller.dart';
import '../../../../shared/widgets/portal/portal_compact_header.dart';

/// Header trang chủ — delegate sang [PortalCompactHeader].
class HomeSplashHeader extends ConsumerWidget {
  const HomeSplashHeader({
    super.key,
    required this.greeting,
    required this.userName,
  });

  final String greeting;
  final String userName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(notificationCountProvider);

    return PortalCompactHeader.greeting(
      eyebrow: greeting,
      title: userName,
      actions: [
        Semantics(
          button: true,
          label: count > 0 ? 'Thông báo, $count mục mới' : 'Thông báo',
          child: Material(
            color: AppColors.onOrange.withValues(alpha: 0.22),
            borderRadius: BorderRadius.circular(Radii.md),
            child: InkWell(
              onTap: () => context.push(AppRoutes.notifications),
              borderRadius: BorderRadius.circular(Radii.md),
              child: SizedBox(
                width: 46,
                height: 46,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const Icon(
                      LucideIcons.bell,
                      size: 22,
                      color: AppColors.onOrange,
                    ),
                    if (count > 0)
                      Positioned(
                        right: 11,
                        top: 11,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
