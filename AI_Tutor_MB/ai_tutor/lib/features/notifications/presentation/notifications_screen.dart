import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/notifications_controller.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final notifications = ref.watch(notificationsControllerProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.notificationsTitle),
      body: notifications.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(notificationsControllerProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptyNotificationsTitle,
              message: l10n.emptyNotificationsMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(notificationsControllerProvider),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(notificationsControllerProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) {
                final item = items[index];
                return FptCard(
                      onTap: item.route != null
                          ? () => context.go(item.route!)
                          : null,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            _iconForType(item.type),
                            size: 20,
                            color: AppColors.primary,
                          ),
                          const Gap(Insets.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.title,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                                const Gap(Insets.xs),
                                Text(
                                  item.message,
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                    .animate(delay: (40 * index).clamp(0, 320).ms)
                    .fadeIn(duration: Motion.base);
              },
            ),
          );
        },
      ),
    );
  }

  IconData _iconForType(String type) => switch (type) {
    'CHAT' => LucideIcons.messageSquare,
    'ASSIGNMENT' => LucideIcons.clipboardList,
    'ESCALATION' => LucideIcons.messageCircle,
    'REVIEW' || 'SENIOR_REVIEW' => LucideIcons.shieldAlert,
    'CANDIDATE' => LucideIcons.brain,
    _ => LucideIcons.bell,
  };
}
