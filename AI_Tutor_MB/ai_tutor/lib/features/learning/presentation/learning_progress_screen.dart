import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/improve_plan.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../../memory/application/course_memory_provider.dart';
import '../../memory/data/improve_plan_repository.dart';
import '../../memory/presentation/widgets/improve_suggestion_widgets.dart';
import '../../student/student_route_handoff.dart';
import '../application/learning_progress_controller.dart';

class LearningProgressScreen extends HookConsumerWidget {
  const LearningProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final courses = ref.watch(coursesControllerProvider);
    final selected = ref.watch(selectedCourseProvider);

    return courses.when(
      loading: () => const Scaffold(body: LoadingSkeleton(itemCount: 4)),
      error: (error, _) => Scaffold(
        body: ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(coursesControllerProvider),
        ),
      ),
      data: (items) {
        final unique = _uniqueCourses(items);
        if (unique.isEmpty) {
          return Scaffold(
            body: EmptyState(
              title: l10n.emptyCoursesTitle,
              message: l10n.emptyCoursesMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(coursesControllerProvider),
            ),
          );
        }

        final active = _resolveActiveCourse(unique, selected);
        if (selected == null || selected.selectionKey != active.selectionKey) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.read(selectedCourseProvider.notifier).state = active;
          });
        }

        final progress = ref.watch(learningProgressProvider(active.id));

        return DefaultTabController(
          length: 3,
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: FptAppBar(
              title: 'Tiến độ học tập',
              leading: IconButton(
                icon: const Icon(LucideIcons.arrowLeft),
                onPressed: () => context.canPop()
                    ? context.pop()
                    : context.go(AppRoutes.studentHome),
              ),
              actions: [
                IconButton(
                  tooltip: 'Phân tích tiến độ',
                  icon: const Icon(LucideIcons.sparkles),
                  onPressed: () => _analyzeProgress(context, ref, active),
                ),
              ],
              bottom: const PreferredSize(
                preferredSize: Size.fromHeight(48),
                child: TabBar(
                  tabs: [
                    Tab(text: 'Tổng quan'),
                    Tab(text: 'Kiến thức'),
                    Tab(text: 'Kế hoạch'),
                  ],
                ),
              ),
            ),
            body: progress.when(
              loading: () => const LoadingSkeleton(itemCount: 5),
              error: (error, _) => ErrorState(
                message: describeError(error),
                onRetry: () =>
                    ref.invalidate(learningProgressProvider(active.id)),
              ),
              data: (data) {
                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () =>
                      ref.refresh(learningProgressProvider(active.id).future),
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          Insets.screenH,
                          Insets.md,
                          Insets.screenH,
                          Insets.sm,
                        ),
                        child: _CoursePicker(
                          courses: unique,
                          value: active,
                          onChanged: (course) {
                            ref.read(selectedCourseProvider.notifier).state =
                                course;
                          },
                        ),
                      ),
                      Expanded(
                        child: TabBarView(
                          children: [
                            _OverviewTab(course: active, data: data),
                            _KnowledgeTab(course: active, data: data),
                            _PlanTab(course: active, data: data),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  List<Course> _uniqueCourses(List<Course> courses) {
    final unique = <Course>[];
    final seen = <String>{};
    for (final course in courses) {
      if (seen.add(course.selectionKey)) unique.add(course);
    }
    return unique;
  }

  Course _resolveActiveCourse(List<Course> courses, Course? selected) {
    if (selected != null &&
        courses.any((c) => c.selectionKey == selected.selectionKey)) {
      return courses.firstWhere((c) => c.selectionKey == selected.selectionKey);
    }
    return courses.first;
  }
}

Future<void> _analyzeProgress(
  BuildContext context,
  WidgetRef ref,
  Course course,
) async {
  final session = ref.read(authControllerProvider).valueOrNull;
  if (session == null) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('AI đang phân tích bộ nhớ học tập...')),
  );
  try {
    await ref
        .read(improvePlanRepositoryProvider)
        .analyzeProgress(
          studentId: session.userId,
          courseId: course.code.isNotEmpty ? course.code : course.id,
          classId: course.classId,
        );
    ref.invalidate(learningProgressProvider(course.id));
    ref.invalidate(courseMemoryProvider(course.id));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã hoàn tất phân tích kế hoạch học tập.'),
        ),
      );
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(describeError(error))));
    }
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.course, required this.data});

  final Course course;
  final LearningProgressData data;

  @override
  Widget build(BuildContext context) {
    final mastery = masteryPercent(
      learnedTopics: data.memory.learnedTopics,
      weakTopics: data.memory.weakTopics,
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        Insets.xxxl,
      ),
      children: [
        PlugProCard(
          child: Row(
            children: [
              SizedBox(
                width: 84,
                height: 84,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CircularProgressIndicator(
                      value: mastery / 100,
                      strokeWidth: 8,
                      backgroundColor: AppColors.borderHairline,
                      color: mastery >= 70
                          ? AppColors.leafGreen
                          : AppColors.accent,
                    ),
                    Text(
                      '$mastery%',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
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
                      'Mức nắm kiến thức',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Gap(Insets.xs),
                    Text(
                      '${data.memory.learnedTopics.length} chủ đề đã nắm · ${data.memory.weakTopics.length} chủ đề còn yếu',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Gap(Insets.lg),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                label: 'Chuỗi học',
                value: '${data.dashboard.studyStreak}',
                icon: LucideIcons.flame,
                color: AppColors.accent,
              ),
            ),
            const Gap(Insets.md),
            Expanded(
              child: _StatTile(
                label: 'Câu đã hỏi',
                value: '${data.dashboard.questionsAsked}',
                icon: LucideIcons.messageCircle,
                color: AppColors.peacockBlue,
              ),
            ),
          ],
        ),
        if (data.dashboard.upcomingAssignments.isNotEmpty) ...[
          const Gap(Insets.lg),
          const PlugProSectionHeader(title: 'Việc cần làm tiếp theo'),
          const Gap(Insets.sm),
          ...data.dashboard.upcomingAssignments
              .take(4)
              .map(
                (title) => Padding(
                  padding: const EdgeInsets.only(bottom: Insets.sm),
                  child: PlugProCard(
                    onTap: () => context.push(AppRoutes.studentMaterials),
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.clipboardList,
                          size: 18,
                          color: AppColors.fptOrange,
                        ),
                        const Gap(Insets.md),
                        Expanded(child: Text(title)),
                      ],
                    ),
                  ),
                ),
              ),
        ],
        const Gap(Insets.lg),
        FptButton(
          label: 'Tài liệu & bài tập',
          icon: LucideIcons.bookOpen,
          variant: FptButtonVariant.secondary,
          expand: true,
          onPressed: () => context.push(AppRoutes.studentMaterials),
        ),
        const Gap(Insets.sm),
        FptButton(
          label: 'Hỗ trợ từ giảng viên',
          icon: LucideIcons.lifeBuoy,
          variant: FptButtonVariant.ghost,
          expand: true,
          onPressed: () => context.push(AppRoutes.escalationHistory),
        ),
      ],
    );
  }
}

