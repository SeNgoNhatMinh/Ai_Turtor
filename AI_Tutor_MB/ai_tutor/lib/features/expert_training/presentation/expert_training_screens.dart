import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/models/expert_training.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../application/expert_training_controller.dart';
import '../data/expert_training_repository.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/authenticated_file_open.dart';
import '../../courses/data/courses_repository.dart';

class ExpertTaskBoardScreen extends HookConsumerWidget {
  const ExpertTaskBoardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(expertTasksControllerProvider);
    final courseId = ref.watch(selectedExpertCourseProvider);
    final session = ref.watch(authControllerProvider).valueOrNull;
    final tabController = useTabController(initialLength: 2);

    return Scaffold(
      appBar: FptAppBar(
        title: 'Expert Tasks V2',
        bottom: TabBar(
          controller: tabController,
          tabs: const [
            Tab(text: 'Cần làm'),
            Tab(text: 'Đã xong'),
          ],
        ),
      ),
      body: Column(
        children: [
          _CoursePickerBar(courseId: courseId),
          Expanded(
            child: tasks.when(
              loading: () => const LoadingSkeleton(),
              error: (e, _) => ErrorState(
                message: describeError(e),
                onRetry: () => ref.invalidate(expertTasksControllerProvider),
              ),
              data: (items) {
                final userId = session?.userId ?? '';
                final active = items.where((t) => t.isActive).toList()
                  ..sort(compareExpertTasks);
                final done = items.where((t) => t.isClosed).toList()
                  ..sort(compareExpertTasks);

                return TabBarView(
                  controller: tabController,
                  children: [
                    _ExpertTaskList(
                      items: active,
                      userId: userId,
                      emptyTitle: 'Không có task đang mở',
                      emptyMessage:
                          'Senior chạy Coverage Analyze để tạo task training/evaluation.',
                      onRefresh: () =>
                          ref.refresh(expertTasksControllerProvider.future),
                      onClaim: (taskId) => ref
                          .read(expertTasksControllerProvider.notifier)
                          .assignToMe(taskId),
                      onOpen: (task) {
                        if (task.canOpenContribute(userId)) {
                          context.push(AppRoutes.expertContribute(task.id), extra: task);
                          return;
                        }
                        if (task.canClaim) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Nhận task trước khi đóng góp.'),
                            ),
                          );
                          return;
                        }
                        if (task.isSubmitted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Task đang chờ Senior duyệt.'),
                            ),
                          );
                          return;
                        }
                        if (task.assigneeId.isNotEmpty &&
                            !task.isAssignedTo(userId)) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Task đã được mentor khác nhận.'),
                            ),
                          );
                        }
                      },
                    ),
                    _ExpertTaskList(
                      items: done,
                      userId: userId,
                      emptyTitle: 'Chưa có task hoàn thành',
                      emptyMessage: 'Task đã duyệt xong sẽ hiện ở đây.',
                      onRefresh: () =>
                          ref.refresh(expertTasksControllerProvider.future),
                      onClaim: (_) async {},
                      onOpen: (task) {
                        if (task.canOpenContribute(userId)) {
                          context.push(AppRoutes.expertContribute(task.id), extra: task);
                        }
                      },
                      readOnly: true,
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ExpertTaskList extends StatelessWidget {
  const _ExpertTaskList({
    required this.items,
    required this.userId,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.onRefresh,
    required this.onClaim,
    required this.onOpen,
    this.readOnly = false,
  });

  final List<ExpertTask> items;
  final String userId;
  final String emptyTitle;
  final String emptyMessage;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String taskId) onClaim;
  final void Function(ExpertTask task) onOpen;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return EmptyState(title: emptyTitle, message: emptyMessage);
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.all(Insets.screenH),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Gap(Insets.md),
        itemBuilder: (context, index) {
          return _ExpertTaskCard(
            task: items[index],
            userId: userId,
            readOnly: readOnly,
            onClaim: onClaim,
            onOpen: () => onOpen(items[index]),
          );
        },
      ),
    );
  }
}

