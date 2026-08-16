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
import '../../../shared/models/class_section.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/teacher_classes_controller.dart';

class TeacherClassesScreen extends ConsumerWidget {
  const TeacherClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final classes = ref.watch(teacherClassesControllerProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.tabClasses),
      body: classes.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(teacherClassesControllerProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptyClassesTitle,
              message: l10n.emptyClassesMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(teacherClassesControllerProvider),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(teacherClassesControllerProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) {
                final section = items[index];
                return _ClassSectionTile(section: section)
                    .animate(delay: (40 * index).clamp(0, 320).ms)
                    .fadeIn(duration: Motion.base);
              },
            ),
          );
        },
      ),
    );
  }
}

class _ClassSectionTile extends StatelessWidget {
  const _ClassSectionTile({required this.section});

  final ClassSection section;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return FptCard(
      onTap: () => context.push(
        AppRoutes.teacherClassRoster(section.courseId, section.id),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  section.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              StatusPill(domain: 'enrollment', value: section.status),
            ],
          ),
          if (section.courseName != null || section.courseCode != null) ...[
            const Gap(Insets.sm),
            Text(
              [
                if (section.courseCode != null) section.courseCode,
                if (section.courseName != null) section.courseName,
              ].whereType<String>().join(' · '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (section.semester != null) ...[
            const Gap(Insets.xs),
            Text(
              section.semester!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const Gap(Insets.md),
          Row(
            children: [
              Icon(LucideIcons.users, size: 16, color: AppColors.textTertiary),
              const Gap(Insets.sm),
              Text(
                l10n.studentCount(section.studentCount ?? 0),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const Spacer(),
              Text(
                l10n.viewRoster,
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(color: AppColors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class TeacherRosterScreen extends ConsumerWidget {
  const TeacherRosterScreen({
    super.key,
    required this.courseId,
    required this.classId,
  });

  final String courseId;
  final String classId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final params = (courseId: courseId, classId: classId);
    final roster = ref.watch(teacherRosterControllerProvider(params));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: l10n.rosterTitle,
        actions: [
          IconButton(
            tooltip: l10n.teacherMaterialsTitle,
            icon: const Icon(LucideIcons.folderOpen),
            onPressed: () => context.push(
              AppRoutes.teacherClassMaterials(courseId, classId),
            ),
          ),
        ],
      ),
      body: roster.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () =>
              ref.invalidate(teacherRosterControllerProvider(params)),
        ),
        data: (students) {
          if (students.isEmpty) {
            return EmptyState(
              title: l10n.emptyRosterTitle,
              message: l10n.emptyRosterMessage,
              ctaLabel: l10n.refresh,
              onCta: () =>
                  ref.invalidate(teacherRosterControllerProvider(params)),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(teacherRosterControllerProvider(params).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              itemCount: students.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) {
                final student = students[index];
                return FptCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            student.fullName,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (student.email != null) ...[
                            const Gap(Insets.xs),
                            Text(
                              student.email!,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          if (student.weakTopics.isNotEmpty) ...[
                            const Gap(Insets.md),
                            Text(
                              l10n.weakTopicsSection,
                              style: Theme.of(context).textTheme.labelLarge,
                            ),
                            const Gap(Insets.sm),
                            Wrap(
                              spacing: Insets.sm,
                              runSpacing: Insets.sm,
                              children: [
                                for (final topic in student.weakTopics)
                                  WeakTopicChip(label: topic),
                              ],
                            ),
                          ],
                        ],
                      ),
                    )
                    .animate(delay: (40 * index).clamp(0, 320).ms)
                    .fadeIn(duration: Motion.base);
              },
            ),
          );
        },
      ),
    );
  }
}
