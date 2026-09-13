import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/utils/vietnamese_text_input.dart';
import '../../../core/utils/formatters.dart';
import '../application/quiz_hub_stats.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/quiz.dart';
import '../../../shared/widgets/widgets.dart';
import '../../courses/application/courses_controller.dart';
import '../../memory/application/course_memory_provider.dart';
import '../../memory/application/improve_plan_controller.dart';
import '../../student/student_route_handoff.dart';
import '../application/quiz_controller.dart';

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

Course? _courseMatchingId(List<Course> courses, String? courseId) {
  if (courseId == null || courseId.isEmpty) return null;
  for (final course in courses) {
    if (course.id == courseId ||
        course.code == courseId ||
        course.selectionKey == courseId) {
      return course;
    }
  }
  return null;
}

// ── Student Quiz List ────────────────────────────────────────────

class StudentQuizScreen extends HookConsumerWidget {
  const StudentQuizScreen({super.key, this.initialCourseId});

  final String? initialCourseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
              title: 'Chưa có môn học',
              message: 'Hãy đăng ký môn để làm quiz luyện tập.',
              ctaLabel: 'Làm mới',
              onCta: () => ref.invalidate(coursesControllerProvider),
            ),
          );
        }

        final active = _resolveActiveCourse(
          unique,
          _courseMatchingId(unique, initialCourseId) ?? selected,
        );
        if (selected == null || selected.selectionKey != active.selectionKey) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.read(selectedCourseProvider.notifier).state = active;
          });
        }

        return _StudentQuizBody(course: active, courses: unique);
      },
    );
  }
}

class _StudentQuizBody extends HookConsumerWidget {
  const _StudentQuizBody({required this.course, required this.courses});

  final Course course;
  final List<Course> courses;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = useState(0);
    final history = ref.watch(studentQuizHistoryProvider(course.id));
    final assigned = ref.watch(studentQuizAssignmentsProvider(course.id));
    final sessions = history.valueOrNull ?? const <QuizSession>[];
    final assignedItems = assigned.valueOrNull ?? const <QuizAssignment>[];
    final inProgress = sessions.where((session) => !session.isSubmitted).toList();
    final submitted = sessions.where((session) => session.isSubmitted).toList();
    final stats = QuizHubStats.from(
      sessions: sessions,
      assignedCount: assignedItems.length,
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: 'Quiz luyện tập',
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => context.canPop()
              ? context.pop()
              : context.go(AppRoutes.studentHome),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              Insets.md,
              Insets.screenH,
              Insets.sm,
            ),
            child: _CoursePicker(
              courses: courses,
              value: course,
              onChanged: (next) {
                ref.read(selectedCourseProvider.notifier).state = next;
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              0,
              Insets.screenH,
              Insets.sm,
            ),
            child: _QuizStatGrid(stats: stats),
          ),
          if (inProgress.isNotEmpty && tabIndex.value != 1)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                0,
                Insets.screenH,
                Insets.sm,
              ),
              child: _ContinueQuizAlert(
                onContinue: () => tabIndex.value = 1,
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _HubTab(
                    label: 'Tạo quiz',
                    selected: tabIndex.value == 0,
                    onTap: () => tabIndex.value = 0,
                  ),
                  _HubTab(
                    label: inProgress.isEmpty
                        ? 'Đang làm'
                        : 'Đang làm (${inProgress.length})',
                    selected: tabIndex.value == 1,
                    onTap: () => tabIndex.value = 1,
                  ),
                  _HubTab(
                    label: assignedItems.isEmpty
                        ? 'Được giao'
                        : 'Được giao (${assignedItems.length})',
                    selected: tabIndex.value == 2,
                    onTap: () => tabIndex.value = 2,
                  ),
                  _HubTab(
                    label: submitted.isEmpty
                        ? 'Lịch sử'
                        : 'Lịch sử (${submitted.length})',
                    selected: tabIndex.value == 3,
                    onTap: () => tabIndex.value = 3,
                  ),
                ],
              ),
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: switch (tabIndex.value) {
              1 => _QuizSessionList(
                courseId: course.id,
                historyAsync: history,
                submittedOnly: false,
                emptyTitle: 'Chưa có quiz đang làm',
                emptyMessage:
                    'Hãy tạo mới hoặc tiếp tục một quiz. Quiz dở sẽ hiện ở đây.',
              ),
              2 => _AssignedTab(courseId: course.id, assignedAsync: assigned),
              3 => _QuizSessionList(
                courseId: course.id,
                historyAsync: history,
                submittedOnly: true,
                emptyTitle: 'Chưa có kết quả quiz',
                emptyMessage: 'Nộp một quiz để xem lại điểm và đáp án.',
              ),
              _ => _GenerateQuizTab(courseId: course.id),
            },
          ),
        ],
      ),
    );
  }
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

