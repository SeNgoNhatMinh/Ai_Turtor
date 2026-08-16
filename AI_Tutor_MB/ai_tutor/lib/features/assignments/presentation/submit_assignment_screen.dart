import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/assignment.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/assignments_controller.dart';

class SubmitAssignmentScreen extends HookConsumerWidget {
  const SubmitAssignmentScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final noteController = useTextEditingController();
    final pickedFile = useState<PlatformFile?>(null);
    final submitting = useState(false);
    final data = ref.watch(assignmentsControllerProvider);

    return data.when(
      loading: () => Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          title: Text(l10n.submitAssignmentTitle),
        ),
        body: const LoadingSkeleton(itemCount: 3),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: Text(l10n.submitAssignmentTitle)),
        body: ErrorState(message: describeError(error)),
      ),
      data: (payload) {
        Assignment? assignment;
        for (final item in payload.assignments.map(payload.enriched)) {
          if (item.id == assignmentId) {
            assignment = item;
            break;
          }
        }
        if (assignment == null) {
          return Scaffold(
            appBar: AppBar(title: Text(l10n.submitAssignmentTitle)),
            body: ErrorState(
              message: l10n.assignmentNotFound,
              onRetry: () => context.pop(),
            ),
          );
        }

        final resolved = assignment;
        final dueLabel = resolved.dueAt == null
            ? null
            : formatDueCountdown(resolved.dueAt!);

        return Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            leading: IconButton(
              onPressed: () => context.pop(),
              icon: const Icon(Icons.chevron_left),
            ),
            title: Text(
              l10n.submitAssignmentTitle,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.splashNavy,
              ),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              Insets.md,
              Insets.screenH,
              Insets.xxxl,
            ),
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(Insets.lg),
                decoration: BoxDecoration(
                  color: AppColors.primaryWash,
                  borderRadius: BorderRadius.circular(Radii.lg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${resolved.courseCode ?? '—'} · ${resolved.title}',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Gap(Insets.sm),
                    Text(
                      resolved.title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.splashNavy,
                      ),
                    ),
                    if (dueLabel != null) ...[
                      const Gap(Insets.sm),
                      Row(
                        children: [
                          const Icon(
                            Icons.schedule,
                            size: 16,
                            color: AppColors.error,
                          ),
                          const Gap(Insets.xs),
                          Text(
                            l10n.submitDeadlineLabel(dueLabel),
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: AppColors.error,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const Gap(Insets.xl),
              Text(
                l10n.submitFileLabel,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.splashNavy,
                ),
              ),
              const Gap(Insets.md),
              Material(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(Radii.lg),
                child: InkWell(
                  onTap: () async {
                    final result = await FilePicker.platform.pickFiles();
                    if (result != null && result.files.isNotEmpty) {
                      pickedFile.value = result.files.first;
                    }
                  },
                  borderRadius: BorderRadius.circular(Radii.lg),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(Insets.xl),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.lg),
                      border: Border.all(
                        color: AppColors.borderStrong,
                        style: BorderStyle.solid,
                      ),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.upload_file_rounded,
                          color: AppColors.primary,
                          size: 32,
                        ),
                        const Gap(Insets.sm),
                        Text(
                          l10n.submitPickFile,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const Gap(Insets.xs),
                        Text(
                          l10n.submitFileTypes,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: AppColors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (pickedFile.value != null) ...[
                const Gap(Insets.md),
                _AttachedFileTile(
                  fileName: pickedFile.value!.name,
                  sizeLabel: formatFileSize(pickedFile.value!.size),
                  onRemove: () => pickedFile.value = null,
                ),
              ],
              const Gap(Insets.xl),
              Text(
                l10n.submitNoteLabel,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.splashNavy,
                ),
              ),
              const Gap(Insets.md),
              TextField(
                controller: noteController,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: l10n.submitNoteHint,
                  filled: true,
                  fillColor: AppColors.card,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.lg),
                    borderSide: const BorderSide(color: AppColors.borderHairline),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.lg),
                    borderSide: const BorderSide(color: AppColors.borderHairline),
                  ),
                ),
              ),
              const Gap(Insets.xl),
              FptButton(
                label: l10n.submitConfirm,
                expand: true,
                loading: submitting.value,
                onPressed: pickedFile.value?.path == null
                    ? null
                    : () async {
                        submitting.value = true;
                        try {
                          await ref
                              .read(assignmentsControllerProvider.notifier)
                              .submit(
                                assignmentId: resolved.id,
                                filePath: pickedFile.value!.path!,
                                fileName: pickedFile.value!.name,
                                note: noteController.text.trim().isEmpty
                                    ? null
                                    : noteController.text.trim(),
                              );
                          if (context.mounted) context.pop();
                        } finally {
                          submitting.value = false;
                        }
                      },
              ),
              const Gap(Insets.md),
              Text(
                l10n.submitResubmitHint,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _AttachedFileTile extends StatelessWidget {
  const _AttachedFileTile({
    required this.fileName,
    required this.sizeLabel,
    required this.onRemove,
  });

  final String fileName;
  final String? sizeLabel;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final ext = fileName.split('.').last.toUpperCase();
    return Container(
      padding: const EdgeInsets.all(Insets.md),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.successBg,
              borderRadius: BorderRadius.circular(Radii.sm),
            ),
            child: Text(
              ext.length > 4 ? ext.substring(0, 4) : ext,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppColors.success,
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
                  fileName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  sizeLabel == null
                      ? l10n.submitAttached
                      : '$sizeLabel · ${l10n.submitAttached}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.close, color: AppColors.textTertiary),
          ),
        ],
      ),
    );
  }
}
