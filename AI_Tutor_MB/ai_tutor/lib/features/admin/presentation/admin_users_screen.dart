import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../shared/models/admin_models.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_controllers.dart';

class AdminUsersScreen extends HookConsumerWidget {
  const AdminUsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final searchCtrl = useTextEditingController();
    final roleFilter = useState('');
    final usersAsync = ref.watch(adminUsersProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Quản lý người dùng'),
      body: Column(
        children: [
          // ── Search + filter bar ────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: searchCtrl,
                    onSubmitted: (v) => ref
                        .read(adminUsersProvider.notifier)
                        .search(v, role: roleFilter.value),
                    decoration: InputDecoration(
                      hintText: 'Tìm email, tên...',
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
                _RoleFilterChip(
                  value: roleFilter.value,
                  onChange: (v) {
                    roleFilter.value = v;
                    ref.read(adminUsersProvider.notifier).search(
                          searchCtrl.text,
                          role: v,
                        );
                  },
                ),
              ],
            ),
          ),
          const Gap(Insets.md),
          // ── List ───────────────────────────────────────────────
          Expanded(
            child: usersAsync.when(
              loading: () => const LoadingSkeleton(),
              error: (e, _) => ErrorState(
                message: describeError(e),
                onRetry: () => ref.invalidate(adminUsersProvider),
              ),
              data: (users) {
                if (users.isEmpty) {
                  return const EmptyState(
                    title: 'Không có người dùng',
                    message: 'Thử thay đổi bộ lọc tìm kiếm.',
                  );
                }
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () => ref.refresh(adminUsersProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        Insets.screenH, 0, Insets.screenH, Insets.xxxl),
                    itemCount: users.length,
                    separatorBuilder: (_, __) => const Gap(Insets.sm),
                    itemBuilder: (ctx, i) => _UserTile(user: users[i])
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

// ── Role filter chip ──────────────────────────────────────────────

class _RoleFilterChip extends HookWidget {
  const _RoleFilterChip({required this.value, required this.onChange});
  final String value;
  final ValueChanged<String> onChange;

  static const _roles = ['', 'STUDENT', 'TEACHER', 'MENTOR', 'SENIOR_MENTOR', 'ADMIN'];
  static const _labels = ['Tất cả', 'Student', 'Teacher', 'Mentor', 'Senior', 'Admin'];

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      initialValue: value,
      onSelected: onChange,
      color: AppColors.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: 10),
        decoration: BoxDecoration(
          color: value.isEmpty ? AppColors.raised : AppColors.primaryWash,
          borderRadius: BorderRadius.circular(Radii.md),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              LucideIcons.filter,
              size: 16,
              color: value.isEmpty ? AppColors.textTertiary : AppColors.primary,
            ),
            const Gap(4),
            Text(
              value.isEmpty ? 'Role' : value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: value.isEmpty ? AppColors.textTertiary : AppColors.primary,
              ),
            ),
          ],
        ),
      ),
      itemBuilder: (_) => List.generate(
        _roles.length,
        (i) => PopupMenuItem(
          value: _roles[i],
          child: Text(_labels[i]),
        ),
      ),
    );
  }
}

// ── User tile ─────────────────────────────────────────────────────

class _UserTile extends HookConsumerWidget {
  const _UserTile({required this.user});
  final AdminUser user;

  static const _roleColors = {
    'ADMIN': AppColors.error,
    'SENIOR_MENTOR': AppColors.warning,
    'TEACHER': AppColors.info,
    'MENTOR': AppColors.info,
    'STUDENT': AppColors.success,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roleColor = _roleColors[user.role] ?? AppColors.textTertiary;

    return FptCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.raised,
            child: Text(
              user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : '?',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: roleColor,
              ),
            ),
          ),
          const Gap(Insets.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.fullName.isNotEmpty ? user.fullName : user.email,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  user.email,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                      ),
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
                  color: roleColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  user.role,
                  style: TextStyle(
                    color: roleColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Gap(4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: user.isActive ? AppColors.successBg : AppColors.errorBg,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  user.isActive ? 'Đang dùng' : 'Vô hiệu',
                  style: TextStyle(
                    color: user.isActive ? AppColors.success : AppColors.error,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
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
                value: user.isActive ? 'deactivate' : 'activate',
                child: Row(children: [
                  Icon(
                    user.isActive ? LucideIcons.userX : LucideIcons.userCheck,
                    size: 16,
                    color: user.isActive ? AppColors.error : AppColors.success,
                  ),
                  const Gap(8),
                  Text(user.isActive ? 'Vô hiệu hoá' : 'Kích hoạt'),
                ]),
              ),
              const PopupMenuItem(
                value: 'changeRole',
                child: Row(children: [
                  Icon(LucideIcons.shieldCheck, size: 16),
                  Gap(8),
                  Text('Đổi role'),
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
    if (action == 'activate' || action == 'deactivate') {
      try {
        await ref.read(adminUsersProvider.notifier).setActive(
              user.id,
              active: action == 'activate',
            );
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      }
      return;
    }

    if (action == 'changeRole') {
      final newRole = await _showRolePicker(context, user.role);
      if (newRole == null || newRole == user.role) return;
      try {
        await ref.read(adminUsersProvider.notifier).changeRole(user.id, newRole);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      }
      return;
    }

    if (action == 'delete') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.card,
          title: const Text('Xoá người dùng'),
          content: Text('Xoá tài khoản ${user.email}? Không thể hoàn tác.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      try {
        await ref.read(adminUsersProvider.notifier).delete(user.id);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  Future<String?> _showRolePicker(BuildContext context, String current) {
    const roles = ['STUDENT', 'TEACHER', 'MENTOR', 'SENIOR_MENTOR', 'ADMIN'];
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Chọn role mới'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: roles
              .map((r) => ListTile(
                    dense: true,
                    title: Text(r),
                    leading: Icon(
                      r == current ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                      color: r == current ? AppColors.primary : AppColors.textTertiary,
                      size: 20,
                    ),
                    onTap: () => Navigator.pop(ctx, r),
                  ))
              .toList(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Huỷ')),
        ],
      ),
    );
  }
}