class _HubTab extends StatelessWidget {
  const _HubTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: Insets.xs),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: Motion.fast,
          padding: const EdgeInsets.symmetric(
            horizontal: Insets.md,
            vertical: Insets.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? AppColors.card : AppColors.raised,
            borderRadius: BorderRadius.circular(Radii.full),
            boxShadow: selected ? Shadows.md : null,
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _QuizStatGrid extends StatelessWidget {
  const _QuizStatGrid({required this.stats});
  final QuizHubStats stats;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: Insets.sm,
      crossAxisSpacing: Insets.sm,
      childAspectRatio: 2.4,
      children: [
        _QuizStatCard(
          icon: LucideIcons.bookOpen,
          label: 'Được giao',
          value: '${stats.assigned}',
          description: 'Từ giảng viên',
        ),
        _QuizStatCard(
          icon: LucideIcons.clock,
          label: 'Đang làm',
          value: '${stats.inProgress}',
          description: 'Có thể tiếp tục',
        ),
        _QuizStatCard(
          icon: LucideIcons.checkCircle2,
          label: 'Đã nộp',
          value: '${stats.submitted}',
          description: 'Đã gửi chấm',
        ),
        _QuizStatCard(
          icon: LucideIcons.trophy,
          label: 'Hoạt động gần nhất',
          value: stats.latest == null
              ? '—'
              : formatRelativeTime(stats.latest!),
          description: stats.reviewed > 0
              ? '${stats.reviewed} bài đã được giảng viên duyệt'
              : 'Chưa có bài được giảng viên duyệt',
        ),
      ],
    );
  }
}

class _QuizStatCard extends StatelessWidget {
  const _QuizStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.description,
  });

  final IconData icon;
  final String label;
  final String value;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Insets.sm),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const Gap(Insets.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  description,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textTertiary,
                    fontSize: 10,
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

class _ContinueQuizAlert extends StatelessWidget {
  const _ContinueQuizAlert({required this.onContinue});
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        Insets.md,
        Insets.sm,
        Insets.sm,
        Insets.sm,
      ),
      decoration: BoxDecoration(
        color: AppColors.successBg,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.circleCheck, color: AppColors.success, size: 18),
          const Gap(Insets.sm),
          Expanded(
            child: Text(
              'Bạn có một quiz đang làm dở',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: onContinue,
            child: const Text('Tiếp tục làm'),
          ),
        ],
      ),
    );
  }
}

class _GenerateQuizTab extends StatelessWidget {
  const _GenerateQuizTab({required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        0,
        Insets.screenH,
        Insets.xxxl,
      ),
      children: [
        Text(
          'Luyện tập bằng quiz theo tài liệu môn học',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const Gap(Insets.xs),
        Text(
          'Tạo quiz tự ôn, làm quiz giảng viên giao và xem lại kết quả sau khi nộp.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const Gap(Insets.lg),
        _GenerateQuizButton(courseId: courseId),
      ],
    );
  }
}

class _QuizSessionList extends ConsumerWidget {
  const _QuizSessionList({
    required this.courseId,
    required this.historyAsync,
    required this.submittedOnly,
    required this.emptyTitle,
    required this.emptyMessage,
  });

