import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/quiz.dart';
import '../../../shared/widgets/widgets.dart';
import '../../classes/application/teacher_classes_controller.dart';
import '../../../shared/models/class_section.dart';
import '../application/quiz_controller.dart';

class TeacherQuizScreen extends ConsumerWidget {
  const TeacherQuizScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(teacherQuizAssignmentsProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: 'Quiz Assignment',
        actions: [
          IconButton(
            tooltip: 'Xem lại điểm AI chấm',
            icon: const Icon(LucideIcons.shieldCheck, color: AppColors.splashNavy),
            onPressed: () => _showReviewSheet(context, ref),
          ),
          IconButton(
            icon: const Icon(LucideIcons.plus, color: AppColors.splashNavy),
            onPressed: () => _showGenerateSheet(context, ref),
          ),
        ],
      ),
      body: assignmentsAsync.when(
        loading: () => const LoadingSkeleton(),
        error: (e, _) => ErrorState(
          message: describeError(e),
          onRetry: () => ref.invalidate(teacherQuizAssignmentsProvider),
        ),
        data: (assignments) {
          if (assignments.isEmpty) {
            return EmptyState(
              title: 'Chưa có quiz nào',
              message: 'Tạo quiz assignment để giao cho học viên.',
              ctaLabel: 'Tạo quiz',
              onCta: () => _showGenerateSheet(context, ref),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(teacherQuizAssignmentsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH, Insets.screenTop, Insets.screenH, Insets.xxxl,
              ),
              itemCount: assignments.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (ctx, i) => _QuizAssignmentCard(
                assignment: assignments[i],
              ).animate(delay: (40 * i).clamp(0, 280).ms).fadeIn(duration: Motion.base),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showGenerateSheet(context, ref),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Tạo Quiz', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Future<void> _showGenerateSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (_) => _GenerateQuizSheet(ref: ref),
    );
  }

  Future<void> _showReviewSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (_) => const _ReviewQuizSheet(),
    );
  }
}

// ── Teacher review: xem lại/ghi đè điểm AI chấm cho 1 quiz session ──

class _ReviewQuizSheet extends HookConsumerWidget {
  const _ReviewQuizSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionIdCtrl = useTextEditingController();
    final scoreCtrl = useTextEditingController();
    final feedbackCtrl = useTextEditingController();
    final reviewState = ref.watch(teacherQuizReviewProvider);
    final submitting = useState(false);
    final error = useState<String?>(null);

    useEffect(() {
      return () => ref.read(teacherQuizReviewProvider.notifier).reset();
    }, const []);

