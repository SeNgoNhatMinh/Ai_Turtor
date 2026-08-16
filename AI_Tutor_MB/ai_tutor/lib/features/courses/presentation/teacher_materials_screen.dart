import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/authenticated_file_open.dart';
import '../../../core/utils/material_upload.dart';
import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/course_material.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/teacher_materials_controller.dart';
import '../data/courses_repository.dart';

enum _ImportUrlStep { enterUrl, selectPages }

class TeacherMaterialsScreen extends ConsumerWidget {
  const TeacherMaterialsScreen({
    super.key,
    required this.courseId,
    required this.classId,
  });

  final String courseId;
  final String classId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final scope = (courseId: courseId, classId: classId);
    final materials = ref.watch(teacherMaterialsControllerProvider(scope));

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(
        title: l10n.teacherMaterialsTitle,
        actions: [
          IconButton(
            tooltip: l10n.importFromUrl,
            icon: const Icon(LucideIcons.link, color: AppColors.splashNavy),
            onPressed: () => _showImportUrlSheet(context, scope),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onOrange,
        onPressed: () => _showUploadSheet(context, scope),
        icon: const Icon(LucideIcons.upload),
        label: Text(l10n.uploadMaterial),
      ),
      body: materials.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () =>
              ref.invalidate(teacherMaterialsControllerProvider(scope)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptyTeacherMaterialsTitle,
              message: l10n.emptyTeacherMaterialsMessage,
              ctaLabel: l10n.uploadMaterial,
              onCta: () => _showUploadSheet(context, scope),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(teacherMaterialsControllerProvider(scope).future),
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
                return _MaterialCard(scope: scope, material: item)
                    .animate(delay: (40 * index).clamp(0, 320).ms)
                    .fadeIn(duration: Motion.base);
              },
            ),
          );
        },
      ),
    );
  }

  void _showUploadSheet(BuildContext context, MaterialScope scope) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (_) => _UploadMaterialSheet(scope: scope),
    );
  }

  void _showImportUrlSheet(BuildContext context, MaterialScope scope) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (_) => _ImportUrlSheet(scope: scope),
    );
  }
}

class _MaterialCard extends ConsumerWidget {
  const _MaterialCard({required this.scope, required this.material});

  final MaterialScope scope;
  final CourseMaterial material;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;