  final String courseId;
  final AsyncValue<List<QuizSession>> historyAsync;
  final bool submittedOnly;
  final String emptyTitle;
  final String emptyMessage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return historyAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
        message: describeError(e),
        onRetry: () => ref.invalidate(studentQuizHistoryProvider(courseId)),
      ),
      data: (sessions) {
        final history = sessions
            .where((session) => session.isSubmitted == submittedOnly)
            .toList();
        if (history.isEmpty) {
          return EmptyState(title: emptyTitle, message: emptyMessage);
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () =>
              ref.refresh(studentQuizHistoryProvider(courseId).future),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              0,
              Insets.screenH,
              Insets.xxxl,
            ),
            itemCount: history.length,
            separatorBuilder: (_, __) => const Gap(Insets.sm),
            itemBuilder: (ctx, i) => _QuizHistoryCard(session: history[i])
                .animate(delay: (40 * i).clamp(0, 280).ms)
                .fadeIn(duration: Motion.base),
          ),
        );
      },
    );
  }
}

class _GenerateQuizButton extends HookConsumerWidget {
  const _GenerateQuizButton({required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    useEffect(() {
      final topic = ref.read(quizTopicHandoffProvider);
      if (topic == null || topic.trim().isEmpty) return null;
      ref.read(quizTopicHandoffProvider.notifier).state = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          _showGenerateDialog(context, ref, initialTopic: topic.trim());
        }
      });
      return null;
    }, const []);

    return Material(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(Radii.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg),
        onTap: () => _showGenerateDialog(context, ref),
        child: Container(
          padding: const EdgeInsets.symmetric(
            vertical: Insets.md,
            horizontal: Insets.lg,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.zap, color: Colors.white, size: 20),
              const Gap(Insets.sm),
              Text(
                'Tạo Quiz tự luyện',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showGenerateDialog(
    BuildContext context,
    WidgetRef ref, {
    String? initialTopic,
  }) async {
    final topicController = TextEditingController(text: initialTopic ?? '');
    final countController = TextEditingController(text: '5');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Tạo Quiz tự luyện'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: topicController,
              keyboardType: TextInputType.text,
              autocorrect: VietnameseTextInput.autocorrect,
              enableSuggestions: VietnameseTextInput.enableSuggestions,
              enableIMEPersonalizedLearning:
                  VietnameseTextInput.enableIMEPersonalizedLearning,
              textCapitalization: VietnameseTextInput.textCapitalization,
              smartDashesType: VietnameseTextInput.smartDashesType,
              smartQuotesType: VietnameseTextInput.smartQuotesType,
              decoration: InputDecoration(
                labelText: 'Chủ đề (tuỳ chọn)',
                hintText: 'VD: Arrays, OOP, SQL...',
                helperText:
                    'Để trống sẽ tạo quiz tổng hợp theo tài liệu môn học',
                filled: true,
                fillColor: AppColors.raised,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(Radii.md),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const Gap(Insets.md),
            TextField(
              controller: countController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Số câu hỏi (3-10)',
                filled: true,
                fillColor: AppColors.raised,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(Radii.md),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Huỷ'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Tạo', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;
    final count = int.tryParse(countController.text.trim()) ?? 5;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TakeQuizScreen(
          courseId: courseId,
          topic: topicController.text.trim().isEmpty
              ? null
              : topicController.text.trim(),
          questionCount: count.clamp(3, 10),
        ),
      ),
    );
    topicController.dispose();
    countController.dispose();
  }
}

class _QuizHistoryCard extends StatelessWidget {
  const _QuizHistoryCard({required this.session});
  final QuizSession session;

  @override
  Widget build(BuildContext context) {
    final isSubmitted = session.isSubmitted;
    final pct = session.percentage;

    Color scoreColor = AppColors.textSecondary;
    if (pct != null) {
      if (pct >= 80) {
        scoreColor = AppColors.success;
      } else if (pct >= 50) {
        scoreColor = AppColors.warning;
      } else {
        scoreColor = AppColors.error;
      }
    }

    return FptCard(
      onTap: isSubmitted
          ? () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => QuizReviewScreen(quizSessionId: session.id),
              ),
            )
          : null,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isSubmitted ? AppColors.successBg : AppColors.raised,
              borderRadius: BorderRadius.circular(Radii.sm),
            ),
            child: Icon(
              isSubmitted
                  ? LucideIcons.checkCircle2
                  : LucideIcons.clipboardList,
              color: isSubmitted ? AppColors.success : AppColors.textTertiary,
              size: 22,
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.topic ?? 'Quiz tự luyện',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(2),
                Text(
                  '${session.questions.length} câu'
                  '${session.createdAt != null ? ' · ${formatRelativeTime(session.createdAt!)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
          if (isSubmitted && pct != null) ...[
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${pct.round()}%',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: scoreColor,
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          QuizReviewScreen(quizSessionId: session.id),
                    ),
                  ),
                  child: const Text('Xem lại'),
                ),
              ],
            ),
          ] else if (!isSubmitted) ...[
            TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => TakeQuizScreen.fromSession(session: session),
                ),
              ),
              child: const Text('Tiếp tục'),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Assigned tab ─────────────────────────────────────────────────

