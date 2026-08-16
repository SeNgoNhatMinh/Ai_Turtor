import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../shared/models/admin_models.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_controllers.dart';

class AdminMentorsScreen extends HookConsumerWidget {
  const AdminMentorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final searchCtrl = useTextEditingController();
    final activeFilter = useState<bool?>(null);
    final mentorsAsync = ref.watch(adminMentorsProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: 'Quản lý mentor',
        actions: [
          IconButton(
            tooltip: 'Giám sát escalation',
            icon: const Icon(LucideIcons.inbox, color: AppColors.splashNavy),
            onPressed: () => context.push(AppRoutes.adminMentorEscalations),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: searchCtrl,
                    onSubmitted: (v) => ref
                        .read(adminMentorsProvider.notifier)
                        .search(v, active: activeFilter.value),
                    decoration: InputDecoration(
                      hintText: 'Tìm tên, email mentor...',
                      prefixIcon: const Icon(LucideIcons.search, size: 18),
                      filled: true,
                      fillColor: AppColors.raised,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(Radii.md),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: Insets.md, vertical: Insets.sm),
                    ),
                  ),
                ),
                const Gap(Insets.sm),
                _ActiveFilterChip(
                  value: activeFilter.value,
                  onChange: (v) {
                    activeFilter.value = v;
                    ref.read(adminMentorsProvider.notifier).search(searchCtrl.text, active: v);
                  },
                ),
              ],
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: mentorsAsync.when(
              loading: () => const LoadingSkeleton(),
              error: (e, _) => ErrorState(
                message: describeError(e),
                onRetry: () => ref.invalidate(adminMentorsProvider),
              ),
              data: (mentors) {
                if (mentors.isEmpty) {
                  return const EmptyState(
                    title: 'Không có mentor',
                    message: 'Thử thay đổi bộ lọc tìm kiếm hoặc import mentor mới.',
                  );
                }
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => ref.refresh(adminMentorsProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        Insets.screenH, 0, Insets.screenH, Insets.xxxl),
                    itemCount: mentors.length,
                    separatorBuilder: (_, __) => const Gap(Insets.sm),
                    itemBuilder: (ctx, i) => _MentorTile(mentor: mentors[i])
                        .animate(delay: (30 * i).clamp(0, 240).ms)
                        .fadeIn(duration: 250.ms),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({required this.value, required this.onChange});
  final bool? value;
  final ValueChanged<bool?> onChange;

  @override
  Widget build(BuildContext context) {
    final label = switch (value) {
      true => 'Hoạt động',
      false => 'Vô hiệu',
      null => 'Tất cả',
    };
    return PopupMenuButton<bool?>(
      initialValue: value,
      onSelected: onChange,
      color: AppColors.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: 10),
        decoration: BoxDecoration(
          color: value == null ? AppColors.raised : AppColors.primaryWash,
          borderRadius: BorderRadius.circular(Radii.md),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              LucideIcons.filter,
              size: 16,
              color: value == null ? AppColors.textTertiary : AppColors.primary,
            ),
            const Gap(4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: value == null ? AppColors.textTertiary : AppColors.primary,
              ),
            ),
          ],
        ),
      ),
      itemBuilder: (_) => const [
        PopupMenuItem(value: null, child: Text('Tất cả')),
        PopupMenuItem(value: true, child: Text('Hoạt động')),
        PopupMenuItem(value: false, child: Text('Vô hiệu')),
      ],
    );
  }
}

class _MentorTile extends HookConsumerWidget {
  const _MentorTile({required this.mentor});
  final AdminMentor mentor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FptCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.raised,
            child: Text(
              mentor.name.isNotEmpty ? mentor.name[0].toUpperCase() : '?',
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.info),
            ),
          ),
          const Gap(Insets.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mentor.name,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (mentor.email != null)
                  Text(
                    mentor.email!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                if (mentor.department != null || mentor.city != null)
                  Text(
                    [mentor.department, mentor.city].where((e) => e != null && e.isNotEmpty).join(' · '),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          const Gap(Insets.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: mentor.isActive ? AppColors.successBg : AppColors.errorBg,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  mentor.isActive ? 'Đang dùng' : 'Vô hiệu',
                  style: TextStyle(
                    color: mentor.isActive ? AppColors.success : AppColors.error,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (mentor.verified) ...[
                const Gap(4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(LucideIcons.badgeCheck, size: 12, color: AppColors.info),
                    Gap(2),
                    Text('Đã xác minh', style: TextStyle(fontSize: 10, color: AppColors.info)),
                  ],
                ),
              ],
            ],
          ),
          const Gap(Insets.xs),
          PopupMenuButton<String>(
            icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textTertiary),
            color: AppColors.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
            onSelected: (action) => _handleAction(context, ref, action),
            itemBuilder: (_) => [
              PopupMenuItem(
                value: mentor.isActive ? 'deactivate' : 'activate',
                child: Row(children: [
                  Icon(
                    mentor.isActive ? LucideIcons.userX : LucideIcons.userCheck,
                    size: 16,
                    color: mentor.isActive ? AppColors.error : AppColors.success,
                  ),
                  const Gap(8),
                  Text(mentor.isActive ? 'Vô hiệu hoá' : 'Kích hoạt'),
                ]),
              ),
              PopupMenuItem(
                value: mentor.verified ? 'unverify' : 'verify',
                child: Row(children: [
                  const Icon(LucideIcons.badgeCheck, size: 16),
                  const Gap(8),
                  Text(mentor.verified ? 'Bỏ xác minh' : 'Xác minh'),
                ]),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'delete',
                child: Row(children: [
                  Icon(LucideIcons.trash2, size: 16, color: AppColors.error),
                  Gap(8),
                  Text('Xoá', style: TextStyle(color: AppColors.error)),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, WidgetRef ref, String action) async {
    try {
      switch (action) {
        case 'activate':
          await ref.read(adminMentorsProvider.notifier).setActive(mentor.id, active: true);
        case 'deactivate':
          await ref.read(adminMentorsProvider.notifier).setActive(mentor.id, active: false);
        case 'verify':
          await ref.read(adminMentorsProvider.notifier).setVerified(mentor.id, verified: true);
        case 'unverify':
          await ref.read(adminMentorsProvider.notifier).setVerified(mentor.id, verified: false);
        case 'delete':
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              backgroundColor: AppColors.card,
              title: const Text('Xoá mentor'),
              content: Text('Xoá mentor "${mentor.name}"? Không thể hoàn tác.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
                TextButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
                ),
              ],
            ),
          );
          if (confirmed == true) {
            await ref.read(adminMentorsProvider.notifier).delete(mentor.id);
          }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}
