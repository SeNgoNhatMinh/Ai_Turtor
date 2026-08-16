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

class AdminSubscriptionsScreen extends HookConsumerWidget {
  const AdminSubscriptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = useState(0);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Gói & Đăng ký'),
      body: Column(
        children: [
          Container(
            color: AppColors.card,
            padding: const EdgeInsets.fromLTRB(Insets.screenH, 0, Insets.screenH, Insets.sm),
            child: Row(
              children: [
                _Tab(label: 'Gói cước', selected: tabIndex.value == 0, onTap: () => tabIndex.value = 0),
                const Gap(Insets.sm),
                _Tab(label: 'Đăng ký', selected: tabIndex.value == 1, onTap: () => tabIndex.value = 1),
              ],
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: tabIndex.value,
              children: const [
                _PlansTab(),
                _SubscriptionsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: Insets.xs),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : AppColors.raised,
            borderRadius: BorderRadius.circular(Radii.full),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : AppColors.textTertiary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Plans tab ─────────────────────────────────────────────────────

class _PlansTab extends ConsumerWidget {
  const _PlansTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plansAsync = ref.watch(adminPlansProvider);

    return plansAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
        message: describeError(e),
        onRetry: () => ref.invalidate(adminPlansProvider),
      ),
      data: (plans) {
        if (plans.isEmpty) {
          return const EmptyState(
            title: 'Chưa có gói cước',
            message: 'Gói cước được tạo từ backend admin.',
          );
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () => ref.refresh(adminPlansProvider.future),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
            itemCount: plans.length,
            separatorBuilder: (_, __) => const Gap(Insets.sm),
            itemBuilder: (ctx, i) => GestureDetector(
              onTap: () => _showEditPlanSheet(context, plans[i]),
              child: _PlanCard(plan: plans[i])
                  .animate(delay: (40 * i).ms)
                  .fadeIn(duration: 250.ms),
            ),
          ),
        );
      },
    );
  }
}

void _showEditPlanSheet(BuildContext context, SubscriptionPlan plan) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
    builder: (_) => _EditPlanSheet(plan: plan),
  );
}

class _EditPlanSheet extends HookConsumerWidget {
  const _EditPlanSheet({required this.plan});
  final SubscriptionPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nameCtrl = useTextEditingController(text: plan.name);
    final descCtrl = useTextEditingController(text: plan.description ?? '');
    final priceCtrl = useTextEditingController(text: plan.price.toStringAsFixed(0));
    final durationCtrl = useTextEditingController(text: plan.durationDays.toString());
    final active = useState(plan.isActive);
    final saving = useState(false);
    final error = useState<String?>(null);