class _AssignedTab extends ConsumerWidget {
  const _AssignedTab({required this.courseId, required this.assignedAsync});
  final String courseId;
  final AsyncValue<List<QuizAssignment>> assignedAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return assignedAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
        message: describeError(e),
        onRetry: () => ref.invalidate(studentQuizAssignmentsProvider(courseId)),
      ),
      data: (assignments) {
        if (assignments.isEmpty) {
          return const EmptyState(
            title: 'Chưa có quiz được giao',
            message: 'Giảng viên chưa giao quiz cho bạn.',
          );
        }
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () =>
              ref.refresh(studentQuizAssignmentsProvider(courseId).future),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              0,
              Insets.screenH,
              Insets.xxxl,
            ),
            itemCount: assignments.length,
            separatorBuilder: (_, __) => const Gap(Insets.sm),
            itemBuilder: (ctx, i) =>
                _AssignedQuizCard(
                      assignment: assignments[i],
                      courseId: courseId,
                    )
                    .animate(delay: (40 * i).clamp(0, 280).ms)
                    .fadeIn(duration: Motion.base),
          ),
        );
      },
    );
  }
}

class _AssignedQuizCard extends ConsumerWidget {
  const _AssignedQuizCard({required this.assignment, required this.courseId});
  final QuizAssignment assignment;
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FptCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TakeQuizScreen.fromAssignment(assignment: assignment),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.infoBg,
              borderRadius: BorderRadius.circular(Radii.sm),
            ),
            child: const Icon(
              LucideIcons.fileQuestion,
              color: AppColors.peacockBlue,
              size: 22,
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  assignment.title,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(2),
                Text(
                  '${assignment.questions.length} câu'
                  '${assignment.publishedAt != null ? ' · ${formatRelativeTime(assignment.publishedAt!)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            LucideIcons.chevronRight,
            size: 16,
            color: AppColors.textTertiary,
          ),
        ],
      ),
    );
  }
}

// ── Take Quiz Screen ─────────────────────────────────────────────

class TakeQuizScreen extends HookConsumerWidget {
  const TakeQuizScreen({
    super.key,
    required this.courseId,
    this.topic,
    this.suggestionText,
    this.questionCount = 5,
    this.existingSession,
    this.assignmentId,
  });

  final String courseId;
  final String? topic;
  final String? suggestionText;
  final int questionCount;
  final QuizSession? existingSession;
  final String? assignmentId;

  factory TakeQuizScreen.fromSession({required QuizSession session}) {
    return TakeQuizScreen(courseId: session.courseId, existingSession: session);
  }

