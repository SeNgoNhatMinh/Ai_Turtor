import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
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
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/improve_plan.dart';
import '../../../shared/widgets/widgets.dart';
import '../../courses/application/courses_controller.dart';
import '../../quiz/presentation/student_quiz_screens.dart';
import '../application/course_memory_provider.dart';
import '../application/improve_plan_controller.dart';
import 'widgets/improve_suggestion_widgets.dart';

class ImprovePlanScreen extends ConsumerWidget {
  const ImprovePlanScreen({super.key, required this.courseId});

  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final planData = ref.watch(improvePlanControllerProvider(courseId));
    final courses = ref.watch(coursesControllerProvider);

    final courseCode = courses.maybeWhen(
      data: (items) {
        for (final course in items) {
          if (course.id == courseId) return course.code;
        }
        return courseId;
      },
      orElse: () => courseId,
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: planData.when(
        loading: () => const LoadingSkeleton(itemCount: 4),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () =>
              ref.invalidate(improvePlanControllerProvider(courseId)),
        ),
        data: (data) {
          final plan = data.plan;
          final topics = mergeImproveTopics(
            memory: data.memory,
            planWeakTopics: plan?.weakTopics ?? const [],
          );
          final steps = plan?.resolvedSteps ?? const <PlanStep>[];
          final riskPercent =
              plan?.riskPercent ?? riskPercentForLevel(plan?.riskLevel ?? 'LOW');
          final pinned = data.memory.pinnedSuggestions;

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(improvePlanControllerProvider(courseId).future),
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              slivers: [
                SliverToBoxAdapter(child: _ImprovePlanHeader(courseCode: courseCode)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    Insets.screenH,
                    Insets.lg,
                    Insets.screenH,
                    Insets.xxxl,
                  ),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      if (plan == null && topics.isEmpty)
                        EmptyState(
                          title: l10n.emptyPlanTitle,
                          ctaLabel: l10n.generatePlan,
                          onCta: () => ref
                              .read(
                                improvePlanControllerProvider(courseId).notifier,
                              )
                              .generateSuggestions(courseId),
                        )
                      else ...[
                        _RiskCard(
                          percent: riskPercent,
                          riskLevel: plan?.riskLevel ?? 'MEDIUM',
                          summary: plan?.evidence ?? l10n.improvePlanDefaultSummary,
                        ),
                        if (pinned.isNotEmpty) ...[
                          const Gap(Insets.xl),
                          PinnedImproveSuggestionsSection(
                            courseRouteId: courseId,
                            pinnedLabels: pinned,
                          ),
                        ],
                        const Gap(Insets.xl),
                        Text(
                          l10n.improveTopicsHeading,
                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: AppColors.textTertiary,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Gap(Insets.md),
                        if (topics.isEmpty)
                          Text(
                            l10n.emptyPlanTitle,
                            style: Theme.of(context).textTheme.bodyMedium,
                          )
                        else
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: topics
                                .map(
                                  (topic) => Padding(
                                    padding: const EdgeInsets.only(
                                      bottom: Insets.sm,
                                    ),
                                    child: _SuggestionRow(
                                      courseId: courseId,
                                      label: topic,
                                      pinned: pinned.contains(topic),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        if (steps.isNotEmpty) ...[
                          const Gap(Insets.xl),
                          Text(
                            l10n.improveRoadmapHeading,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(
                                  color: AppColors.textTertiary,
                                  letterSpacing: 0.8,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const Gap(Insets.md),
                          ...steps.asMap().entries.map(
                            (entry) => Padding(
                              padding: const EdgeInsets.only(bottom: Insets.md),
                              child: _PlanStepCard(
                                step: entry.value,
                                index: entry.key + 1,
                              ),
                            ),
                          ),
                        ],
                        const Gap(Insets.lg),
                        FptButton(
                          label: l10n.generatePlan,
                          variant: FptButtonVariant.secondary,
                          expand: true,
                          onPressed: () => ref
                              .read(
                                improvePlanControllerProvider(courseId).notifier,
                              )
                              .generateSuggestions(courseId),
                        ),
                        if (plan != null && !plan.completed) ...[
                          const Gap(Insets.md),
                          FptButton(
                            label: l10n.completePlan,
                            expand: true,
                            onPressed: () => ref
                                .read(
                                  improvePlanControllerProvider(courseId)
                                      .notifier,
                                )
                                .completePlan(plan.id),
                          ),
                        ],
                      ],
                    ]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ImprovePlanHeader extends StatelessWidget {
  const _ImprovePlanHeader({required this.courseCode});

  final String courseCode;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return SizedBox(
      height: 180,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.leafGreen,
            ),
          ),
          CustomPaint(
            painter: _HeaderWavePainter(),
            size: Size.infinite,
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.md,
                Insets.screenH,
                Insets.lg,
              ),
              child: Row(
                children: [
                  Image.asset(
                    AppAssets.cocVangLogo,
                    width: 56,
                    height: 56,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.school,
                      color: Colors.white,
                      size: 40,
                    ),
                  ),
                  const Gap(Insets.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          l10n.improvePlanTitle,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          l10n.improvePlanSubtitle(courseCode),
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.chevron_left, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderWavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, size.height * 0.78)
      ..quadraticBezierTo(
        size.width * 0.5,
        size.height,
        size.width,
        size.height * 0.72,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = AppColors.authScreenBg);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _RiskCard extends StatelessWidget {
  const _RiskCard({
    required this.percent,
    required this.riskLevel,
    required this.summary,
  });

  final int percent;
  final String riskLevel;
  final String summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final riskLabel = switch (riskLevel.toUpperCase()) {
      'HIGH' => l10n.riskLevelHigh,
      'MEDIUM' => l10n.riskLevelMedium,
      _ => l10n.riskLevelLow,
    };

    return Container(
      padding: const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A211C18),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            height: 72,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: percent / 100,
                  strokeWidth: 6,
                  backgroundColor: AppColors.primaryWash,
                  color: AppColors.primary,
                ),
                Text(
                  '$percent%',
                  style: statStyle().copyWith(
                    fontSize: 18,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const Gap(Insets.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.riskLevelLabel(riskLabel),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Gap(Insets.xs),
                Text(
                  summary,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SuggestionRow extends HookConsumerWidget {
  const _SuggestionRow({
    required this.courseId,
    required this.label,
    required this.pinned,
  });

  final String courseId;
  final String label;
  final bool pinned;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final togglingPin = useState(false);
    final learning = useState(false);

    Future<void> onTogglePin() async {
      togglingPin.value = true;
      try {
        await ref
            .read(improvePlanControllerProvider(courseId).notifier)
            .togglePin(courseId, label, pinned: pinned);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      } finally {
        togglingPin.value = false;
      }
    }

    Future<void> onLearnNow() async {
      learning.value = true;
      try {
        final conversationId = await ref
            .read(improvePlanControllerProvider(courseId).notifier)
            .learnFromSuggestion(courseId, label);
        if (context.mounted && conversationId != null) {
          context.push(AppRoutes.studentTutorChat(conversationId));
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      } finally {
        learning.value = false;
      }
    }

    return ImproveSuggestionActionRow(
      label: label,
      pinned: pinned,
      loadingLearn: learning.value,
      loadingPin: togglingPin.value,
      learnLabel: l10n.learnNow,
      quizLabel: 'Tạo quiz',
      pinTooltip: pinned ? l10n.unpinSuggestion : l10n.pinSuggestion,
      onLearn: onLearnNow,
      onCreateQuiz: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TakeQuizScreen(
            courseId: courseId,
            topic: label,
            suggestionText: label,
          ),
        ),
      ),
      onTogglePin: onTogglePin,
    );
  }
}

class _PlanStepCard extends StatelessWidget {
  const _PlanStepCard({required this.step, required this.index});

  final PlanStep step;
  final int index;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final active = step.status == PlanStepStatus.inProgress;
    final completed = step.status == PlanStepStatus.completed;

    return Container(
      padding: const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: active
            ? Border.all(color: AppColors.primary, width: 1.5)
            : Border.all(color: AppColors.borderHairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepBadge(step: step, index: index),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.splashNavy,
                    decoration:
                        completed ? TextDecoration.lineThrough : null,
                  ),
                ),
                const Gap(Insets.xs),
                Text(
                  switch (step.status) {
                    PlanStepStatus.completed => l10n.planStepCompleted,
                    PlanStepStatus.inProgress =>
                      step.progressLabel ?? l10n.planStepInProgress,
                    PlanStepStatus.notStarted => l10n.planStepNotStarted,
                  },
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: active
                        ? AppColors.primary
                        : AppColors.textTertiary,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
                if (active && step.progressValue != null) ...[
                  const Gap(Insets.sm),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.full),
                    child: LinearProgressIndicator(
                      value: step.progressValue,
                      minHeight: 6,
                      backgroundColor: AppColors.primaryWash,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepBadge extends StatelessWidget {
  const _StepBadge({required this.step, required this.index});

  final PlanStep step;
  final int index;

  @override
  Widget build(BuildContext context) {
    switch (step.status) {
      case PlanStepStatus.completed:
        return Container(
          width: 28,
          height: 28,
          decoration: const BoxDecoration(
            color: AppColors.success,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, color: Colors.white, size: 16),
        );
      case PlanStepStatus.inProgress:
        return Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
          child: Text(
            '$index',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        );
      case PlanStepStatus.notStarted:
        return Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFF0F2F8),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.borderHairline),
          ),
          child: Text(
            '$index',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.textTertiary,
              fontWeight: FontWeight.w700,
            ),
          ),
        );
    }
  }
}
