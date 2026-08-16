import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../shared/models/admin_models.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_controllers.dart';

/// Màn hình admin giám sát toàn bộ escalation (học sinh nhờ giảng viên hỗ
/// trợ) trên toàn hệ thống — backend đã có `/api/admin/mentor-escalations`
/// nhưng trước đây mobile chưa có UI hiển thị.
class AdminMentorEscalationsScreen extends ConsumerWidget {
  const AdminMentorEscalationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final escalationsAsync = ref.watch(adminMentorEscalationsProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Giám sát Escalation'),
      body: escalationsAsync.when(
        loading: () => const LoadingSkeleton(),
        error: (e, _) => ErrorState(
          message: describeError(e),
          onRetry: () => ref.invalidate(adminMentorEscalationsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              title: 'Không có escalation',
              message: 'Chưa có sinh viên nào nhờ giảng viên hỗ trợ.',
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(adminMentorEscalationsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                  Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Gap(Insets.sm),
              itemBuilder: (ctx, i) => _EscalationTile(item: items[i])
                  .animate(delay: (30 * i).clamp(0, 240).ms)
                  .fadeIn(duration: 250.ms),
            ),
          );
        },
      ),
    );
  }
}

class _EscalationTile extends ConsumerWidget {
  const _EscalationTile({required this.item});
  final AdminMentorEscalation item;

  static const _statusColors = {
    'RESOLVED': AppColors.success,
    'COMPLETED': AppColors.success,
    'CANCELLED': AppColors.textTertiary,
    'PENDING': AppColors.warning,
    'MENTOR_ASSIGNED': AppColors.info,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusColor = _statusColors[item.status.toUpperCase()] ?? AppColors.textTertiary;
    return FptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.userName ?? 'Học sinh',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  item.status,
                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          if (item.originalQuestion != null) ...[
            const Gap(Insets.xs),
            Text(
              item.originalQuestion!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const Gap(Insets.sm),
          Row(
            children: [
              if (item.assignedMentorName != null) ...[
                const Icon(LucideIcons.graduationCap, size: 14, color: AppColors.textTertiary),
                const Gap(4),
                Text(
                  item.assignedMentorName!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                ),
              ],
              const Spacer(),
              IconButton(
                tooltip: 'Xoá bản ghi',
                visualDensity: VisualDensity.compact,
                icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.error),
                onPressed: () => _confirmDelete(context, ref),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Xoá escalation'),
        content: const Text('Xoá bản ghi escalation này khỏi hệ thống?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(adminMentorEscalationsProvider.notifier).delete(item.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}