  factory TakeQuizScreen.fromAssignment({required QuizAssignment assignment}) {
    return TakeQuizScreen(
      courseId: assignment.courseId,
      assignmentId: assignment.id,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quizAsync = ref.watch(activeQuizProvider);
    final answers = useState<Map<String, String>>({});
    final submitting = useState(false);

    useEffect(() {
      if (existingSession != null) {
        Future.microtask(() {
          ref.read(activeQuizProvider.notifier).loadSession(existingSession!);
        });
      } else if (assignmentId != null) {
        Future.microtask(
          () => ref
              .read(activeQuizProvider.notifier)
              .startAssigned(assignmentId: assignmentId!),
        );
      } else {
        Future.microtask(
          () => ref
              .read(activeQuizProvider.notifier)
              .generate(
                courseId: courseId,
                topic: topic,
                suggestionText: suggestionText,
                questionCount: questionCount,
              ),
        );
      }
      return () => ref.read(activeQuizProvider.notifier).reset();
    }, const []);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: topic != null ? 'Quiz: $topic' : 'Quiz tự luyện',
        actions: [
          if (quizAsync.valueOrNull != null &&
              !quizAsync.valueOrNull!.isSubmitted)
            TextButton(
              onPressed: submitting.value
                  ? null
                  : () => _submit(
                      context,
                      ref,
                      quizAsync.value!,
                      answers.value,
                      submitting,
                    ),
              child: Text(
                'Nộp',
                style: TextStyle(
                  color: submitting.value
                      ? AppColors.textDisabled
                      : AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
      body: quizAsync.when(
        loading: () => const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: AppColors.primary),
              Gap(Insets.md),
              Text('AI đang tạo quiz...'),
            ],
          ),
        ),
        error: (e, _) => ErrorState(
          message: describeError(e),
          onRetry: () => ref
              .read(activeQuizProvider.notifier)
              .generate(
                courseId: courseId,
                topic: topic,
                suggestionText: suggestionText,
                questionCount: questionCount,
              ),
        ),
        data: (session) {
          if (session == null) return const LoadingSkeleton();
          if (session.isSubmitted) return _QuizResultView(session: session);
          return _QuizQuestionsView(
            session: session,
            answers: answers.value,
            onAnswer: (qId, ans) =>
                answers.value = {...answers.value, qId: ans},
          );
        },
      ),
      bottomNavigationBar: quizAsync.whenOrNull(
        data: (session) {
          if (session == null || session.isSubmitted) return null;
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.sm,
                Insets.screenH,
                Insets.md,
              ),
              child: FptButton(
                label: submitting.value
                    ? 'Đang nộp...'
                    : 'Nộp bài (${answers.value.length}/${session.questions.length})',
                loading: submitting.value,
                expand: true,
                onPressed: submitting.value
                    ? null
                    : () => _submit(
                        context,
                        ref,
                        session,
                        answers.value,
                        submitting,
                      ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _submit(
    BuildContext context,
    WidgetRef ref,
    QuizSession session,
    Map<String, String> answers,
    ValueNotifier<bool> submitting,
  ) async {
    final total = session.questions.length;
    if (answers.length < total) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.card,
          title: const Text('Chưa trả lời hết'),
          content: Text(
            'Bạn mới trả lời ${answers.length}/$total câu. '
            'Các câu chưa chọn sẽ được tính là sai. Bạn vẫn muốn nộp?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Làm tiếp'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                'Nộp bài',
                style: TextStyle(color: AppColors.primary),
              ),
            ),
          ],
        ),
      );
      if (proceed != true || !context.mounted) return;
    }

    submitting.value = true;
    try {
      final answerList = answers.entries
          .map((e) => {'questionId': e.key, 'selectedAnswer': e.value})
          .toList();
      await ref.read(activeQuizProvider.notifier).submit(answerList);
      final courses = ref.read(coursesControllerProvider).valueOrNull ?? [];
      final routeId = resolveCourseRouteId(courses, courseId);
      ref.invalidate(studentQuizHistoryProvider(routeId));
      ref.invalidate(courseMemoryProvider(routeId));
      ref.invalidate(improvePlanControllerProvider(routeId));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(describeError(e)),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      submitting.value = false;
    }
  }
}

