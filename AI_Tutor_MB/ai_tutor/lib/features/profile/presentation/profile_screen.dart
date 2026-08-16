import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/theme_mode_controller.dart';
import '../../../core/utils/status_style.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../../escalation/application/escalation_controller.dart';
import '../../home/application/home_controller.dart';
import '../../senior/application/senior_controller.dart';
import '../application/profile_controller.dart';

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 88,
      padding: const EdgeInsets.all(Insets.sm),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.peacockBlue.withValues(alpha: 0.22),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.peacockBlue.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: AppColors.inverse.withValues(alpha: 0.09),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Image.asset(
        AppAssets.cocVangLogoTransparent,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => Image.asset(
          AppAssets.cocVangLogo,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final session = ref.watch(authControllerProvider).valueOrNull;
    final profileAsync = ref.watch(profileControllerProvider);
    final homeAsync = ref.watch(homeControllerProvider);
    final isTeacher = session != null && isTeacherRole(session.role);
    final isSenior = session != null && isSeniorRole(session.role);
    final chatUnread = !isTeacher
        ? ref.watch(chatUnreadProvider).valueOrNull ?? 0
        : 0;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: profileAsync.when(
        loading: () => const LoadingSkeleton(itemCount: 5),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(profileControllerProvider),
        ),
        data: (profile) {
          final displayName = profile.fullName.isNotEmpty
              ? profile.fullName
              : (session?.fullName ?? '—');
          final studentCode = _studentCode(profile.userId, profile.email);
          final semester = homeAsync.maybeWhen(
            data: (home) => home.courses.isNotEmpty
                ? (home.courses.first.semester ?? 'Spring 2026')
                : 'Spring 2026',
            orElse: () => 'Spring 2026',
          );
          final questions = homeAsync.maybeWhen(
            data: (home) => home.questionsAsked,
            orElse: () => 0,
          );
          final courseCount = homeAsync.maybeWhen(
            data: (home) => home.courses.isNotEmpty
                ? home.courses.length
                : home.dashboard.enrolledCourseCount,
            orElse: () => 0,
          );
          final streak = homeAsync.maybeWhen(
            data: (home) => home.dashboard.studyStreak,
            orElse: () => 0,
          );

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              await Future.wait([
                ref.refresh(profileControllerProvider.future),
                ref.refresh(homeControllerProvider.future),
              ]);
            },
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              slivers: [
                SliverToBoxAdapter(
                  child: PortalCompactHeader.profile(
                    title: displayName,
                    subtitle: '$studentCode · $semester',
                    profileAvatar: const _ProfileAvatar(),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      Insets.screenH,
                      Insets.lg,
                      Insets.screenH,
                      Insets.xxxl,
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _ProfileStatCard(
                                value: streak,
                                label: l10n.profileStreakStat,
                                color: AppColors.accent,
                              ),
                            ),
                            const Gap(Insets.md),
                            Expanded(
                              child: _ProfileStatCard(
                                value: questions,
                                label: l10n.profileQuestionsStat,
                                color: AppColors.peacockBlue,
                              ),
                            ),
                            const Gap(Insets.md),
                            Expanded(
                              child: _ProfileStatCard(
                                value: courseCount,
                                label: l10n.profileCoursesStat,
                                color: AppColors.leafGreen,
                              ),
                            ),
                          ],
                        ),
                        const Gap(Insets.xl),
                        _ProfileMenuCard(
                          children: [
                            _ProfileMenuItem(
                              icon: Icons.person_outline,
                              title: l10n.editProfileTitle,
                              onTap: () => context.push(AppRoutes.editProfile),
                            ),
                            _ProfileMenuItem(
                              icon: Icons.lock_outline,
                              title: l10n.changePasswordTitle,
                              onTap: () =>
                                  context.push(AppRoutes.changePassword),
                            ),
                            _ProfileMenuItem(
                              icon: Icons.notifications_none_outlined,
                              title: l10n.notificationsTitle,
                              onTap: () =>
                                  context.push(AppRoutes.notifications),
                            ),
                            if (!isTeacher)
                              _ProfileMenuItem(
                                icon: Icons.chat_bubble_outline,
                                title: l10n.liveChatTitle,
                                badgeCount: chatUnread,
                                onTap: () =>
                                    context.push(AppRoutes.escalationHistory),
                              ),
                            if (!isTeacher)
                              _ProfileMenuItem(
                                icon: Icons.assignment_outlined,
                                title: l10n.assignmentsTab,
                                onTap: () =>
                                    context.go(AppRoutes.studentAssignments),
                              ),
                            if (!isTeacher)
                              _ProfileMenuItem(
                                icon: Icons.help_outline,
                                title: l10n.profileHelpFeedback,
                                onTap: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(l10n.profileHelpComingSoon),
                                    ),
                                  );
                                },
                              ),
                            _ProfileMenuItem(
                              icon: Icons.logout,
                              title: l10n.logout,
                              isDestructive: true,
                              showDivider: false,
                              onTap: () async {
                                await ref
                                    .read(authControllerProvider.notifier)
                                    .logout();
                                if (context.mounted) {
                                  context.go(AppRoutes.login);
                                }
                              },
                            ),
                          ],
                        ),
                        if (isTeacher || isSenior) ...[
                          const Gap(Insets.xl),
                          _TeacherExtras(
                            isSenior: isSenior,
                            seniorQueue: isSenior
                                ? ref
                                      .watch(seniorQueueControllerProvider)
                                      .maybeWhen(
                                        data: (d) => d.totalPending,
                                        orElse: () => 0,
                                      )
                                : 0,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _studentCode(String userId, String? email) {
    if (email != null && email.contains('@')) {
      final local = email.split('@').first.toUpperCase();
      if (local.length >= 4) return local;
    }
    if (userId.length >= 6) return userId.substring(0, 8).toUpperCase();
    return userId.toUpperCase();
  }
}

class _ProfileStatCard extends StatelessWidget {
  const _ProfileStatCard({
    required this.value,
    required this.label,
    required this.color,
  });

  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Insets.md,
        vertical: Insets.lg,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.borderHairline),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A211C18),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            '$value',
            style: statStyle().copyWith(fontSize: 32, color: color),
          ),
          const Gap(Insets.xs),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textTertiary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileMenuCard extends StatelessWidget {
  const _ProfileMenuCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.borderHairline),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A211C18),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }
}

