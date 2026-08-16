import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
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
import '../../auth/application/auth_controller.dart';
import '../application/admin_controllers.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(adminStatsProvider);
    final session = ref.watch(authControllerProvider).valueOrNull;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.refresh(adminStatsProvider.future),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            SliverToBoxAdapter(
              child: PlugProAppBar(
                title: 'Admin Dashboard',
                actions: [
                  PlugProIconButton(
                    icon: LucideIcons.refreshCw,
                    onTap: () => ref.invalidate(adminStatsProvider),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: PlugProHeroCard(
                tag: 'Quản trị',
                title: 'Điều phối hệ thống AI Tutor',
                subtitle:
                    'Người dùng, học thuật, mentor và escalation — quản lý tập trung.',
                ctaLabel: 'Quản lý người dùng',
                showMascot: false,
                onCta: () => context.go(AppRoutes.adminUsers),
              ).animate().fadeIn(duration: 300.ms),
            ),
            const SliverToBoxAdapter(child: Gap(Insets.lg)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                0,
                Insets.screenH,
                Insets.xxxl,
              ),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
            PlugProCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.primaryWash,
                    backgroundImage: session?.avatarUrl != null
                        ? NetworkImage(session!.avatarUrl!)
                        : null,
                    child: session?.avatarUrl == null
                        ? Text(
                            (session?.fullName ?? 'A').substring(0, 1).toUpperCase(),
                            style: const TextStyle(
                              color: AppColors.navActive,
                              fontWeight: FontWeight.w700,
                              fontSize: 18,
                            ),
                          )
                        : null,
                  ),
                  const Gap(Insets.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Xin chào, ${session?.fullName ?? 'Admin'}',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                        ),
                        const Gap(2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primaryWash,
                            borderRadius: BorderRadius.circular(Radii.full),
                            border: Border.all(color: AppColors.homeOrangeWash),
                          ),
                          child: const Text(
                            'ADMIN',
                            style: TextStyle(
                              color: AppColors.navActive,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Gap(Insets.xl),
            PlugProSectionHeader(title: 'Tổng quan hệ thống'),
            const Gap(Insets.md),
            statsAsync.when(
              loading: () => const LoadingSkeleton(itemCount: 6),
              error: (e, _) => ErrorState(
                message: describeError(e),
                onRetry: () => ref.invalidate(adminStatsProvider),
                secondaryActionLabel: 'Đăng xuất & đăng nhập lại',
                onSecondaryAction: () async {
                  await ref.read(authControllerProvider.notifier).logout();
                  if (context.mounted) context.go(AppRoutes.login);
                },
              ),
              data: (stats) => _StatsGrid(stats: stats),
            ),
            const Gap(Insets.xl),
            PlugProSectionHeader(title: 'Quản lý nhanh'),
            const Gap(Insets.md),
            _QuickActionsGrid(context: context),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Stats grid ────────────────────────────────────────────────────

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});
  final AdminStats stats;

  @override
  Widget build(BuildContext context) {
    final items = [
      _StatItem(
        label: 'Người dùng',
        value: stats.users,
        icon: LucideIcons.users,
        color: AppColors.splashNavy,
        bg: AppColors.primaryWash,
      ),
      _StatItem(
        label: 'Giảng viên',
        value: stats.mentors,
        icon: LucideIcons.graduationCap,
        color: AppColors.info,
        bg: AppColors.infoBg,
      ),
      _StatItem(
        label: 'Escalations',
        value: stats.escalations,
        icon: LucideIcons.alertCircle,
        color: AppColors.warning,
        bg: AppColors.warningBg,
      ),
      _StatItem(
        label: 'Gói cước',
        value: stats.subscriptionPlans,
        icon: LucideIcons.packageOpen,
        color: AppColors.success,
        bg: AppColors.successBg,
      ),
      _StatItem(
        label: 'Đăng ký',
        value: stats.subscriptions,
        icon: LucideIcons.creditCard,
        color: AppColors.primary,
        bg: AppColors.primaryWash,
      ),
      _StatItem(
        label: 'Đang hoạt động',
        value: stats.activeSubscriptions,
        icon: LucideIcons.checkCircle2,
        color: AppColors.success,
        bg: AppColors.successBg,
      ),
    ];

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: Insets.md,
      crossAxisSpacing: Insets.md,
      childAspectRatio: 1.4,
      children: items.asMap().entries.map((e) {
        return _StatCard(item: e.value)
            .animate(delay: (60 * e.key).ms)
            .fadeIn(duration: 300.ms)
            .slideY(begin: 0.1, end: 0);
      }).toList(),
    );
  }
}

class _StatItem {
  const _StatItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.bg,
  });
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  final Color bg;
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.item});
  final _StatItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Insets.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: item.bg,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Icon(item.icon, size: 18, color: item.color),
          ),
          const Gap(Insets.sm),
          Text(
            item.value.toString(),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.splashNavy,
                  height: 1,
                ),
          ),
          const Gap(2),
          Text(
            item.label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
          ),
        ],
      ),
    );
  }
}