class _QuizQuestionsView extends StatelessWidget {
  const _QuizQuestionsView({
    required this.session,
    required this.answers,
    required this.onAnswer,
  });
  final QuizSession session;
  final Map<String, String> answers;
  final void Function(String questionId, String answer) onAnswer;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.md,
        Insets.screenH,
        120,
      ),
      itemCount: session.questions.length,
      separatorBuilder: (_, __) => const Gap(Insets.lg),
      itemBuilder: (ctx, i) => _QuestionCard(
        index: i + 1,
        question: session.questions[i],
        selectedAnswer: answers[session.questions[i].questionId],
        onAnswer: (ans) => onAnswer(session.questions[i].questionId, ans),
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.index,
    required this.question,
    required this.selectedAnswer,
    required this.onAnswer,
  });
  final int index;
  final QuizQuestion question;
  final String? selectedAnswer;
  final ValueChanged<String> onAnswer;

  @override
  Widget build(BuildContext context) {
    final options = question.displayOptions;

    return Container(
      padding: const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        boxShadow: Shadows.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Câu $index',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Gap(Insets.xs),
          Text(
            question.questionText,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
          const Gap(Insets.md),
          ...options.map(
            (opt) => _OptionTile(
              label: opt,
              selected: selectedAnswer == opt,
              onTap: () => onAnswer(opt),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.fast,
        margin: const EdgeInsets.only(bottom: Insets.sm),
        padding: const EdgeInsets.symmetric(
          horizontal: Insets.md,
          vertical: Insets.sm + 2,
        ),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryWash : AppColors.raised,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(
            color: selected ? AppColors.primary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: Motion.fast,
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? AppColors.primary : Colors.transparent,
                border: Border.all(
                  color: selected ? AppColors.primary : AppColors.borderStrong,
                  width: 2,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check, size: 13, color: Colors.white)
                  : null,
            ),
            const Gap(Insets.md),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                  color: selected
                      ? AppColors.peacockBlue
                      : AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Quiz review (history) ────────────────────────────────────────

class QuizReviewScreen extends ConsumerWidget {
  const QuizReviewScreen({super.key, required this.quizSessionId});

  final String quizSessionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final review = ref.watch(quizReviewProvider(quizSessionId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: const FptAppBar(title: 'Xem lại quiz'),
      body: review.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(quizReviewProvider(quizSessionId)),
        ),
        data: (session) {
          if (!session.isSubmitted) {
            return const EmptyState(
              title: 'Quiz chưa nộp',
              message: 'Bạn cần nộp bài trước khi xem lại đáp án.',
            );
          }
          return _QuizResultView(session: session);
        },
      ),
    );
  }
}

// ── Quiz Result View ─────────────────────────────────────────────

class _QuizResultView extends StatelessWidget {
  const _QuizResultView({required this.session});
  final QuizSession session;

  QuizQuestion? _questionFor(QuizAnswer answer) {
    for (final question in session.questions) {
      if (question.questionId == answer.questionId) return question;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final hideAnswerKey = shouldHideQuizAnswerKey(session);
    final awaitingReview = hideAnswerKey && session.quizType == 'ASSIGNED';
    final score = quizDisplayScore(session);
    final max = quizDisplayMaxScore(session);
    final pct = max > 0 ? (score / max) * 100 : (session.percentage ?? 0);
    final statusLabel = quizResultStatusLabel(session);

    Color scoreColor = AppColors.success;
    String scoreLabel = statusLabel;
    if (!awaitingReview) {
      if (pct < 50) {
        scoreColor = AppColors.error;
        scoreLabel = 'Cần ôn tập thêm';
      } else if (pct < 80) {
        scoreColor = AppColors.warning;
        scoreLabel = 'Khá tốt!';
      } else {
        scoreLabel = 'Xuất sắc!';
      }
    } else {
      scoreColor = AppColors.warning;
    }

    final reviewItems = session.answers.isNotEmpty
        ? session.answers
        : session.questions
              .map(
                (q) => QuizAnswer(
                  questionId: q.questionId,
                  selectedAnswer: null,
                  correct: null,
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation,
                ),
              )
              .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        Insets.xxxl,
      ),
      children: [
        Container(
          padding: const EdgeInsets.all(Insets.xl),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(Radii.xl),
            boxShadow: Shadows.md,
          ),
          child: Column(
            children: [
              Icon(
                pct >= 80
                    ? LucideIcons.trophy
                    : pct >= 50
                    ? LucideIcons.thumbsUp
                    : LucideIcons.bookOpen,
                size: 48,
                color: scoreColor,
              ),
              const Gap(Insets.md),
              Text(
                scoreLabel,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: scoreColor,
                ),
              ),
              const Gap(Insets.sm),
              Text(
                awaitingReview
                    ? 'Điểm đang chờ giảng viên duyệt'
                    : '$score / $max  (${pct.round()}%)',
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(color: AppColors.textSecondary),
              ),
              const Gap(Insets.xs),
              Text(
                statusLabel,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (session.teacherFeedback != null &&
                  session.teacherFeedback!.trim().isNotEmpty) ...[
                const Gap(Insets.sm),
                Text(
                  session.teacherFeedback!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              const Gap(Insets.md),
              FptButton(
                label: 'Tạo lại quiz từ chủ đề này',
                icon: LucideIcons.refreshCw,
                size: FptButtonSize.sm,
                variant: FptButtonVariant.secondary,
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => TakeQuizScreen(
                        courseId: session.courseId,
                        topic: session.topic,
                        questionCount: session.questions.length.clamp(3, 10),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        const Gap(Insets.xl),
        Text(
          hideAnswerKey ? 'Chi tiết bài làm' : 'Chi tiết',
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (hideAnswerKey) ...[
          const Gap(Insets.xs),
          Text(
            'Đáp án đúng được ẩn cho đến khi giảng viên duyệt bài.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textTertiary,
            ),
          ),
        ],
        const Gap(Insets.sm),
        if (reviewItems.isEmpty)
          const EmptyState(
            title: 'Chưa có chi tiết bài làm',
            message: 'Quiz này chưa có dữ liệu câu hỏi để xem lại.',
          ),
        if (reviewItems.isNotEmpty)
          ...reviewItems.asMap().entries.map((entry) {
          final i = entry.key;
          final ans = entry.value;
          final question = _questionFor(ans);
          final correct = ans.correct ?? false;
          final selected = ans.selectedAnswer?.trim();
          final hasSelection = selected != null && selected.isNotEmpty;

          return Container(
            margin: const EdgeInsets.only(bottom: Insets.sm),
            padding: const EdgeInsets.all(Insets.md),
            decoration: BoxDecoration(
              color: hideAnswerKey
                  ? AppColors.raised
                  : (correct ? AppColors.successBg : AppColors.errorBg),
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      hideAnswerKey
                          ? LucideIcons.circleHelp
                          : (correct
                                ? LucideIcons.checkCircle2
                                : LucideIcons.xCircle),
                      size: 16,
                      color: hideAnswerKey
                          ? AppColors.textTertiary
                          : (correct ? AppColors.success : AppColors.error),
                    ),
                    const Gap(Insets.xs),
                    Expanded(
                      child: Text(
                        question?.questionText ?? 'Câu ${i + 1}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (question != null && question.displayOptions.isNotEmpty) ...[
                  const Gap(Insets.sm),
                  ...question.displayOptions.map(
                    (option) => _QuizOptionReviewTile(
                      label: option,
                      isSelected: hasSelection && option == selected,
                      isCorrect: hideAnswerKey
                          ? false
                          : ans.correctAnswer != null &&
                                option == ans.correctAnswer,
                    ),
                  ),
                ],
                const Gap(Insets.sm),
                Text(
                  'Bạn chọn: ${hasSelection ? selected : 'Không trả lời'}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: hideAnswerKey
                        ? AppColors.textSecondary
                        : (correct ? AppColors.success : AppColors.error),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (!hideAnswerKey &&
                    !correct &&
                    ans.correctAnswer != null) ...[
                  const Gap(Insets.xs),
                  Text(
                    'Đáp án đúng: ${ans.correctAnswer}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.success,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (!hideAnswerKey &&
                    ans.explanation != null &&
                    ans.explanation!.isNotEmpty) ...[
                  const Gap(Insets.sm),
                  Text(
                    ans.explanation!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          );
        }),
      ],
    );
  }
}

class _QuizOptionReviewTile extends StatelessWidget {
  const _QuizOptionReviewTile({
    required this.label,
    required this.isSelected,
    required this.isCorrect,
  });

  final String label;
  final bool isSelected;
  final bool isCorrect;

  @override
  Widget build(BuildContext context) {
    Color borderColor = AppColors.borderHairline;
    Color bgColor = AppColors.card;
    Color textColor = AppColors.textPrimary;

    if (isCorrect) {
      borderColor = AppColors.success;
      bgColor = AppColors.successBg;
      textColor = AppColors.success;
    } else if (isSelected) {
      borderColor = AppColors.error;
      bgColor = AppColors.errorBg;
      textColor = AppColors.error;
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: Insets.xs),
      padding: const EdgeInsets.symmetric(
        horizontal: Insets.sm,
        vertical: Insets.xs,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(Radii.sm),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: textColor),
      ),
    );
  }
}
