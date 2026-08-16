import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/utils/vietnamese_text_input.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/quiz.dart';
import '../../../shared/widgets/widgets.dart';
import '../../courses/application/courses_controller.dart';
import '../../memory/application/course_memory_provider.dart';
import '../../memory/application/improve_plan_controller.dart';
import '../application/quiz_controller.dart';

// ── Student Quiz List ────────────────────────────────────────────

class StudentQuizScreen extends HookConsumerWidget {
  const StudentQuizScreen({super.key, required this.courseId});

  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = useState(0);
    final history = ref.watch(studentQuizHistoryProvider(courseId));
    final assigned = ref.watch(studentQuizAssignmentsProvider(courseId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Quiz luyện tập'),
      body: Column(
        children: [
          // ── Tab bar ─────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 0),
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.raised,
                borderRadius: BorderRadius.circular(Radii.md),
              ),
              child: Row(
                children: [
                  _Tab(label: 'Tự luyện', selected: tabIndex.value == 0, onTap: () => tabIndex.value = 0),
                  _Tab(label: 'Bài được giao', selected: tabIndex.value == 1, onTap: () => tabIndex.value = 1),
                ],
              ),
            ),
          ),
          const Gap(Insets.md),
          Expanded(
            child: tabIndex.value == 0
                ? _SelfPracticeTab(courseId: courseId, historyAsync: history)
                : _AssignedTab(courseId: courseId, assignedAsync: assigned),
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
        child: AnimatedContainer(
          duration: Motion.fast,
          margin: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: selected ? AppColors.card : Colors.transparent,
            borderRadius: BorderRadius.circular(Radii.sm),
            boxShadow: selected ? Shadows.md : null,
          ),
          alignment: Alignment.center,
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

// ── Self-practice tab ────────────────────────────────────────────

class _SelfPracticeTab extends HookConsumerWidget {
  const _SelfPracticeTab({required this.courseId, required this.historyAsync});
  final String courseId;
  final AsyncValue<List<QuizSession>> historyAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
          child: _GenerateQuizButton(courseId: courseId),
        ),
        const Gap(Insets.lg),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Lịch sử quiz',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const Gap(Insets.sm),
        Expanded(
          child: historyAsync.when(
            loading: () => const LoadingSkeleton(),
            error: (e, _) => ErrorState(
              message: describeError(e),
              onRetry: () => ref.invalidate(studentQuizHistoryProvider(courseId)),
            ),
            data: (sessions) {
              final history = sessions
                  .where(
                    (s) =>
                        s.quizType == 'SELF_PRACTICE' || s.assignmentId == null,
                  )
                  .toList();
              if (history.isEmpty) {
                return const EmptyState(
                  title: 'Chưa có quiz nào',
                  message: 'Tạo quiz tự luyện để kiểm tra kiến thức của bạn.',
                );
              }
              return RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () => ref.refresh(studentQuizHistoryProvider(courseId).future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(Insets.screenH, 0, Insets.screenH, Insets.xxxl),
                  itemCount: history.length,
                  separatorBuilder: (_, __) => const Gap(Insets.sm),
                  itemBuilder: (ctx, i) => _QuizHistoryCard(session: history[i])
                      .animate(delay: (40 * i).clamp(0, 280).ms)
                      .fadeIn(duration: Motion.base),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _GenerateQuizButton extends HookConsumerWidget {
  const _GenerateQuizButton({required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(Radii.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg),
        onTap: () => _showGenerateDialog(context, ref),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: Insets.md, horizontal: Insets.lg),
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

  Future<void> _showGenerateDialog(BuildContext context, WidgetRef ref) async {
    final topicController = TextEditingController();
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
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
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
          topic: topicController.text.trim().isEmpty ? null : topicController.text.trim(),
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
              isSubmitted ? LucideIcons.checkCircle2 : LucideIcons.clipboardList,
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
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(2),
                Text(
                  '${session.questions.length} câu'
                  '${session.createdAt != null ? ' · ${formatRelativeTime(session.createdAt!)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
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
                      builder: (_) => QuizReviewScreen(quizSessionId: session.id),
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
          onRefresh: () => ref.refresh(studentQuizAssignmentsProvider(courseId).future),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(Insets.screenH, 0, Insets.screenH, Insets.xxxl),
            itemCount: assignments.length,
            separatorBuilder: (_, __) => const Gap(Insets.sm),
            itemBuilder: (ctx, i) => _AssignedQuizCard(
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
            child: const Icon(LucideIcons.fileQuestion, color: AppColors.peacockBlue, size: 22),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  assignment.title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const Gap(2),
                Text(
                  '${assignment.questions.length} câu'
                  '${assignment.publishedAt != null ? ' · ${formatRelativeTime(assignment.publishedAt!)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textTertiary),
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
    return TakeQuizScreen(
      courseId: session.courseId,
      existingSession: session,
    );
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
        Future.microtask(() => ref.read(activeQuizProvider.notifier).startAssigned(assignmentId: assignmentId!));
      } else {
        Future.microtask(() => ref.read(activeQuizProvider.notifier).generate(
          courseId: courseId,
          topic: topic,
          suggestionText: suggestionText,
          questionCount: questionCount,
        ));
      }
      return () => ref.read(activeQuizProvider.notifier).reset();
    }, const []);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: topic != null ? 'Quiz: $topic' : 'Quiz tự luyện',
        actions: [
          if (quizAsync.valueOrNull != null && !quizAsync.valueOrNull!.isSubmitted)
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
                  color: submitting.value ? AppColors.textDisabled : AppColors.primary,
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
          onRetry: () => ref.read(activeQuizProvider.notifier).generate(
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
            onAnswer: (qId, ans) => answers.value = {...answers.value, qId: ans},
          );
        },
      ),
      bottomNavigationBar: quizAsync.whenOrNull(
        data: (session) {
          if (session == null || session.isSubmitted) return null;
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.sm, Insets.screenH, Insets.md),
              child: FptButton(
                label: submitting.value ? 'Đang nộp...' : 'Nộp bài (${answers.value.length}/${session.questions.length})',
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
              child: Text('Nộp bài', style: TextStyle(color: AppColors.primary)),
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
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    } finally {
      submitting.value = false;
    }
  }
}

class _QuizQuestionsView extends StatelessWidget {
  const _QuizQuestionsView({required this.session, required this.answers, required this.onAnswer});
  final QuizSession session;
  final Map<String, String> answers;
  final void Function(String questionId, String answer) onAnswer;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 120),
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
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
          const Gap(Insets.md),
          ...options.map((opt) => _OptionTile(
            label: opt,
            selected: selectedAnswer == opt,
            onTap: () => onAnswer(opt),
          )),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({required this.label, required this.selected, required this.onTap});
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
        padding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: Insets.sm + 2),
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
                  color: selected ? AppColors.peacockBlue : AppColors.textPrimary,
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
          if (session.answers.isEmpty) {
            return const EmptyState(
              title: 'Chưa có chi tiết bài làm',
              message: 'Quiz này chưa có dữ liệu chấm điểm để xem lại.',
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
    final pct = session.percentage ?? 0;
    final score = session.score ?? 0;
    final max = session.maxScore ?? session.questions.length;

    Color scoreColor = AppColors.success;
    String scoreLabel = 'Xuất sắc!';
    if (pct < 50) {
      scoreColor = AppColors.error;
      scoreLabel = 'Cần ôn tập thêm';
    } else if (pct < 80) {
      scoreColor = AppColors.warning;
      scoreLabel = 'Khá tốt!';
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
      padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.lg, Insets.screenH, Insets.xxxl),
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
                '$score / $max câu đúng  (${pct.round()}%)',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        const Gap(Insets.xl),
        Text(
          'Chi tiết',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const Gap(Insets.sm),
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
              color: correct ? AppColors.successBg : AppColors.errorBg,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      correct ? LucideIcons.checkCircle2 : LucideIcons.xCircle,
                      size: 16,
                      color: correct ? AppColors.success : AppColors.error,
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
                      isCorrect: ans.correctAnswer != null && option == ans.correctAnswer,
                    ),
                  ),
                ],
                if (!correct) ...[
                  const Gap(Insets.sm),
                  Text(
                    'Bạn chọn: ${hasSelection ? selected : 'Không trả lời'}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (ans.correctAnswer != null) ...[
                    const Gap(Insets.xs),
                    Text(
                      'Đáp án đúng: ${ans.correctAnswer}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ] else if (hasSelection) ...[
                  const Gap(Insets.sm),
                  Text(
                    'Bạn chọn: $selected',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.success,
                    ),
                  ),
                ],
                if (ans.explanation != null && ans.explanation!.isNotEmpty) ...[
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
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: textColor),
      ),
    );
  }
}
