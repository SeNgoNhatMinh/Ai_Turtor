import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/class_section.dart';
import '../../../shared/models/teacher_inbox.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/teacher_assignments_controller.dart';
import '../data/teacher_assignments_repository.dart';

class TeacherAssignmentsScreen extends ConsumerWidget {
  const TeacherAssignmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final classes = ref.watch(teacherAssignmentClassesProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: l10n.teacherAssignmentsTitle,
        actions: [
          IconButton(
            tooltip: l10n.teacherQuizManage,
            icon: const Icon(LucideIcons.listChecks, color: AppColors.primary),
            onPressed: () => context.push(AppRoutes.teacherQuiz),
          ),
        ],
      ),
      body: classes.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(teacherAssignmentClassesProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptyClassesTitle,
              message: l10n.emptyClassesMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(teacherAssignmentClassesProvider),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(teacherAssignmentClassesProvider.future),
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
                return _ClassAssignmentPicker(section: section)
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

class _ClassAssignmentPicker extends StatelessWidget {
  const _ClassAssignmentPicker({required this.section});

  final ClassSection section;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return FptCard(
      onTap: () => context.push(
        AppRoutes.teacherClassAssignments(section.courseId, section.id),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  section.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (section.courseName != null) ...[
                  const Gap(Insets.xs),
                  Text(
                    section.courseName!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
          Text(
            l10n.manageAssignments,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: AppColors.primary),
          ),
        ],
      ),
    );
  }
}

class TeacherClassAssignmentsScreen extends ConsumerWidget {
  const TeacherClassAssignmentsScreen({
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
    final assignments = ref.watch(
      teacherClassAssignmentsControllerProvider(params),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: l10n.classAssignmentsTitle,
        actions: [
          IconButton(
            tooltip: l10n.classSubmissionsSummary,
            icon: const Icon(LucideIcons.clipboardList, color: AppColors.splashNavy),
            onPressed: () => context.push(
              AppRoutes.teacherClassSubmissions(courseId, classId),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onOrange,
        onPressed: () => _showCreateSheet(context, ref, params),
        icon: const Icon(LucideIcons.plus),
        label: Text(l10n.createAssignment),
      ),
      body: assignments.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () =>
              ref.invalidate(teacherClassAssignmentsControllerProvider(params)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptyTeacherAssignmentsTitle,
              message: l10n.emptyTeacherAssignmentsMessage,
              ctaLabel: l10n.createAssignment,
              onCta: () => _showCreateSheet(context, ref, params),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(
              teacherClassAssignmentsControllerProvider(params).future,
            ),
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
                final item = items[index];
                return FptCard(
                      onTap: () =>
                          context.push(AppRoutes.teacherSubmissions(item.id)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                              ),
                              PopupMenuButton<String>(
                                icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textTertiary),
                                color: AppColors.card,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
                                onSelected: (action) => _handleAssignmentAction(context, ref, params, item, action),
                                itemBuilder: (_) => [
                                  PopupMenuItem(
                                    value: 'edit',
                                    child: Row(children: [
                                      const Icon(LucideIcons.pencil, size: 16),
                                      const Gap(8),
                                      Text(l10n.editAssignment),
                                    ]),
                                  ),
                                  PopupMenuItem(
                                    value: 'delete',
                                    child: Row(children: [
                                      const Icon(LucideIcons.trash2, size: 16, color: AppColors.error),
                                      const Gap(8),
                                      Text(l10n.deleteAssignment, style: const TextStyle(color: AppColors.error)),
                                    ]),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          if (item.dueAt != null) ...[
                            const Gap(Insets.sm),
                            Text(
                              formatDueCountdown(item.dueAt!),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          const Gap(Insets.md),
                          Row(
                            children: [
                              if (item.pendingGradeCount != null &&
                                  item.pendingGradeCount! > 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: Insets.md,
                                    vertical: Insets.xs,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.warningBg,
                                    borderRadius: BorderRadius.circular(
                                      Radii.full,
                                    ),
                                  ),
                                  child: Text(
                                    l10n.pendingGradeCount(
                                      item.pendingGradeCount!,
                                    ),
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(color: AppColors.warning),
                                  ),
                                ),
                              const Spacer(),
                              Text(
                                l10n.viewSubmissions,
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(color: AppColors.primary),
                              ),
                            ],
                          ),
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

  Future<void> _showCreateSheet(
    BuildContext context,
    WidgetRef ref,
    ({String courseId, String classId}) params,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (context) => _CreateAssignmentSheet(params: params),
    );
  }

  Future<void> _handleAssignmentAction(
    BuildContext context,
    WidgetRef ref,
    ({String courseId, String classId}) params,
    TeacherAssignmentItem item,
    String action,
  ) async {
    final l10n = AppLocalizations.of(context)!;
    if (action == 'edit') {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: AppColors.card,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
        ),
        builder: (_) => _EditAssignmentSheet(params: params, item: item),
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l10n.deleteAssignment),
        content: Text(l10n.deleteAssignmentConfirm(item.title)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.cancelAction)),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.deleteAssignment, style: const TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(teacherClassAssignmentsControllerProvider(params).notifier)
          .deleteAssignment(item.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}

class _EditAssignmentSheet extends HookConsumerWidget {
  const _EditAssignmentSheet({required this.params, required this.item});

  final ({String courseId, String classId}) params;
  final TeacherAssignmentItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final titleController = useTextEditingController(text: item.title);
    final descController = useTextEditingController(text: item.description ?? '');
    final dueDate = useState<DateTime?>(item.dueAt);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> pickDueDate() async {
      final now = DateTime.now();
      final picked = await showDatePicker(
        context: context,
        initialDate: dueDate.value ?? now.add(const Duration(days: 7)),
        firstDate: now,
        lastDate: now.add(const Duration(days: 365)),
      );
      if (picked != null) dueDate.value = picked;
    }

    Future<void> submit() async {
      final title = titleController.text.trim();
      if (title.isEmpty) {
        errorText.value = l10n.createAssignmentValidation;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(teacherClassAssignmentsControllerProvider(params).notifier)
            .updateAssignment(
              item.id,
              title: title,
              description: descController.text.trim(),
              dueAt: dueDate.value,
            );
        if (context.mounted) Navigator.pop(context);
      } catch (e) {
        errorText.value = describeError(e);
      } finally {
        submitting.value = false;
      }
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        MediaQuery.viewInsetsOf(context).bottom + Insets.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.editAssignment, style: Theme.of(context).textTheme.titleLarge),
          const Gap(Insets.lg),
          FptTextField(controller: titleController, label: l10n.assignmentTitleLabel),
          const Gap(Insets.md),
          FptTextField(controller: descController, label: l10n.assignmentDescLabel, maxLines: 3),
          const Gap(Insets.md),
          FptButton(
            label: dueDate.value == null ? l10n.pickDueDate : vnDateFormat.format(dueDate.value!),
            variant: FptButtonVariant.secondary,
            icon: LucideIcons.calendar,
            onPressed: pickDueDate,
          ),
          if (errorText.value != null) ...[
            const Gap(Insets.md),
            Text(errorText.value!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error)),
          ],
          const Gap(Insets.lg),
          FptButton(
            label: l10n.saveChanges,
            loading: submitting.value,
            onPressed: submitting.value ? null : submit,
          ),
        ],
      ),
    );
  }
}

class _CreateAssignmentSheet extends HookConsumerWidget {
  const _CreateAssignmentSheet({required this.params});

  final ({String courseId, String classId}) params;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final titleController = useTextEditingController();
    final descController = useTextEditingController();
    final pickedFile = useState<PlatformFile?>(null);
    final dueDate = useState<DateTime?>(null);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> pickFile() async {
      final result = await FilePicker.platform.pickFiles();
      if (result != null && result.files.isNotEmpty) {
        pickedFile.value = result.files.first;
      }
    }

    Future<void> pickDueDate() async {
      final now = DateTime.now();
      final picked = await showDatePicker(
        context: context,
        initialDate: now.add(const Duration(days: 7)),
        firstDate: now,
        lastDate: now.add(const Duration(days: 365)),
      );
      if (picked != null) dueDate.value = picked;
    }

    Future<void> submit() async {
      final title = titleController.text.trim();
      final path = pickedFile.value?.path;
      if (title.isEmpty || path == null) {
        errorText.value = l10n.createAssignmentValidation;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(teacherClassAssignmentsControllerProvider(params).notifier)
            .createAssignment(
              courseId: params.courseId,
              classId: params.classId,
              filePath: path,
              title: title,
              description: descController.text.trim().isEmpty
                  ? null
                  : descController.text.trim(),
              dueAt: dueDate.value,
            );
        if (context.mounted) Navigator.pop(context);
      } catch (error) {
        errorText.value = describeError(error);
      } finally {
        submitting.value = false;
      }
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        MediaQuery.viewInsetsOf(context).bottom + Insets.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.createAssignment,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Gap(Insets.lg),
          FptTextField(
            controller: titleController,
            label: l10n.assignmentTitleLabel,
          ),
          const Gap(Insets.md),
          FptTextField(
            controller: descController,
            label: l10n.assignmentDescLabel,
            maxLines: 3,
          ),
          const Gap(Insets.md),
          FptButton(
            label: pickedFile.value?.name ?? l10n.pickFile,
            variant: FptButtonVariant.secondary,
            icon: LucideIcons.paperclip,
            onPressed: pickFile,
          ),
          const Gap(Insets.md),
          FptButton(
            label: dueDate.value == null
                ? l10n.pickDueDate
                : vnDateFormat.format(dueDate.value!),
            variant: FptButtonVariant.secondary,
            icon: LucideIcons.calendar,
            onPressed: pickDueDate,
          ),
          if (errorText.value != null) ...[
            const Gap(Insets.md),
            Text(
              errorText.value!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.error),
            ),
          ],
          const Gap(Insets.lg),
          FptButton(
            label: l10n.createAssignment,
            loading: submitting.value,
            onPressed: submitting.value ? null : submit,
          ),
        ],
      ),
    );
  }
}

class TeacherSubmissionsScreen extends ConsumerWidget {
  const TeacherSubmissionsScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final submissions = ref.watch(
      teacherSubmissionsControllerProvider(assignmentId),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.submissionsTitle),
      body: submissions.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(
            teacherSubmissionsControllerProvider(assignmentId),
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptySubmissionsTitle,
              message: l10n.emptySubmissionsMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(
                teacherSubmissionsControllerProvider(assignmentId),
              ),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(
              teacherSubmissionsControllerProvider(assignmentId).future,
            ),
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
                final item = items[index];
                return FptCard(
                      onTap: () => context.push(
                        AppRoutes.teacherGradeSubmission(item.id),
                        extra: item,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.studentName,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                                if (item.submittedAt != null) ...[
                                  const Gap(Insets.xs),
                                  Text(
                                    vnDateTimeFormat.format(item.submittedAt!),
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          StatusPill(domain: 'submission', value: item.status),
                          if (item.score != null) ...[
                            const Gap(Insets.md),
                            Text(
                              item.score!.toStringAsFixed(1),
                              style: statStyle().copyWith(fontSize: 20),
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

class GradeSubmissionScreen extends HookConsumerWidget {
  const GradeSubmissionScreen({
    super.key,
    required this.submissionId,
    this.item,
  });

  final String submissionId;
  final SubmissionItem? item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final submission = item;
    final scoreController = useTextEditingController(
      text: submission?.score?.toString() ?? '',
    );
    final feedbackController = useTextEditingController();
    final weakTopicInput = useTextEditingController();
    final weakTopics = useState<List<String>>([]);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    useEffect(() {
      ref.read(gradeSubmissionControllerProvider.notifier).bind(submissionId);
      return null;
    }, [submissionId]);

    if (submission == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        appBar: FptAppBar(title: l10n.gradeSubmissionTitle),
        body: ErrorState(
          message: l10n.submissionNotFound,
          onRetry: () => context.pop(),
        ),
      );
    }

    Future<void> openFile() async {
      final url = ref
          .read(teacherAssignmentsRepositoryProvider)
          .submissionFileUrl(submissionId);
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }

    void addWeakTopic() {
      final value = weakTopicInput.text.trim();
      if (value.isEmpty) return;
      weakTopics.value = [...weakTopics.value, value];
      weakTopicInput.clear();
    }

    Future<void> submit() async {
      final score = double.tryParse(scoreController.text.trim());
      if (score == null) {
        errorText.value = l10n.scoreRequired;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(gradeSubmissionControllerProvider.notifier)
            .submitGrade(
              score: score,
              feedback: feedbackController.text.trim().isEmpty
                  ? null
                  : feedbackController.text.trim(),
              weakTopics: weakTopics.value.isEmpty ? null : weakTopics.value,
            );
        if (context.mounted) {
          ref.invalidate(
            teacherSubmissionsControllerProvider(submission.assignmentId),
          );
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.gradeSubmitted),
              backgroundColor: AppColors.success,
            ),
          );
          context.pop();
        }
      } catch (error) {
        errorText.value = describeError(error);
      } finally {
        submitting.value = false;
      }
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.gradeSubmissionTitle),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        children: [
          Text(
            submission.studentName,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Gap(Insets.md),
          FptButton(
            label: l10n.downloadSubmission,
            variant: FptButtonVariant.secondary,
            icon: LucideIcons.download,
            onPressed: openFile,
          ),
          const Gap(Insets.xl),
          FptTextField(
            controller: scoreController,
            label: l10n.scoreLabel,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            errorText: errorText.value,
          ),
          const Gap(Insets.md),
          FptTextField(
            controller: feedbackController,
            label: l10n.feedbackLabel,
            maxLines: 4,
          ),
          const Gap(Insets.lg),
          Text(
            l10n.weakTopicsSection,
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const Gap(Insets.sm),
          Row(
            children: [
              Expanded(
                child: FptTextField(
                  controller: weakTopicInput,
                  hint: l10n.weakTopicHint,
                  onSubmitted: (_) => addWeakTopic(),
                ),
              ),
              const Gap(Insets.sm),
              FptButton(
                label: l10n.addWeakTopic,
                size: FptButtonSize.sm,
                variant: FptButtonVariant.tonal,
                onPressed: addWeakTopic,
              ),
            ],
          ),
          if (weakTopics.value.isNotEmpty) ...[
            const Gap(Insets.md),
            Wrap(
              spacing: Insets.sm,
              runSpacing: Insets.sm,
              children: [
                for (final topic in weakTopics.value)
                  InputChip(
                    label: Text(topic),
                    onDeleted: () {
                      weakTopics.value = weakTopics.value
                          .where((t) => t != topic)
                          .toList();
                    },
                  ),
              ],
            ),
          ],
          const Gap(Insets.xl),
          FptButton(
            label: l10n.submitGrade,
            loading: submitting.value,
            onPressed: submitting.value ? null : submit,
            expand: true,
          ),
        ],
      ),
    );
  }
}

/// Tổng hợp mọi bài nộp của cả lớp thay vì phải xem theo từng bài tập.
class ClassSubmissionsScreen extends ConsumerWidget {
  const ClassSubmissionsScreen({
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
    final submissions = ref.watch(teacherClassSubmissionsControllerProvider(params));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.classSubmissionsSummary),
      body: submissions.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(teacherClassSubmissionsControllerProvider(params)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptySubmissionsTitle,
              message: l10n.emptySubmissionsMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(teacherClassSubmissionsControllerProvider(params)),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(teacherClassSubmissionsControllerProvider(params).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH, Insets.screenTop, Insets.screenH, Insets.xxxl,
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) {
                final item = items[index];
                return FptCard(
                      onTap: () => context.push(
                        AppRoutes.teacherGradeSubmission(item.id),
                        extra: item,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.studentName, style: Theme.of(context).textTheme.titleMedium),
                                if (item.submittedAt != null) ...[
                                  const Gap(Insets.xs),
                                  Text(
                                    vnDateTimeFormat.format(item.submittedAt!),
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          StatusPill(domain: 'submission', value: item.status),
                          if (item.score != null) ...[
                            const Gap(Insets.md),
                            Text(item.score!.toStringAsFixed(1), style: statStyle().copyWith(fontSize: 20)),
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