class _KnowledgeTab extends ConsumerWidget {
  const _KnowledgeTab({required this.course, required this.data});

  final Course course;
  final LearningProgressData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final topics = mergeImproveTopics(
      memory: data.memory,
      planWeakTopics: data.plan?.weakTopics ?? const [],
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        Insets.xxxl,
      ),
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () =>
                _showEditMemoryDialog(context, ref, course, data.memory),
            icon: const Icon(LucideIcons.pencil, size: 16),
            label: const Text('Chỉnh sửa bộ nhớ'),
          ),
        ),
        PlugProCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Chủ đề đã nắm (${data.memory.learnedTopics.length})',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const Gap(Insets.sm),
              if (data.memory.learnedTopics.isEmpty)
                Text(
                  'Chưa có chủ đề đã nắm. Bấm Chỉnh sửa để thêm.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                )
              else
                Wrap(
                  spacing: Insets.xs,
                  runSpacing: Insets.xs,
                  children: data.memory.learnedTopics
                      .map((topic) => Chip(label: Text(topic)))
                      .toList(),
                ),
              const Gap(Insets.md),
              Text(
                'Chủ đề còn yếu (${data.memory.weakTopics.length})',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const Gap(Insets.sm),
              if (data.memory.weakTopics.isEmpty)
                Text(
                  'Chưa có chủ đề yếu.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                )
              else
                Wrap(
                  spacing: Insets.xs,
                  runSpacing: Insets.xs,
                  children: data.memory.weakTopics
                      .map((topic) => Chip(label: Text(topic)))
                      .toList(),
                ),
            ],
          ),
        ),
        if (data.memory.recentQuestions.isNotEmpty) ...[
          const Gap(Insets.lg),
          const PlugProSectionHeader(title: 'Câu hỏi gần đây'),
          const Gap(Insets.sm),
          ...data.memory.recentQuestions
              .take(5)
              .map(
                (question) => Padding(
                  padding: const EdgeInsets.only(bottom: Insets.sm),
                  child: PlugProCard(child: Text(question)),
                ),
              ),
        ],
        if (data.memory.pinnedSuggestions.isNotEmpty) ...[
          const Gap(Insets.lg),
          PlugProCard(
            child: PinnedImproveSuggestionsSection(
              courseRouteId: course.id,
              pinnedLabels: data.memory.pinnedSuggestions,
            ),
          ),
        ],
        if (topics.isNotEmpty) ...[
          const Gap(Insets.lg),
          const PlugProSectionHeader(title: 'Chủ đề cần củng cố'),
          const Gap(Insets.sm),
          ...topics
              .take(8)
              .map(
                (topic) => Padding(
                  padding: const EdgeInsets.only(bottom: Insets.sm),
                  child: ImproveSuggestionActionRow(
                    label: topic,
                    pinned: false,
                    learnLabel: l10n.learnNow,
                    quizLabel: 'Tạo quiz',
                    pinTooltip: '',
                    onLearn: () => openStudyChatFromSuggestion(
                      context,
                      ref,
                      courseRouteId: course.id,
                      suggestionText: topic,
                    ),
                    onCreateQuiz: () => openQuizFromSuggestion(
                      context,
                      ref,
                      courseRouteId: course.id,
                      suggestionText: topic,
                    ),
                  ),
                ),
              ),
        ],
      ],
    );
  }
}

