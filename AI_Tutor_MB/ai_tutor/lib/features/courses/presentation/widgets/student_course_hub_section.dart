import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/models/course.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../../memory/application/course_memory_provider.dart';
import '../../../memory/presentation/widgets/improve_suggestion_widgets.dart';
import '../../application/courses_controller.dart';

/// Khối chọn môn + tiến độ + hành động (Hỏi AI / Quiz / Ôn tập) — tích hợp trong Home.
class StudentCourseHubSection extends ConsumerWidget {
  const StudentCourseHubSection({
    super.key,
    required this.courses,
    required this.serviceTab,
    required this.onServiceTabChanged,
  });

  final List<Course> courses;
  final PlugProServiceTab serviceTab;
  final ValueChanged<PlugProServiceTab> onServiceTabChanged;

  void _onServiceAction(BuildContext context, WidgetRef ref, Course course) {
    ref.read(selectedCourseProvider.notifier).state = course;
    switch (serviceTab) {
      case PlugProServiceTab.primary:
        context.go(AppRoutes.studentTutor);
      case PlugProServiceTab.secondary:
        context.push(AppRoutes.studentQuizForCourse(course.id));
      case PlugProServiceTab.tertiary:
        context.push(AppRoutes.studentImprovePlan(course.id));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final selected = ref.watch(selectedCourseProvider);

    final uniqueCourses = <Course>[];
    final seen = <String>{};
    for (final c in courses) {
      if (seen.add(c.selectionKey)) uniqueCourses.add(c);
    }

    if (uniqueCourses.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
        child: EmptyState(
          title: l10n.emptyCoursesTitle,
          message: l10n.emptyCoursesMessage,
          ctaLabel: l10n.refresh,
          onCta: () => ref.invalidate(coursesControllerProvider),
        ),
      );
    }

    final hasSelection =
        selected != null && uniqueCourses.any((c) => c == selected);
    final active = hasSelection
        ? uniqueCourses.firstWhere((c) => c == selected)
        : uniqueCourses.first;

    if (!hasSelection) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(selectedCourseProvider.notifier).state = active;
      });
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CourseDropdown(
            items: uniqueCourses,
            value: active,
            onChanged: (course) =>
                ref.read(selectedCourseProvider.notifier).state = course,
          ),
          const Gap(Insets.lg),
          PlugProServiceTabs(
            selected: serviceTab,
            onSelected: onServiceTabChanged,
            labels: (primary: 'Hỏi AI', secondary: 'Quiz', tertiary: 'Ôn tập'),
          ),
          const Gap(Insets.md),
          _CourseDetailPanel(
            course: active,
            serviceTab: serviceTab,
            onAction: () => _onServiceAction(context, ref, active),
          ),
        ],
      ),
    );
  }
}

class _CourseDropdown extends StatelessWidget {
  const _CourseDropdown({
    required this.items,
    required this.value,
    required this.onChanged,
  });

  final List<Course> items;
  final Course value;
  final ValueChanged<Course> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.homeOrangeWash),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A211C18),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: Insets.lg),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<Course>(
          value: value,
          isExpanded: true,
          icon: const Icon(
            LucideIcons.chevronDown,
            color: AppColors.navActive,
            size: 22,
          ),
          borderRadius: BorderRadius.circular(16),
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
          items: items
              .map(
                (c) => DropdownMenuItem(
                  value: c,
                  child: Text(() {
                    final base = c.name.isNotEmpty
                        ? '${c.code} — ${c.name}'
                        : c.code;
                    final cls = c.className?.trim();
                    if (cls != null && cls.isNotEmpty) {
                      return '$base · $cls';
                    }
                    return base;
                  }(), overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: (c) {
            if (c != null) onChanged(c);
          },
        ),
      ),
    );
  }
}

class _CourseDetailPanel extends ConsumerWidget {
  const _CourseDetailPanel({
    required this.course,
    required this.serviceTab,
    required this.onAction,
  });

  final Course course;
  final PlugProServiceTab serviceTab;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final memory = ref.watch(courseMemoryProvider(course.id));

    final actionLabel = switch (serviceTab) {
      PlugProServiceTab.primary => l10n.askAboutCourse,
      PlugProServiceTab.secondary => 'Quiz luyện tập',
      PlugProServiceTab.tertiary => l10n.viewImprovePlan,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PlugProCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: AppColors.homeHeroGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      course.code.length >= 3
                          ? course.code.substring(0, 3).toUpperCase()
                          : course.code.toUpperCase(),
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.onOrange,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Gap(Insets.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          course.name.isNotEmpty ? course.name : course.code,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                        ),
                        if (course.className != null)
                          Text(
                            course.className!,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.textTertiary),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        memory.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (data) {
            if (data.pinnedSuggestions.isEmpty) return const SizedBox.shrink();
            return Column(
              children: [
                const Gap(Insets.lg),
                PlugProCard(
                  child: PinnedImproveSuggestionsSection(
                    courseRouteId: course.id,
                    pinnedLabels: data.pinnedSuggestions,
                    compact: true,
                  ),
                ),
              ],
            );
          },
        ),
        const Gap(Insets.lg),
        FptButton(label: actionLabel, expand: true, onPressed: onAction),
        const Gap(Insets.sm),
        Row(
          children: [
            Expanded(
              child: FptButton(
                label: 'Tiến độ',
                variant: FptButtonVariant.ghost,
                size: FptButtonSize.sm,
                icon: LucideIcons.trendingUp,
                onPressed: () => context.push(AppRoutes.studentProgress),
              ),
            ),
            const Gap(Insets.sm),
            Expanded(
              child: FptButton(
                label: 'Tài liệu',
                variant: FptButtonVariant.ghost,
                size: FptButtonSize.sm,
                icon: LucideIcons.bookOpen,
                onPressed: () => context.push(AppRoutes.studentMaterials),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
