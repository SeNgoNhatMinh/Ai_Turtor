import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/teacher_dashboard.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../application/teacher_dashboard_controller.dart';

class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final session = ref.watch(authControllerProvider).valueOrNull;
    final dashboard = ref.watch(teacherDashboardControllerProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: dashboard.when(
        loading: () => const LoadingSkeleton(itemCount: 4),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(teacherDashboardControllerProvider),
        ),
        data: (data) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () =>
              ref.refresh(teacherDashboardControllerProvider.future),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: PlugProAppBar(
                  title: l10n.tabDashboard,
                  actions: const [NotificationBellAction()],
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
                  child: Text(
                    l10n.teacherGreeting(session?.fullName ?? ''),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: Gap(Insets.sm)),
              SliverToBoxAdapter(
                child: PlugProHeroCard(
                  tag: 'Hôm nay',
                  title: 'Xử lý inbox & chấm bài',
                  subtitle:
                      'Escalation, live chat và bài chờ chấm — tất cả trong Hộp thư.',
                  ctaLabel: 'Mở hộp thư',
                  showMascot: false,
                  onCta: () => context.go(AppRoutes.teacherInbox),
                ).animate().fadeIn(duration: Motion.base),
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
                    PlugProSectionHeader(title: 'Thống kê nhanh'),
                    const Gap(Insets.sm),
                    _StatGrid(data: data, l10n: l10n),
                    const Gap(Insets.xl),
                    _TeacherQuizShortcut(l10n: l10n),
                    const Gap(Insets.xxl),
                    PlugProSectionHeader(title: l10n.weakTopicsAllClasses),
                    const Gap(Insets.md),
                    _WeakTopicsChart(topics: data.weakTopics),
                    const Gap(Insets.xxl),
                    PlugProSectionHeader(title: l10n.todayTasks),
                    const Gap(Insets.md),
                    if (data.todayTasks.isEmpty)
                      EmptyState(
                        title: l10n.emptyTodayTasksTitle,
                        message: l10n.emptyTodayTasksMessage,
                        ctaLabel: l10n.refresh,
                        onCta: () => ref.invalidate(
                          teacherDashboardControllerProvider,
                        ),
                      )
                    else
                      ...data.todayTasks.asMap().entries.map((entry) {
                        final index = entry.key;
                        final task = entry.value;
                        return Padding(
                              padding: const EdgeInsets.only(bottom: Insets.md),
                              child: FptCard(
                                onTap: () => _openTask(context, task),
                                child: Row(
                                  children: [
                                    Icon(
                                      LucideIcons.circleDot,
                                      size: 18,
                                      color: AppColors.navActive,
                                    ),
                                    const Gap(Insets.md),
                                    Expanded(
                                      child: Text(
                                        task.title,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.bodyLarge,
                                      ),
                                    ),
                                    const Icon(
                                      LucideIcons.chevronRight,
                                      size: 18,
                                      color: AppColors.textTertiary,
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .animate(
                              delay: (40 * index).clamp(0, 320).ms,
                            )
                            .fadeIn(duration: Motion.base);
                      }),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openTask(BuildContext context, TodayTask task) {
    final type = task.type?.toUpperCase();
    if (type == 'ESCALATION' && task.referenceId != null) {
      context.push(AppRoutes.teacherEscalationAnswer(task.referenceId!));
      return;
    }
    if (type == 'GRADING' && task.referenceId != null) {
      context.push(AppRoutes.teacherSubmissions(task.referenceId!));
      return;
    }
    context.go(AppRoutes.teacherInbox);
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.data, required this.l10n});

  final TeacherDashboard data;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - Insets.md) / 2;
        return Wrap(
          spacing: Insets.md,
          runSpacing: Insets.md,
          children: [
            SizedBox(
              width: width,
              child: StatCard(
                label: l10n.statClasses,
                value: data.classCount,
                icon: LucideIcons.users,
              ),
            ),
            SizedBox(
              width: width,
              child: StatCard(
                label: l10n.statEscalations,
                value: data.pendingEscalations,
                icon: LucideIcons.messageCircle,
                tint: AppColors.warningBg,
                iconColor: AppColors.warning,
              ),
            ),
            SizedBox(
              width: width,
              child: StatCard(
                label: l10n.statGrading,
                value: data.pendingGrading,
                icon: LucideIcons.clipboardCheck,
                tint: AppColors.infoBg,
                iconColor: AppColors.info,
              ),
            ),
            SizedBox(
              width: width,
              child: StatCard(
                label: l10n.statReviews,
                value: data.pendingReviews,
                icon: LucideIcons.shieldAlert,
                tint: AppColors.primaryWash,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _WeakTopicsChart extends StatelessWidget {
  const _WeakTopicsChart({required this.topics});

  final List<WeakTopicStat> topics;

  @override
  Widget build(BuildContext context) {
    if (topics.isEmpty) {
      return FptCard(
        outlined: true,
        child: Text(
          AppLocalizations.of(context)!.emptyWeakTopicsChart,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }

    final maxCount = topics
        .map((t) => t.count)
        .fold<int>(0, (prev, c) => c > prev ? c : prev)
        .clamp(1, 999);

    return FptCard(
      padding: const EdgeInsets.fromLTRB(
        Insets.lg,
        Insets.xl,
        Insets.lg,
        Insets.lg,
      ),
      child: SizedBox(
        height: 200,
        child: BarChart(
          BarChartData(
            maxY: maxCount.toDouble() * 1.2,
            gridData: const FlGridData(show: false),
            borderData: FlBorderData(show: false),
            titlesData: FlTitlesData(
              topTitles: const AxisTitles(),
              rightTitles: const AxisTitles(),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  getTitlesWidget: (value, _) => Text(
                    value.toInt().toString(),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    if (index < 0 || index >= topics.length) {
                      return const SizedBox.shrink();
                    }
                    final label = topics[index].topic;
                    final short = label.length > 8
                        ? '${label.substring(0, 8)}…'
                        : label;
                    return Padding(
                      padding: const EdgeInsets.only(top: Insets.sm),
                      child: Text(
                        short,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    );
                  },
                ),
              ),
            ),
            barGroups: [
              for (var i = 0; i < topics.length; i++)
                BarChartGroupData(
                  x: i,
                  barRods: [
                    BarChartRodData(
                      toY: topics[i].count.toDouble(),
                      color: AppColors.navActive,
                      width: 16,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(Radii.sm),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: Motion.base);
  }
}

class _TeacherQuizShortcut extends StatelessWidget {
  const _TeacherQuizShortcut({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return FptCard(
      onTap: () => context.push(AppRoutes.teacherQuiz),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primaryWash,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: const Icon(
              LucideIcons.listChecks,
              color: AppColors.primary,
              size: 22,
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.teacherQuizTitle,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Gap(Insets.xs),
                Text(
                  l10n.teacherQuizSubtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            LucideIcons.chevronRight,
            size: 18,
            color: AppColors.textTertiary,
          ),
        ],
      ),
    ).animate().fadeIn(duration: Motion.base);
  }
}