class _PlanTab extends StatelessWidget {
  const _PlanTab({required this.course, required this.data});

  final Course course;
  final LearningProgressData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final riskPercent =
        data.plan?.riskPercent ??
        riskPercentForLevel(data.plan?.riskLevel ?? 'LOW');

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        Insets.xxxl,
      ),
      children: [
        PlugProCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Mức rủi ro kiến thức',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const Gap(Insets.sm),
              LinearProgressIndicator(
                value: riskPercent / 100,
                minHeight: 8,
                borderRadius: BorderRadius.circular(Radii.full),
                backgroundColor: AppColors.borderHairline,
                color: riskPercent >= 70
                    ? AppColors.error
                    : AppColors.leafGreen,
              ),
              const Gap(Insets.xs),
              Text(
                '$riskPercent% · ${data.plan?.riskLevel ?? 'LOW'}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
              ),
            ],
          ),
        ),
        const Gap(Insets.lg),
        FptButton(
          label: l10n.viewImprovePlan,
          icon: LucideIcons.trendingUp,
          expand: true,
          onPressed: () =>
              context.push(AppRoutes.studentImprovePlan(course.id)),
        ),
      ],
    );
  }
}

Future<void> _showEditMemoryDialog(
  BuildContext context,
  WidgetRef ref,
  Course course,
  StudentMemory memory,
) async {
  final learnedController = TextEditingController(
    text: memory.learnedTopics.join(', '),
  );
  final weakController = TextEditingController(
    text: memory.weakTopics.join(', '),
  );
  var saving = false;

  await showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: const Text('Chỉnh sửa bộ nhớ học tập'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: learnedController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Chủ đề đã nắm',
                      hintText: 'Ví dụ: MVC Flow, JPA Repository',
                    ),
                  ),
                  const Gap(Insets.md),
                  TextField(
                    controller: weakController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Chủ đề còn yếu',
                      hintText: 'Ví dụ: Chuyển đổi nhị phân',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: saving ? null : () => Navigator.pop(dialogContext),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: saving
                    ? null
                    : () async {
                        setState(() => saving = true);
                        final session = ref
                            .read(authControllerProvider)
                            .valueOrNull;
                        if (session == null) return;
                        try {
                          await ref
                              .read(improvePlanRepositoryProvider)
                              .updateMemory(
                                studentId: session.userId,
                                courseId: course.code.isNotEmpty
                                    ? course.code
                                    : course.id,
                                classId: course.classId,
                                learnedTopics: parseTopicList(
                                  learnedController.text,
                                ),
                                weakTopics: parseTopicList(weakController.text),
                              );
                          ref.invalidate(learningProgressProvider(course.id));
                          ref.invalidate(courseMemoryProvider(course.id));
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Đã cập nhật hồ sơ học tập.'),
                              ),
                            );
                          }
                        } catch (error) {
                          setState(() => saving = false);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(describeError(error))),
                            );
                          }
                        }
                      },
                child: Text(saving ? 'Đang lưu...' : 'Lưu thay đổi'),
              ),
            ],
          );
        },
      );
    },
  );

  learnedController.dispose();
  weakController.dispose();
}

class _CoursePicker extends StatelessWidget {
  const _CoursePicker({
    required this.courses,
    required this.value,
    required this.onChanged,
  });

  final List<Course> courses;
  final Course value;
  final ValueChanged<Course> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<Course>(
          value: value,
          isExpanded: true,
          items: courses
              .map(
                (course) => DropdownMenuItem(
                  value: course,
                  child: Text(
                    course.name.isNotEmpty
                        ? '${course.code} — ${course.name}'
                        : course.code,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (course) {
            if (course != null) onChanged(course);
          },
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return PlugProCard(
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
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
