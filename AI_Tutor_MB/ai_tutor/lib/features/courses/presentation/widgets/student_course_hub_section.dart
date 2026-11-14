import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/constants/app_assets.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
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
      child: Container(
        padding: const EdgeInsets.all(Insets.lg),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(Radii.xl),
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _CourseDropdown(
              items: uniqueCourses,
              value: active,
              onChanged: (course) =>
                  ref.read(selectedCourseProvider.notifier).state = course,
            ),
            const Gap(Insets.md),
            _CourseServiceTabs(
              selected: serviceTab,
              onSelected: onServiceTabChanged,
            ),
            const Gap(Insets.md),
            _CourseDetailPanel(
              course: active,
              serviceTab: serviceTab,
              onAction: () => _onServiceAction(context, ref, active),
            ),
          ],
        ),
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
    const courseArt = [
      AppAssets.courseArtCampus,
      AppAssets.courseArtLaptop,
      AppAssets.courseArtBooks,
      AppAssets.courseArtMath,
    ];
    final art = courseArt[value.code.hashCode.abs() % courseArt.length];

    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          padding: const EdgeInsets.all(Insets.xs),
          decoration: BoxDecoration(
            color: AppColors.primaryWash,
            borderRadius: BorderRadius.circular(Radii.md),
          ),
          child: Image.asset(
            art,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
          ),
        ),
        const Gap(Insets.md),
        Expanded(
          child: DropdownButtonHideUnderline(
            child: DropdownButton<Course>(
              value: value,
              isExpanded: true,
              icon: const Icon(
                LucideIcons.chevronDown,
                color: AppColors.navActive,
                size: 22,
              ),
              borderRadius: BorderRadius.circular(Radii.lg),
              menuMaxHeight: 360,
              selectedItemBuilder: (context) => items
                  .map((course) => _SelectedCourseLabel(course: course))
                  .toList(),
              items: items
                  .map(
                    (course) => DropdownMenuItem(
                      value: course,
                      child: Text(
                        _courseDisplayName(course),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (course) {
                if (course != null) onChanged(course);
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _SelectedCourseLabel extends StatelessWidget {
  const _SelectedCourseLabel({required this.course});

  final Course course;

  @override
  Widget build(BuildContext context) {
    final className = course.className?.trim();
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          course.name.isNotEmpty ? course.name : course.code,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            height: 1.2,
          ),
        ),
        const Gap(Insets.xs),
        Text(
          [
            course.code,
            if (className != null && className.isNotEmpty) className,
          ].join(' · '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

String _courseDisplayName(Course course) {
  final title = course.name.isNotEmpty ? course.name : course.code;
  final className = course.className?.trim();
  return [
    course.code,
    title,
    if (className != null && className.isNotEmpty) className,
  ].join(' · ');
}

class _CourseServiceTabs extends StatelessWidget {
  const _CourseServiceTabs({required this.selected, required this.onSelected});

  final PlugProServiceTab selected;
  final ValueChanged<PlugProServiceTab> onSelected;

  @override
  Widget build(BuildContext context) {
    const tabs = [
      (PlugProServiceTab.primary, 'Hỏi AI'),
      (PlugProServiceTab.secondary, 'Quiz'),
      (PlugProServiceTab.tertiary, 'Ôn tập'),
    ];

    return Container(
      padding: const EdgeInsets.all(Insets.xs),
      decoration: BoxDecoration(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Row(
        children: [
          for (final tab in tabs)
            Expanded(
              child: Semantics(
                button: true,
                selected: selected == tab.$1,
                child: Material(
                  color: selected == tab.$1
                      ? AppColors.card
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(Radii.sm),
                  child: InkWell(
                    onTap: () => onSelected(tab.$1),
                    borderRadius: BorderRadius.circular(Radii.sm),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44),
                      alignment: Alignment.center,
                      child: Text(
                        tab.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: selected == tab.$1
                                  ? AppColors.primary
                                  : AppColors.textSecondary,
                              fontWeight: selected == tab.$1
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                            ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
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
        memory.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (data) {
            if (data.pinnedSuggestions.isEmpty) return const SizedBox.shrink();
            return PlugProCard(
              child: PinnedImproveSuggestionsSection(
                courseRouteId: course.id,
                pinnedLabels: data.pinnedSuggestions,
                compact: true,
              ),
            );
          },
        ),
        const Gap(Insets.sm),
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