class _ExpertTaskCard extends StatelessWidget {
  const _ExpertTaskCard({
    required this.task,
    required this.userId,
    required this.onClaim,
    required this.onOpen,
    this.readOnly = false,
  });

  final ExpertTask task;
  final String userId;
  final VoidCallback onOpen;
  final Future<void> Function(String taskId) onClaim;
  final bool readOnly;

  String _assigneeLabel() {
    if (task.assigneeId.isEmpty) return 'Chưa có người nhận';
    if (task.isAssignedTo(userId)) return 'Người nhận: Bạn';
    final short = task.assigneeId.length > 8
        ? task.assigneeId.substring(0, 8)
        : task.assigneeId;
    return 'Người nhận: $short…';
  }

  @override
  Widget build(BuildContext context) {
    final canClaim = !readOnly && task.canClaim;
    final canContribute = !readOnly && task.canOpenContribute(userId);

    return FptCard(
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  task.title.isNotEmpty ? task.title : task.chapter,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              StatusPill(domain: 'task', value: task.status),
            ],
          ),
          const Gap(Insets.xs),
          Text(
            '${task.usageLabel} • ${task.chapter}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (task.instructions.isNotEmpty) ...[
            const Gap(Insets.sm),
            Text(
              task.instructions,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          const Gap(Insets.sm),
          Text(
            _assigneeLabel(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (!readOnly) ...[
            const Gap(Insets.sm),
            Row(
              children: [
                if (canClaim)
                  FptButton(
                    label: 'Nhận task',
                    size: FptButtonSize.sm,
                    onPressed: () async {
                      await onClaim(task.id);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Đã nhận task.')),
                        );
                      }
                    },
                  )
                else if (canContribute)
                  FptButton(
                    label: 'Đóng góp',
                    size: FptButtonSize.sm,
                    onPressed: onOpen,
                  )
                else if (task.isSubmitted)
                  Text(
                    'Chờ Senior duyệt',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  )
                else if (task.isClosed)
                  Text(
                    'Đã hoàn thành',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.success,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                else if (task.assigneeId.isNotEmpty &&
                    !task.isAssignedTo(userId))
                  Text(
                    'Mentor khác đang xử lý',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const Spacer(),
                if (canContribute || task.isSubmitted || task.isClosed)
                  const Icon(LucideIcons.chevronRight, size: 18),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class ExpertContributeScreen extends HookConsumerWidget {
  const ExpertContributeScreen({super.key, required this.task});

  final ExpertTask task;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).valueOrNull;
    final userId = session?.userId ?? '';
    final question = useTextEditingController();
    final answer = useTextEditingController();
    final rubricName = useTextEditingController();
    final rubricDesc = useTextEditingController();
    final accuracy = useTextEditingController(text: '0.6');
    final groundedness = useTextEditingController(text: '0.3');
    final guidance = useTextEditingController(text: '0.1');
    final lockedUsage = task.expectedUsage ?? 'TRAINING';
    final usage = useState(lockedUsage);
    final submitting = useState(false);
    final materialExpanded = useState(true);
    final chapterMaterial = ref.watch(
      taskChapterMaterialPreviewProvider((task.courseId, task.chapter)),
    );
    final canContribute = task.canOpenContribute(userId);

    Future<void> submit() async {
      if (!canContribute) return;
      submitting.value = true;
      try {
        if (session == null) throw StateError('Chưa đăng nhập');
        final repo = ref.read(expertTrainingRepositoryProvider);
        if (task.type == 'RUBRIC') {
          final w1 = double.tryParse(accuracy.text) ?? 0;
          final w2 = double.tryParse(groundedness.text) ?? 0;
          final w3 = double.tryParse(guidance.text) ?? 0;
          if ((w1 + w2 + w3 - 1.0).abs() > 0.001) {
            throw StateError('Tổng trọng số rubric phải bằng 1.0');
          }
          await repo.submitRubric(
            courseId: task.courseId,
            chapter: task.chapter,
            name: rubricName.text.trim(),
            description: rubricDesc.text.trim(),
            criteriaWeights: {
              'accuracy': w1,
              'groundedness': w2,
              'guidance': w3,
            },
            authorId: ref.read(currentTeacherIdProvider),
            sourceTaskId: task.id,
          );
        } else {
          await repo.submitGoldQa(
            courseId: task.courseId,
            chapter: task.chapter,
            question: question.text.trim(),
            goldAnswer: answer.text.trim(),
            usage: usage.value,
            authorId: ref.read(currentTeacherIdProvider),
            sourceTaskId: task.id,
          );
        }
        ref.invalidate(expertTasksControllerProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã nộp — chờ Senior duyệt')),
          );
          context.pop();
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e))),
          );
        }
      } finally {
        submitting.value = false;
      }
    }

    if (!canContribute) {
      return Scaffold(
        appBar: FptAppBar(title: 'Đóng góp V2'),
        body: EmptyState(
          title: 'Không thể đóng góp',
          message: task.isClosed
              ? 'Task đã đóng.'
              : task.isSubmitted
              ? 'Task đang chờ Senior duyệt.'
              : task.canClaim
              ? 'Hãy nhận task trước khi soạn Gold Q&A hoặc rubric.'
              : 'Task đã được mentor khác nhận.',
        ),
      );
    }

    return Scaffold(
      appBar: FptAppBar(title: 'Đóng góp V2'),
      body: ListView(
        padding: const EdgeInsets.all(Insets.screenH),
        children: [
          Text(task.title, style: Theme.of(context).textTheme.titleMedium),
          const Gap(Insets.xs),
          Text(
            '${task.usageLabel} • ${task.chapter}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (task.instructions.isNotEmpty) ...[
            const Gap(Insets.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(Insets.md),
              decoration: BoxDecoration(
                color: AppColors.primaryWash,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                task.instructions,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
          const Gap(Insets.md),
          _TaskChapterMaterialPanel(
            preview: chapterMaterial,
            courseId: task.courseId,
            materialExpanded: materialExpanded.value,
            onToggleExpanded: () => materialExpanded.value = !materialExpanded.value,
          ),
          const Gap(Insets.lg),
          if (task.type == 'RUBRIC') ...[
            FptTextField(controller: rubricName, label: 'Tên rubric'),
            const Gap(Insets.md),
            FptTextField(controller: rubricDesc, label: 'Mô tả', maxLines: 3),
            const Gap(Insets.md),
            FptTextField(controller: accuracy, label: 'accuracy'),
            FptTextField(controller: groundedness, label: 'groundedness'),
            FptTextField(controller: guidance, label: 'guidance'),
          ] else ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: Insets.md,
                vertical: Insets.sm,
              ),
              decoration: BoxDecoration(
                color: AppColors.warm100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Usage cố định: $lockedUsage',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Gap(Insets.md),
            FptTextField(controller: question, label: 'Câu hỏi', maxLines: 3),
            const Gap(Insets.md),
            FptTextField(controller: answer, label: 'Gold answer', maxLines: 5),
          ],
          const Gap(Insets.xl),
          FptButton(
            label: submitting.value ? 'Đang gửi...' : 'Gửi qua n8n',
            onPressed: submitting.value ? null : submit,
          ),
        ],
      ),
    );
  }
}

class _TaskChapterMaterialPanel extends ConsumerWidget {
  const _TaskChapterMaterialPanel({
    required this.preview,
    required this.courseId,
    required this.materialExpanded,
    required this.onToggleExpanded,
  });

  final AsyncValue<ChapterPreviewView> preview;
  final String courseId;
  final bool materialExpanded;
  final VoidCallback onToggleExpanded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return preview.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: Insets.sm),
        child: LoadingSkeleton(),
      ),
      error: (e, _) => FptCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Không tải được tài liệu chương',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const Gap(Insets.xs),
            Text(describeError(e)),
          ],
        ),
      ),
      data: (data) => _buildContent(context, ref, data),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, ChapterPreviewView preview) {
    final showMaterial = preview.fromIndexedMaterial ||
        preview.hasMaterialContent ||
        preview.sourceMaterials.isNotEmpty;
    if (!showMaterial) {
      return FptCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tài liệu chương',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const Gap(Insets.xs),
            const Text(
              'Chapter này không map từ giáo trình đã index (có thể senior thêm thủ công). '
              'Hãy tham khảo giáo trình gốc hoặc hỏi senior.',
            ),
          ],
        ),
      );
    }

    Future<void> openPdf(String materialId) async {
      final repo = ref.read(coursesRepositoryProvider);
      await openAuthenticatedApiDownload(
        ref.read(springDioProvider),
        apiPath: repo.materialPdfApiPath(courseId, materialId),
        fileName: '$materialId.pdf',
      );
    }

    return FptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: onToggleExpanded,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Tài liệu chương (từ giáo trình)',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                Icon(
                  materialExpanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                  size: 18,
                ),
              ],
            ),
          ),
          const Gap(Insets.xs),
          Text(
            '${preview.title} • ${preview.detectedFrom} • ${preview.chunkCount} chunks • ${preview.approxChars} chars',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (preview.sourceMaterials.isNotEmpty) ...[
            const Gap(Insets.sm),
            Text('Nguồn', style: Theme.of(context).textTheme.labelLarge),
            ...preview.sourceMaterials.map(
              (material) => ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: const Icon(LucideIcons.fileText, size: 18),
                title: Text(material.title),
                subtitle: Text('${material.sourceType} • ${material.indexingStatus}'),
                trailing: material.id.isNotEmpty
                    ? TextButton(
                        onPressed: () => openPdf(material.id),
                        child: const Text('Mở PDF'),
                      )
                    : null,
              ),
            ),
          ],
          if (materialExpanded) ...[
            const Gap(Insets.sm),
            Text('Nội dung mục đã map', style: Theme.of(context).textTheme.labelLarge),
            if (preview.excerptTruncated) ...[
              const Gap(Insets.xs),
              Text(
                'Bản rút gọn (${preview.excerpt.length}/${preview.excerptTotalChars} ký tự). Mở PDF để xem đầy đủ.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
              ),
            ],
            const Gap(Insets.xs),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(Insets.md),
              decoration: BoxDecoration(
                color: AppColors.warm100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: SelectableText(
                preview.excerpt.isEmpty
                    ? 'Chưa trích được nội dung cho chương này trong giáo trình.'
                    : preview.excerpt,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class V2ExpertHubScreen extends ConsumerWidget {
  const V2ExpertHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: FptAppBar(
          title: 'Expert Co-Training V2',
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Coverage'),
              Tab(text: 'Duyệt'),
              Tab(text: 'Evaluation'),
            ],
          ),
        ),
        body: Column(
          children: [
            _CoursePickerBar(courseId: ref.watch(selectedExpertCourseProvider)),
            const Expanded(
              child: TabBarView(
                children: [
                  _V2CoverageTab(),
                  _V2ReviewTab(),
                  _V2EvalTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CoursePickerBar extends ConsumerWidget {
  const _CoursePickerBar({required this.courseId});
  final String? courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const courses = ['PRJ301', 'CSI106', 'OSG203'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.sm, Insets.screenH, 0),
      child: DropdownButtonFormField<String>(
        value: courseId ?? courses.first,
        decoration: const InputDecoration(labelText: 'Môn học'),
        items: courses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
        onChanged: (v) => ref.read(selectedExpertCourseProvider.notifier).state = v,
      ),
    );
  }
}

class _V2CoverageTab extends HookConsumerWidget {
  const _V2CoverageTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gaps = ref.watch(v2CoverageControllerProvider);
    final suggested = ref.watch(v2SuggestedChaptersProvider);
    final selectedKeys = useState<Set<String>>({});
    final courseId = ref.watch(selectedExpertCourseProvider);

    useEffect(() {
      selectedKeys.value = {};
      return null;
    }, [courseId]);

    useEffect(() {
      suggested.whenData((items) {
        final confirmed = items.where((c) => c.isConfirmed).map((c) => c.chapterKey).toSet();
        if (confirmed.isNotEmpty) {
          selectedKeys.value = confirmed;
        } else if (selectedKeys.value.isEmpty && items.isNotEmpty) {
          selectedKeys.value = items.map((c) => c.chapterKey).toSet();
        }
      });
      return null;
    }, [suggested]);

    Widget materialHealthBadge(String health) {
      final label = switch (health.toUpperCase()) {
        'MATERIAL_OK' => 'Material OK',
        'MATERIAL_THIN' => 'Material mỏng',
        'NO_MATERIAL' => 'Chưa có material',
        _ => health.isEmpty ? 'Unknown' : health,
      };
      return StatusPill(domain: 'gap', value: label);
    }

    return gaps.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(message: describeError(e), onRetry: () => ref.invalidate(v2CoverageControllerProvider)),
      data: (items) => ListView(
        padding: const EdgeInsets.all(Insets.screenH),
        children: [
          Text(
            'Chapters gợi ý từ giáo trình đã index',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Gap(Insets.xs),
          Text(
            'Chapters gợi ý từ mục lục PDF (bookmark) hoặc tên tài liệu nếu PDF không có bookmark.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Gap(Insets.sm),
          FptButton(
            label: 'Thêm chapter thủ công',
            variant: FptButtonVariant.secondary,
            onPressed: () async {
              final titleController = TextEditingController();
              final title = await showDialog<String>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Thêm chapter thiếu'),
                  content: TextField(
                    controller: titleController,
                    decoration: const InputDecoration(
                      labelText: 'Tên chapter',
                      hintText: 'VD: Servlet Filter & Listener',
                    ),
                    autofocus: true,
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Huỷ')),
                    FilledButton(
                      onPressed: () => Navigator.pop(ctx, titleController.text.trim()),
                      child: const Text('Thêm'),
                    ),
                  ],
                ),
              );
              if (title == null || title.isEmpty || !context.mounted) return;
              await ref.read(v2SuggestedChaptersProvider.notifier).addManual(title);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Đã thêm chapter "$title"')),
                );
              }
            },
          ),
          const Gap(Insets.sm),
          suggested.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: Insets.md),
              child: LoadingSkeleton(),
            ),
            error: (e, _) => ErrorState(
              message: '${describeError(e)}\n\nNếu lỗi 403: hãy rebuild/restart container ai-tutor-api để nạp API chapters mới.',
              onRetry: () => ref.invalidate(v2SuggestedChaptersProvider),
            ),
            data: (chapters) {
              if (chapters.isEmpty) {
                return const EmptyState(
                  title: 'Chưa có chapter gợi ý',
                  message: 'Upload và index giáo trình trước, sau đó refresh tab này.',
                );
              }
              return Column(
                children: [
                  ...chapters.map(
                    (chapter) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Checkbox(
                        value: selectedKeys.value.contains(chapter.chapterKey),
                        onChanged: (checked) {
                          final next = Set<String>.from(selectedKeys.value);
                          if (checked == true) {
                            next.add(chapter.chapterKey);
                          } else {
                            next.remove(chapter.chapterKey);
                          }
                          selectedKeys.value = next;
                        },
                      ),
                      title: Padding(
                        padding: EdgeInsets.only(left: (chapter.tocLevel * 16).toDouble()),
                        child: Text(chapter.title),
                      ),
                      subtitle: Text(
                        '${chapter.detectedFrom.isEmpty ? 'AUTO' : chapter.detectedFrom} • '
                        '${chapter.chunkCount} chunks • ${chapter.approxChars} chars'
                        '${chapter.pageStart > 0 ? ' • p.${chapter.pageStart}-${chapter.pageEnd > 0 ? chapter.pageEnd : '?'}' : ''} • '
                        'Gold T/E: ${chapter.trainingGoldCount}/${chapter.evaluationGoldCount}',
                      ),
                      trailing: materialHealthBadge(chapter.materialHealth),
                      onTap: () async {
                        final preview = await ref
                            .read(v2SuggestedChaptersProvider.notifier)
                            .preview(chapter.chapterKey, expanded: true);
                        if (!context.mounted) return;
                        await showModalBottomSheet<void>(
                          context: context,
                          isScrollControlled: true,
                          builder: (ctx) => DraggableScrollableSheet(
                            expand: false,
                            initialChildSize: 0.72,
                            minChildSize: 0.4,
                            maxChildSize: 0.95,
                            builder: (_, scrollController) => Padding(
                              padding: const EdgeInsets.all(Insets.screenH),
                              child: ListView(
                                controller: scrollController,
                                children: [
                                  Text(preview.title, style: Theme.of(ctx).textTheme.titleLarge),
                                  const Gap(Insets.sm),
                                  materialHealthBadge(preview.materialHealth),
                                  Text('Nguồn: ${preview.detectedFrom} • ${preview.chunkCount} chunks'),
                                  if (preview.sourceMaterials.isNotEmpty) ...[
                                    const Gap(Insets.sm),
                                    Text('Tài liệu nguồn', style: Theme.of(ctx).textTheme.titleSmall),
                                    ...preview.sourceMaterials.map(
                                      (m) => ListTile(
                                        dense: true,
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(m.title),
                                        subtitle: Text('${m.sourceType} • ${m.indexingStatus}'),
                                      ),
                                    ),
                                  ],
                                  const Gap(Insets.md),
                                  Text('Nội dung mục đã map', style: Theme.of(ctx).textTheme.titleSmall),
                                  if (preview.excerptTruncated) ...[
                                    const Gap(Insets.xs),
                                    Text(
                                      'Đang hiển thị bản rút gọn (${preview.excerpt.length}/${preview.excerptTotalChars} ký tự). '
                                      'Mở PDF để xem đầy đủ.',
                                      style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                                            color: AppColors.textTertiary,
                                          ),
                                    ),
                                  ],
                                  const Gap(Insets.xs),
                                  SelectableText(
                                    preview.excerpt.isEmpty
                                        ? 'Chưa trích được nội dung cho chapter này. Xem tài liệu gốc trong mục Import/Academic.'
                                        : preview.excerpt,
                                  ),
                                  if (preview.sourceMaterials.isNotEmpty && courseId != null) ...[
                                    const Gap(Insets.sm),
                                    ...preview.sourceMaterials.where((m) => m.id.isNotEmpty).map(
                                          (m) => FptButton(
                                            label: 'Mở PDF — ${m.title}',
                                            variant: FptButtonVariant.secondary,
                                            size: FptButtonSize.sm,
                                            icon: LucideIcons.externalLink,
                                            onPressed: () async {
                                              final repo = ref.read(
                                                coursesRepositoryProvider,
                                              );
                                              await openAuthenticatedApiDownload(
                                                ref.read(springDioProvider),
                                                apiPath: repo.materialPdfApiPath(
                                                  courseId!,
                                                  m.id,
                                                ),
                                                fileName: '${m.id}.pdf',
                                              );
                                            },
                                          ),
                                        ),
                                  ],
                                  const Gap(Insets.lg),
                                  FptButton(
                                    label: 'Tạo task Gold Q&A cho chapter này',
                                    onPressed: () async {
                                      Navigator.pop(ctx);
                                      await ref
                                          .read(v2CoverageControllerProvider.notifier)
                                          .createTasksForChapter(chapter.title);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Đã tạo task cho ${chapter.title}')),
                                        );
                                      }
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const Gap(Insets.sm),
                  Row(
                    children: [
                      Expanded(
                        child: FptButton(
                          label: 'Xác nhận chapters',
                          variant: FptButtonVariant.secondary,
                          onPressed: selectedKeys.value.isEmpty
                              ? null
                              : () async {
                                  await ref
                                      .read(v2SuggestedChaptersProvider.notifier)
                                      .confirm(selectedKeys.value.toList());
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Đã xác nhận chapters cho V2')),
                                    );
                                  }
                                },
                        ),
                      ),
                      const Gap(Insets.sm),
                      IconButton(
                        tooltip: 'Refresh gợi ý',
                        onPressed: () => ref.invalidate(v2SuggestedChaptersProvider),
                        icon: const Icon(LucideIcons.refreshCw),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          const Gap(Insets.lg),
          FptButton(
            label: 'Phân tích Coverage (smart policy)',
            onPressed: () async {
              final confirmedTitles = suggested.maybeWhen(
                data: (chapters) => chapters
                    .where((c) => selectedKeys.value.contains(c.chapterKey))
                    .map((c) => c.title)
                    .toList(),
                orElse: () => <String>[],
              );
              await ref.read(v2CoverageControllerProvider.notifier).analyze(
                    confirmedChapterTitles: confirmedTitles.isEmpty ? null : confirmedTitles,
                  );
            },
          ),
          const Gap(Insets.lg),
          ...items.map(
            (g) => Padding(
              padding: const EdgeInsets.only(bottom: Insets.md),
              child: FptCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(g.chapter, style: Theme.of(context).textTheme.titleMedium),
                    Text('Training: ${g.trainingGoldCount} • Eval: ${g.evaluationGoldCount}'),
                    if (g.materialHealth.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: Insets.xs),
                        child: materialHealthBadge(g.materialHealth),
                      ),
                    if (g.chunkCount > 0)
                      Text('Material: ${g.chunkCount} chunks • ${g.approxChars} chars'),
                    ...g.reasons.map((r) => Text('• $r')),
                    StatusPill(domain: 'gap', value: g.severity),
                    StatusPill(domain: 'task', value: g.status),
                    if (g.status.toUpperCase() != 'TASK_CREATED') ...[
                      const Gap(Insets.sm),
                      FptButton(
                        label: 'Tạo task Gold Q&A (senior)',
                        variant: FptButtonVariant.secondary,
                        onPressed: () async {
                          await ref
                              .read(v2CoverageControllerProvider.notifier)
                              .createTasksForChapter(g.chapter);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Đã tạo task cho ${g.chapter}')),
                            );
                          }
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _V2ReviewTab extends HookConsumerWidget {
  const _V2ReviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final review = ref.watch(v2ReviewControllerProvider);
    final note = useTextEditingController(text: 'Đã đối chiếu với giáo trình.');

    return review.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(message: describeError(e), onRetry: () => ref.invalidate(v2ReviewControllerProvider)),
      data: (data) {
        if (data.totalPending == 0) {
          return const EmptyState(title: 'Không có mục chờ duyệt', message: 'Teacher nộp Gold Q&A hoặc Rubric trước.');
        }
        return ListView(
          padding: const EdgeInsets.all(Insets.screenH),
          children: [
            for (final item in data.goldQa)
              FptCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Gold Q&A • ${item.usage}', style: Theme.of(context).textTheme.titleSmall),
                    Text(item.question),
                    const Gap(Insets.sm),
                    FptButton(
                      label: 'Duyệt Gold Q&A',
                      onPressed: () => ref.read(v2ReviewControllerProvider.notifier).approveGoldQa(item.id, note.text),
                    ),
                  ],
                ),
              ),
            for (final item in data.rubrics)
              FptCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Rubric • ${item.name}', style: Theme.of(context).textTheme.titleSmall),
                    const Gap(Insets.sm),
                    FptButton(
                      label: 'Duyệt Rubric',
                      onPressed: () => ref.read(v2ReviewControllerProvider.notifier).approveRubric(item.id, note.text),
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _V2EvalTab extends HookConsumerWidget {
  const _V2EvalTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chapter = useTextEditingController(text: 'Spring Boot Basics');
    final runs = ref.watch(v2EvalControllerProvider);

    return runs.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(message: describeError(e), onRetry: () => ref.invalidate(v2EvalControllerProvider)),
      data: (items) => ListView(
        padding: const EdgeInsets.all(Insets.screenH),
        children: [
          FptTextField(controller: chapter, label: 'Chapter'),
          const Gap(Insets.md),
          FptButton(
            label: 'Chạy Evaluation (n8n)',
            onPressed: () => ref.read(v2EvalControllerProvider.notifier).runEval(chapter.text.trim()),
          ),
          const Gap(Insets.lg),
          ...items.map(
            (r) => FptCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${r.chapter} • ${r.status}',
                      style: Theme.of(context).textTheme.titleMedium),
                  Text('Score: ${r.averageScore.toStringAsFixed(2)} • '
                      'Passed ${r.passedCases}/${r.totalCases} • '
                      'Hallucination ${r.hallucinationRate.toStringAsFixed(2)}'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