    Future<void> openPdf() async {
      try {
        final repo = ref.read(coursesRepositoryProvider);
        await openAuthenticatedApiDownload(
          ref.read(springDioProvider),
          apiPath: repo.materialPdfApiPath(scope.courseId, material.id),
          fileName: '${material.id}.pdf',
        );
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không mở được PDF. Thử đăng nhập lại.')),
          );
        }
      }
    }

    Future<void> reindex() async {
      try {
        await ref
            .read(teacherMaterialsControllerProvider(scope).notifier)
            .reindex(material.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.materialReindexed),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(describeError(error)),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }

    Future<void> editMetadata() async {
      final titleCtrl = TextEditingController(text: material.title);
      final categoryCtrl = TextEditingController(text: material.category ?? '');
      final saved = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text(l10n.editMaterialTitle),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FptTextField(controller: titleCtrl, label: l10n.materialTitleLabel),
              const Gap(Insets.md),
              FptTextField(controller: categoryCtrl, label: l10n.materialCategoryLabel),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(l10n.cancelAction),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(l10n.saveChanges),
            ),
          ],
        ),
      );
      if (saved != true) return;
      try {
        await ref
            .read(teacherMaterialsControllerProvider(scope).notifier)
            .updateMetadata(
              material.id,
              title: titleCtrl.text.trim().isEmpty ? null : titleCtrl.text.trim(),
              category: categoryCtrl.text.trim(),
            );
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(describeError(error)),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }

    Future<void> confirmDelete() async {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text(l10n.deleteMaterial),
          content: Text(l10n.deleteMaterialConfirm(material.title)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(l10n.cancelAction),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(
                l10n.deleteMaterial,
                style: const TextStyle(color: AppColors.error),
              ),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      try {
        await ref
            .read(teacherMaterialsControllerProvider(scope).notifier)
            .delete(material.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.materialDeleted),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(describeError(error)),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }

    return FptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.fileText, size: 20, color: AppColors.primary),
              const Gap(Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      material.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (material.fileName != null) ...[
                      const Gap(Insets.xs),
                      Text(
                        material.fileName!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const Gap(Insets.xs),
                    _MaterialIndexBadge(material: material, l10n: l10n),
                  ],
                ),
              ),
            ],
          ),
          const Gap(Insets.md),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (material.hasPdf)
                _MaterialAction(
                  icon: LucideIcons.eye,
                  label: l10n.viewPdf,
                  onTap: openPdf,
                ),
              _MaterialAction(
                icon: LucideIcons.refreshCw,
                label: l10n.reindexMaterial,
                onTap: reindex,
              ),
              _MaterialAction(
                icon: LucideIcons.pencil,
                label: l10n.editMaterialTitle,
                onTap: editMetadata,
              ),
              _MaterialAction(
                icon: LucideIcons.trash2,
                label: l10n.deleteMaterial,
                color: AppColors.error,
                onTap: confirmDelete,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MaterialIndexBadge extends StatelessWidget {
  const _MaterialIndexBadge({required this.material, required this.l10n});

  final CourseMaterial material;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final status = material.indexStatus?.toUpperCase();
    final failed = status == 'FAILED' || status == 'ERROR';
    final processing =
        status == 'PROCESSING' || status == 'INDEXING' || status == 'PENDING';
    final ready = material.isIndexed && !processing && !failed;

    final (label, color, bg) = failed
        ? ('Index lỗi', AppColors.error, AppColors.errorBg)
        : processing
        ? (l10n.materialIndexing, AppColors.warning, AppColors.warningBg)
        : ready
        ? (l10n.materialReady, AppColors.success, AppColors.successBg)
        : (l10n.materialIndexing, AppColors.warning, AppColors.warningBg);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _MaterialAction extends StatelessWidget {
  const _MaterialAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return Padding(
      padding: const EdgeInsets.only(right: Insets.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.sm),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: Insets.xs),
          child: Row(
            children: [
              Icon(icon, size: 16, color: c),
              const Gap(Insets.xs),
              Text(
                label,
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(color: c),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UploadMaterialSheet extends HookConsumerWidget {
  const _UploadMaterialSheet({required this.scope});

  final MaterialScope scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final titleController = useTextEditingController();
    final pickedFile = useState<PlatformFile?>(null);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> pickFile() async {
      final file = await pickCourseMaterialPdf();
      if (file != null) {
        final validation = validateCourseMaterialPdfFile(file);
        if (validation != null) {
          errorText.value = validation;
          return;
        }
        pickedFile.value = file;
        errorText.value = null;
      }
    }

    Future<void> submit() async {
      final title = titleController.text.trim();
      final path = pickedFile.value?.path;
      if (title.isEmpty || path == null) {
        errorText.value = l10n.uploadMaterialValidation;
        return;
      }
      final validation = validateCourseMaterialPdfFile(pickedFile.value!);
      if (validation != null) {
        errorText.value = validation;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        final uploaded = await ref
            .read(teacherMaterialsControllerProvider(scope).notifier)
            .upload(title: title, filePath: path);
        if (context.mounted) {
          final indexing = !uploaded.isIndexed;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                indexing
                    ? '${l10n.materialUploaded} · ${l10n.materialIndexing}'
                    : l10n.materialUploaded,
              ),
              backgroundColor: AppColors.success,
            ),
          );
          Navigator.pop(context);
        }
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
            l10n.uploadMaterial,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Gap(Insets.lg),
          FptTextField(
            controller: titleController,
            label: l10n.materialTitleLabel,
          ),
          const Gap(Insets.md),
          FptButton(
            label: pickedFile.value?.name ?? l10n.pickFile,
            variant: FptButtonVariant.secondary,
            icon: LucideIcons.paperclip,
            onPressed: pickFile,
          ),
          const Gap(Insets.xs),
          Text(
            'PDF · tối đa 50 MB · index nền sau khi upload (BE mới)',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
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
            label: l10n.uploadMaterial,
            loading: submitting.value,
            onPressed: submitting.value ? null : submit,
          ),
        ],
      ),
    );
  }
}

/// Wizard 2 bước: nhập URL tài liệu HTML → xem trước mục lục → chọn trang
/// cần import. Dùng `POST url-toc` để xem trước rồi `POST import-url` để lưu.
class _ImportUrlSheet extends HookConsumerWidget {
  const _ImportUrlSheet({required this.scope});

  final MaterialScope scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final step = useState(_ImportUrlStep.enterUrl);
    final urlController = useTextEditingController();
    final titleController = useTextEditingController();
    final preview = useState<HtmlTocPreview?>(null);
    final selectedUrls = useState<Set<String>>({});
    final followNext = useState(false);
    final loadingPreview = useState(false);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> loadPreview() async {
      final url = urlController.text.trim();
      if (url.isEmpty) {
        errorText.value = l10n.importUrlRequired;
        return;
      }
      loadingPreview.value = true;
      errorText.value = null;
      try {
        final result = await ref
            .read(coursesRepositoryProvider)
            .previewHtmlToc(courseId: scope.courseId, url: url);
        preview.value = result;
        selectedUrls.value = result.items.map((i) => i.url).toSet();
        if (titleController.text.trim().isEmpty) {
          titleController.text = result.title;
        }
        step.value = _ImportUrlStep.selectPages;
      } catch (e) {
        errorText.value = describeError(e);
      } finally {
        loadingPreview.value = false;
      }
    }

    Future<void> submit() async {
      submitting.value = true;
      errorText.value = null;
      try {
        final hasItems = preview.value?.items.isNotEmpty == true;
        await ref
            .read(teacherMaterialsControllerProvider(scope).notifier)
            .importFromUrl(
              url: urlController.text.trim(),
              title: titleController.text.trim().isEmpty
                  ? null
                  : titleController.text.trim(),
              selectedUrls: hasItems ? selectedUrls.value.toList() : null,
              followNext: !hasItems && followNext.value,
            );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.materialUploaded),
              backgroundColor: AppColors.success,
            ),
          );
          Navigator.pop(context);
        }
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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.importFromUrl, style: Theme.of(context).textTheme.titleLarge),
            const Gap(Insets.sm),
            Text(
              l10n.importUrlHint,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
            ),
            const Gap(Insets.lg),
            FptTextField(
              controller: urlController,
              label: l10n.importUrlLabel,
              enabled: step.value == _ImportUrlStep.enterUrl,
            ),
            if (step.value == _ImportUrlStep.enterUrl) ...[
              if (errorText.value != null) ...[
                const Gap(Insets.md),
                Text(
                  errorText.value!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error),
                ),
              ],
              const Gap(Insets.lg),
              FptButton(
                label: l10n.previewToc,
                icon: LucideIcons.search,
                loading: loadingPreview.value,
                onPressed: loadingPreview.value ? null : loadPreview,
              ),
            ] else ...[
              const Gap(Insets.md),
              FptTextField(controller: titleController, label: l10n.materialTitleLabel),
              const Gap(Insets.lg),
              if (preview.value!.items.isEmpty) ...[
                Text(
                  l10n.importUrlNoToc,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.importUrlFollowNext),
                  value: followNext.value,
                  activeThumbColor: AppColors.primary,
                  onChanged: (v) => followNext.value = v,
                ),
              ] else ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.importUrlSelectPages(preview.value!.items.length),
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    ),
                    TextButton(
                      onPressed: () => selectedUrls.value =
                          selectedUrls.value.length == preview.value!.items.length
                              ? {}
                              : preview.value!.items.map((i) => i.url).toSet(),
                      child: Text(
                        selectedUrls.value.length == preview.value!.items.length
                            ? l10n.importUrlDeselectAll
                            : l10n.importUrlSelectAll,
                      ),
                    ),
                  ],
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 280),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: preview.value!.items.length,
                    itemBuilder: (context, index) {
                      final item = preview.value!.items[index];
                      final checked = selectedUrls.value.contains(item.url);
                      return CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.only(left: (item.level * 12).toDouble()),
                        title: Text(item.title, style: Theme.of(context).textTheme.bodyMedium),
                        value: checked,
                        activeColor: AppColors.primary,
                        onChanged: (v) {
                          final next = {...selectedUrls.value};
                          if (v == true) {
                            next.add(item.url);
                          } else {
                            next.remove(item.url);
                          }
                          selectedUrls.value = next;
                        },
                      );
                    },
                  ),
                ),
              ],
              if (errorText.value != null) ...[
                const Gap(Insets.md),
                Text(
                  errorText.value!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error),
                ),
              ],
              const Gap(Insets.lg),
              Row(
                children: [
                  Expanded(
                    child: FptButton(
                      label: l10n.cancelAction,
                      variant: FptButtonVariant.secondary,
                      onPressed: submitting.value
                          ? null
                          : () => step.value = _ImportUrlStep.enterUrl,
                    ),
                  ),
                  const Gap(Insets.md),
                  Expanded(
                    child: FptButton(
                      label: l10n.importFromUrl,
                      loading: submitting.value,
                      onPressed: submitting.value ? null : submit,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