// ── Quick actions ─────────────────────────────────────────────────

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid({required this.context});
  final BuildContext context;

  @override
  Widget build(BuildContext context) {
    final actions = [
      _ActionItem(
        label: 'Quản lý người dùng',
        icon: LucideIcons.userCog,
        color: AppColors.splashNavy,
        bg: AppColors.primaryWash,
        onTap: () => context.go(AppRoutes.adminUsers),
      ),
      _ActionItem(
        label: 'Khoá học & Lớp',
        icon: LucideIcons.bookOpen,
        color: AppColors.info,
        bg: AppColors.infoBg,
        onTap: () => context.go(AppRoutes.adminAcademic),
      ),
      _ActionItem(
        label: 'Import dữ liệu',
        icon: LucideIcons.upload,
        color: AppColors.success,
        bg: AppColors.successBg,
        onTap: () => context.go(AppRoutes.adminImport),
      ),
      _ActionItem(
        label: 'Gói & Đăng ký',
        icon: LucideIcons.creditCard,
        color: AppColors.primary,
        bg: AppColors.primaryWash,
        onTap: () => context.go(AppRoutes.adminSubscriptions),
      ),
      _ActionItem(
        label: 'Duyệt Knowledge',
        icon: LucideIcons.brain,
        color: AppColors.warning,
        bg: AppColors.warningBg,
        onTap: () => context.go(AppRoutes.adminKnowledgeCandidates),
      ),
      _ActionItem(
        label: 'Expert Co-Training V2',
        icon: LucideIcons.workflow,
        color: AppColors.primary,
        bg: AppColors.primaryWash,
        onTap: () => context.go(AppRoutes.adminV2ExpertHub),
      ),
      _ActionItem(
        label: 'Xem xét AI',
        icon: LucideIcons.shieldCheck,
        color: AppColors.warm500,
        bg: AppColors.warm100,
        onTap: () => context.go(AppRoutes.adminSeniorReviewQueue),
      ),
      _ActionItem(
        label: 'Quản lý mentor',
        icon: LucideIcons.graduationCap,
        color: AppColors.info,
        bg: AppColors.infoBg,
        onTap: () => context.go(AppRoutes.adminMentors),
      ),
    ];

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: Insets.md,
      crossAxisSpacing: Insets.md,
      childAspectRatio: 1.6,
      children: actions.asMap().entries.map((e) {
        final a = e.value;
        return Material(
          color: a.bg,
          borderRadius: BorderRadius.circular(Radii.lg),
          child: InkWell(
            onTap: a.onTap,
            borderRadius: BorderRadius.circular(Radii.lg),
            child: Padding(
              padding: const EdgeInsets.all(Insets.md),
              child: Row(
                children: [
                  Icon(a.icon, size: 20, color: a.color),
                  const Gap(Insets.sm),
                  Expanded(
                    child: Text(
                      a.label,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: a.color,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        )
            .animate(delay: (60 * e.key).ms)
            .fadeIn(duration: 300.ms);
      }).toList(),
    );
  }
}

class _ActionItem {
  const _ActionItem({
    required this.label,
    required this.icon,
    required this.color,
    required this.bg,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;
  final VoidCallback onTap;
}