class _ProfileMenuItem extends StatelessWidget {
  const _ProfileMenuItem({
    required this.icon,
    required this.title,
    required this.onTap,
    this.badgeCount,
    this.isDestructive = false,
    this.showDivider = true,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final int? badgeCount;
  final bool isDestructive;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final color =
        isDestructive ? AppColors.error : AppColors.splashNavy;

    return Column(
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(Radii.lg),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: Insets.lg,
                vertical: Insets.lg,
              ),
              child: Row(
                children: [
                  Icon(icon, color: color, size: 22),
                  const Gap(Insets.md),
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: color,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (badgeCount != null && badgeCount! > 0) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: Insets.sm,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(Radii.full),
                      ),
                      constraints: const BoxConstraints(minWidth: 20),
                      child: Text(
                        badgeCount! > 99 ? '99+' : badgeCount.toString(),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.onOrange,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Gap(Insets.sm),
                  ],
                  if (!isDestructive)
                    const Icon(
                      Icons.chevron_right,
                      color: AppColors.textTertiary,
                      size: 22,
                    ),
                ],
              ),
            ),
          ),
        ),
        if (showDivider)
          const Divider(
            height: 1,
            thickness: 1,
            indent: Insets.lg,
            endIndent: Insets.lg,
            color: AppColors.borderHairline,
          ),
      ],
    );
  }
}

class _TeacherExtras extends ConsumerWidget {
  const _TeacherExtras({required this.isSenior, required this.seniorQueue});

  final bool isSenior;
  final int seniorQueue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final themeMode = ref.watch(themeModeControllerProvider);

    return _ProfileMenuCard(
      children: [
        _ProfileMenuItem(
          icon: Icons.quiz_outlined,
          title: l10n.teacherQuizManage,
          onTap: () => context.push(AppRoutes.teacherQuiz),
        ),
        _ProfileMenuItem(
          icon: Icons.task_alt_outlined,
          title: 'Expert Tasks V2',
          onTap: () => context.push(AppRoutes.expertTasks),
        ),
        _ProfileMenuItem(
          icon: Icons.dark_mode_outlined,
          title: l10n.appearanceTitle,
          onTap: () {
            ref
                .read(themeModeControllerProvider.notifier)
                .setMode(
                  themeMode == ThemeMode.dark
                      ? ThemeMode.light
                      : ThemeMode.dark,
                );
          },
        ),
        if (isSenior) ...[
          _ProfileMenuItem(
            icon: Icons.hub_outlined,
            title: 'Expert Co-Training V2',
            onTap: () => context.push(AppRoutes.v2ExpertHub),
          ),
          _ProfileMenuItem(
            icon: Icons.shield_outlined,
            title: l10n.seniorReviewQueueTitle,
            onTap: () => context.push(AppRoutes.seniorReviewQueue),
          ),
          _ProfileMenuItem(
            icon: Icons.psychology_outlined,
            title: l10n.knowledgeCandidatesTitle,
            showDivider: false,
            onTap: () => context.push(AppRoutes.knowledgeCandidates),
          ),
        ],
      ],
    );
  }
}