    Future<void> save() async {
      saving.value = true;
      error.value = null;
      try {
        await ref.read(adminPlansProvider.notifier).updatePlan(
              plan.id,
              name: nameCtrl.text.trim().isEmpty ? null : nameCtrl.text.trim(),
              description: descCtrl.text.trim(),
              price: double.tryParse(priceCtrl.text.trim()),
              durationDays: int.tryParse(durationCtrl.text.trim()),
              isActive: active.value,
            );
        if (context.mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã cập nhật gói cước'), backgroundColor: AppColors.success),
          );
        }
      } catch (e) {
        error.value = describeError(e);
      } finally {
        saving.value = false;
      }
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
          Insets.screenH, Insets.lg, Insets.screenH, MediaQuery.viewInsetsOf(context).bottom + Insets.xl),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Sửa gói cước (${plan.planCode})', style: Theme.of(context).textTheme.titleLarge),
            const Gap(Insets.lg),
            FptTextField(controller: nameCtrl, label: 'Tên gói'),
            const Gap(Insets.md),
            FptTextField(controller: descCtrl, label: 'Mô tả', maxLines: 2),
            const Gap(Insets.md),
            Row(
              children: [
                Expanded(
                  child: FptTextField(
                    controller: priceCtrl,
                    label: 'Giá (đ)',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const Gap(Insets.md),
                Expanded(
                  child: FptTextField(
                    controller: durationCtrl,
                    label: 'Số ngày',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Đang hiển thị cho người dùng'),
              value: active.value,
              activeThumbColor: AppColors.primary,
              onChanged: (v) => active.value = v,
            ),
            if (error.value != null) ...[
              const Gap(Insets.sm),
              Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const Gap(Insets.lg),
            FptButton(
              label: 'Lưu thay đổi',
              loading: saving.value,
              expand: true,
              onPressed: saving.value ? null : save,
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan});
  final SubscriptionPlan plan;

  @override
  Widget build(BuildContext context) {
    return FptCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: plan.isActive ? AppColors.primaryWash : AppColors.raised,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Icon(
              LucideIcons.packageOpen,
              size: 22,
              color: plan.isActive ? AppColors.primary : AppColors.textTertiary,
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  '${plan.planCode} · ${plan.durationDays} ngày',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                plan.price == 0 ? 'Miễn phí' : '${plan.price.toStringAsFixed(0)}đ',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: plan.price == 0 ? AppColors.success : AppColors.primary,
                    ),
              ),
              Container(
                margin: const EdgeInsets.only(top: 2),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: plan.isActive ? AppColors.successBg : AppColors.raised,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  plan.isActive ? 'Đang dùng' : 'Ẩn',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: plan.isActive ? AppColors.success : AppColors.textTertiary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Subscriptions tab ─────────────────────────────────────────────

class _SubscriptionsTab extends HookConsumerWidget {
  const _SubscriptionsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subsAsync = ref.watch(adminSubscriptionsProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAssignSheet(context, ref),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Gán gói', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: subsAsync.when(
        loading: () => const LoadingSkeleton(),
        error: (e, _) => ErrorState(
          message: describeError(e),
          onRetry: () => ref.invalidate(adminSubscriptionsProvider),
        ),
        data: (subs) {
          if (subs.isEmpty) {
            return EmptyState(
              title: 'Chưa có đăng ký',
              ctaLabel: 'Gán gói',
              onCta: () => _showAssignSheet(context, ref),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(adminSubscriptionsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 100),
              itemCount: subs.length,
              separatorBuilder: (_, __) => const Gap(Insets.sm),
              itemBuilder: (ctx, i) => _SubCard(sub: subs[i])
                  .animate(delay: (30 * i).clamp(0, 240).ms)
                  .fadeIn(duration: 250.ms),
            ),
          );
        },
      ),
    );
  }

  void _showAssignSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
      builder: (_) => _AssignPlanSheet(ref: ref),
    );
  }
}

class _SubCard extends HookConsumerWidget {
  const _SubCard({required this.sub});
  final UserSubscription sub;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FptCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: sub.isActive ? AppColors.successBg : AppColors.raised,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Icon(
              LucideIcons.creditCard,
              size: 20,
              color: sub.isActive ? AppColors.success : AppColors.textTertiary,
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sub.planCode,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  sub.userId,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (sub.endAt != null)
                  Text(
                    'Hết hạn: ${sub.endAt!.day}/${sub.endAt!.month}/${sub.endAt!.year}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: sub.endAt!.isBefore(DateTime.now())
                              ? AppColors.error
                              : AppColors.textTertiary,
                        ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: sub.isActive ? AppColors.successBg : AppColors.errorBg,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  sub.isActive ? 'Đang dùng' : sub.status,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: sub.isActive ? AppColors.success : AppColors.error,
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
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'ACTIVE', child: Text('Đặt: Hoạt động')),
              PopupMenuItem(value: 'SUSPENDED', child: Text('Đặt: Tạm ngưng')),
              PopupMenuItem(value: 'CANCELLED', child: Text('Đặt: Đã huỷ')),
              PopupMenuItem(value: 'EXPIRED', child: Text('Đặt: Hết hạn')),
              PopupMenuDivider(),
              PopupMenuItem(
                value: 'delete',
                child: Text('Xoá', style: TextStyle(color: AppColors.error)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, WidgetRef ref, String action) async {
    if (action == 'delete') {
      await _confirmDelete(context, ref);
      return;
    }
    try {
      await ref.read(adminSubscriptionsProvider.notifier).updateStatus(sub.id, action);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Huỷ đăng ký'),
        content: const Text('Xoá đăng ký này?'),
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
      await ref.read(adminSubscriptionsProvider.notifier).delete(sub.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}

class _AssignPlanSheet extends HookConsumerWidget {
  const _AssignPlanSheet({required this.ref});
  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef widgetRef) {
    final userIdCtrl = useTextEditingController();
    final plansAsync = widgetRef.watch(adminPlansProvider);
    final selectedPlan = useState<String?>(null);
    final saving = useState(false);
    final error = useState<String?>(null);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: Insets.lg),
                decoration: BoxDecoration(
                  color: AppColors.borderStrong,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
              ),
            ),
            Text('Gán gói cước', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const Gap(Insets.lg),
            FptTextField(controller: userIdCtrl, label: 'User ID người dùng'),
            const Gap(Insets.md),
            if (plansAsync.valueOrNull?.isNotEmpty == true) ...[
              Text('Gói cước', style: Theme.of(context).textTheme.labelMedium),
              const Gap(Insets.xs),
              DropdownButtonFormField<String>(
                initialValue: selectedPlan.value,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: Insets.sm),
                ),
                hint: const Text('Chọn gói'),
                items: plansAsync.valueOrNull!.map((p) => DropdownMenuItem(
                  value: p.planCode,
                  child: Text('${p.name} (${p.planCode})'),
                )).toList(),
                onChanged: (v) => selectedPlan.value = v,
              ),
            ],
            if (error.value != null) ...[
              const Gap(Insets.sm),
              Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const Gap(Insets.xl),
            FptButton(
              label: saving.value ? 'Đang lưu...' : 'Gán gói',
              loading: saving.value,
              expand: true,
              onPressed: saving.value
                  ? null
                  : () async {
                      final uid = userIdCtrl.text.trim();
                      if (uid.isEmpty || selectedPlan.value == null) {
                        error.value = 'Vui lòng nhập userId và chọn gói';
                        return;
                      }
                      saving.value = true;
                      error.value = null;
                      try {
                        await ref.read(adminSubscriptionsProvider.notifier).assign(
                              userId: uid,
                              planCode: selectedPlan.value!,
                            );
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Đã gán gói thành công'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      } catch (e) {
                        error.value = describeError(e);
                      } finally {
                        saving.value = false;
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }
}