    final session = reviewState.valueOrNull;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        Insets.screenH, Insets.lg, Insets.screenH,
        MediaQuery.viewInsetsOf(context).bottom + Insets.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Xem lại điểm AI chấm', style: Theme.of(context).textTheme.titleLarge),
            const Gap(Insets.sm),
            Text(
              'Nhập mã phiên quiz (quiz session ID) của học viên để xem chi tiết và ghi đè điểm nếu cần.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
            ),
            const Gap(Insets.lg),
            Row(
              children: [
                Expanded(
                  child: FptTextField(controller: sessionIdCtrl, label: 'Quiz Session ID'),
                ),
                const Gap(Insets.sm),
                FptButton(
                  label: 'Tải',
                  size: FptButtonSize.sm,
                  loading: reviewState.isLoading,
                  onPressed: reviewState.isLoading
                      ? null
                      : () {
                          final id = sessionIdCtrl.text.trim();
                          if (id.isEmpty) return;
                          ref.read(teacherQuizReviewProvider.notifier).loadSession(id);
                        },
                ),
              ],
            ),
            if (reviewState.hasError) ...[
              const Gap(Insets.sm),
              Text(describeError(reviewState.error!), style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            if (session != null) ...[
              const Gap(Insets.lg),
              FptCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      session.topic ?? 'Quiz',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const Gap(Insets.xs),
                    Text(
                      'Học viên: ${session.studentId} · ${session.questions.length} câu hỏi',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                    ),
                    const Gap(Insets.sm),
                    Row(
                      children: [
                        const Icon(LucideIcons.award, size: 16, color: AppColors.primary),
                        const Gap(4),
                        Text(
                          'Điểm AI: ${session.score ?? '-'}/${session.maxScore ?? '-'}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        if (session.teacherReviewedScore != null) ...[
                          const Gap(Insets.md),
                          Text(
                            'Đã review: ${session.teacherReviewedScore}',
                            style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const Gap(Insets.lg),
              FptTextField(
                controller: scoreCtrl,
                label: 'Điểm ghi đè (tuỳ chọn)',
                keyboardType: TextInputType.number,
              ),
              const Gap(Insets.md),
              FptTextField(
                controller: feedbackCtrl,
                label: 'Nhận xét cho học viên',
                maxLines: 3,
              ),
              if (error.value != null) ...[
                const Gap(Insets.sm),
                Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
              ],
              const Gap(Insets.lg),
              FptButton(
                label: 'Lưu review',
                loading: submitting.value,
                expand: true,
                onPressed: submitting.value
                    ? null
                    : () async {
                        submitting.value = true;
                        error.value = null;
                        try {
                          await ref.read(teacherQuizReviewProvider.notifier).submitReview(
                                quizSessionId: session.id,
                                reviewedScore: int.tryParse(scoreCtrl.text.trim()),
                                feedback: feedbackCtrl.text.trim().isEmpty ? null : feedbackCtrl.text.trim(),
                              );
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Đã lưu review'), backgroundColor: AppColors.success),
                            );
                          }
                        } catch (e) {
                          error.value = describeError(e);
                        } finally {
                          submitting.value = false;
                        }
                      },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Quiz assignment card ──────────────────────────────────────────

class _QuizAssignmentCard extends HookConsumerWidget {
  const _QuizAssignmentCard({required this.assignment});
  final QuizAssignment assignment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Color statusColor;
    Color statusBg;
    String statusLabel;

    switch (assignment.status) {
      case 'PUBLISHED':
        statusColor = AppColors.success;
        statusBg = AppColors.successBg;
        statusLabel = 'Đã phát hành';
      case 'CLOSED':
        statusColor = AppColors.textTertiary;
        statusBg = AppColors.raised;
        statusLabel = 'Đã đóng';
      default:
        statusColor = AppColors.warning;
        statusBg = AppColors.warningBg;
        statusLabel = 'Nháp';
    }

    return FptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  assignment.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  statusLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
          if (assignment.topic != null) ...[
            const Gap(Insets.xs),
            Text(
              assignment.topic!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const Gap(Insets.sm),
          Row(
            children: [
              const Icon(LucideIcons.helpCircle, size: 14, color: AppColors.textTertiary),
              const Gap(4),
              Text(
                '${assignment.questions.length} câu hỏi',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
              ),
              if (assignment.createdAt != null) ...[
                const Gap(Insets.sm),
                Text('·', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary)),
                const Gap(Insets.sm),
                Text(
                  formatRelativeTime(assignment.createdAt!),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ],
          ),
          if (assignment.isDraft) ...[
            const Gap(Insets.md),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _confirmDelete(context, ref),
                    icon: const Icon(LucideIcons.trash2, size: 14),
                    label: const Text('Xoá'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                    ),
                  ),
                ),
                const Gap(Insets.sm),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _confirmPublish(context, ref),
                    icon: const Icon(LucideIcons.send, size: 14),
                    label: const Text('Phát hành'),
                    style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmPublish(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Phát hành Quiz'),
        content: const Text('Giao quiz này cho toàn bộ lớp?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Phát hành'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(teacherQuizAssignmentsProvider.notifier).publish(
        assignmentId: assignment.id,
        targetType: 'CLASS',
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã phát hành quiz'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Xoá Quiz'),
        content: const Text('Bạn có chắc muốn xoá quiz này không?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(teacherQuizAssignmentsProvider.notifier).delete(assignment.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}

// ── Generate quiz bottom sheet ────────────────────────────────────

class _GenerateQuizSheet extends HookConsumerWidget {
  const _GenerateQuizSheet({required this.ref});
  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef widgetRef) {
    final titleController = useTextEditingController();
    final topicController = useTextEditingController();
    final countController = useTextEditingController(text: '5');
    final selectedClassKey = useState<String?>(null);
    final generating = useState(false);
    final errorText = useState<String?>(null);

    final classesAsync = widgetRef.watch(teacherClassesControllerProvider);
    final sections = classesAsync.valueOrNull ?? [];

    String classKey(ClassSection s) => '${s.courseId}::${s.id}';

    ClassSection? selectedSection() {
      final key = selectedClassKey.value;
      if (key == null) return null;
      for (final s in sections) {
        if (classKey(s) == key) return s;
      }
      return null;
    }

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: Insets.lg),
                decoration: BoxDecoration(
                  color: AppColors.borderStrong,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
              ),
            ),
            Text('Tạo Quiz Assignment', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const Gap(Insets.sm),
            Text(
              'Quiz được tạo từ tài liệu môn + lớp đã chọn (RAG lọc theo classId).',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
            ),
            const Gap(Insets.lg),
            if (sections.isNotEmpty) ...[
              Text('Lớp phụ trách', style: Theme.of(context).textTheme.labelMedium),
              const Gap(Insets.xs),
              DropdownButtonFormField<String>(
                initialValue: selectedClassKey.value,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: Insets.sm),
                ),
                hint: const Text('Chọn lớp'),
                items: sections
                    .map(
                      (s) => DropdownMenuItem(
                        value: classKey(s),
                        child: Text(
                          '${s.courseCode ?? s.courseId} — ${s.name}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => selectedClassKey.value = v,
              ),
              const Gap(Insets.md),
            ] else if (classesAsync.hasValue) ...[
              Text(
                'Bạn chưa được gán lớp nào. Quiz cần classId để lấy đúng tài liệu lớp.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.warning),
              ),
              const Gap(Insets.md),
            ],
            FptTextField(controller: titleController, label: 'Tiêu đề quiz'),
            const Gap(Insets.md),
            FptTextField(
              controller: topicController,
              label: 'Chủ đề / nội dung (tuỳ chọn)',
              hint: 'VD: Linked List, SQL JOIN...',
            ),
            const Gap(Insets.md),
            FptTextField(
              controller: countController,
              label: 'Số câu hỏi (3-10)',
              keyboardType: TextInputType.number,
            ),
            if (errorText.value != null) ...[
              const Gap(Insets.md),
              Text(errorText.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const Gap(Insets.xl),
            FptButton(
              label: generating.value ? 'AI đang tạo quiz...' : 'Tạo Quiz',
              loading: generating.value,
              expand: true,
              onPressed: generating.value
                  ? null
                  : () => _generate(
                      context,
                      widgetRef,
                      titleController,
                      topicController,
                      countController,
                      selectedSection(),
                      generating,
                      errorText,
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _generate(
    BuildContext context,
    WidgetRef ref,
    TextEditingController titleCtrl,
    TextEditingController topicCtrl,
    TextEditingController countCtrl,
    ClassSection? section,
    ValueNotifier<bool> generating,
    ValueNotifier<String?> errorText,
  ) async {
    final title = titleCtrl.text.trim();
    if (title.isEmpty) {
      errorText.value = 'Vui lòng nhập tiêu đề';
      return;
    }
    if (section == null) {
      errorText.value = 'Vui lòng chọn lớp phụ trách';
      return;
    }
    generating.value = true;
    errorText.value = null;
    try {
      final count = int.tryParse(countCtrl.text.trim()) ?? 5;
      await ref.read(teacherQuizAssignmentsProvider.notifier).generate(
        courseId: section.courseId,
        classId: section.id,
        title: title,
        topic: topicCtrl.text.trim().isEmpty ? null : topicCtrl.text.trim(),
        questionCount: count.clamp(3, 10),
      );
      if (context.mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Quiz đã được tạo — kiểm tra trước khi phát hành'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      errorText.value = describeError(e);
    } finally {
      generating.value = false;
    }
  }
}
