import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/utils/material_upload.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/course_material.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_materials_controller.dart';

/// Admin upload/quản lý tài liệu **chung course** (`uploaderRole=ADMIN`).
class AdminCourseMaterialsScreen extends HookConsumerWidget {
  const AdminCourseMaterialsScreen({
    super.key,
    required this.courseId,
    this.courseLabel,
  });

  final String courseId;
  final String? courseLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final materials = ref.watch(adminMaterialsControllerProvider(courseId));
    final title = courseLabel ?? courseId;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Tài liệu môn — $title'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onOrange,
        onPressed: () => _showUploadSheet(context, courseId),
        icon: const Icon(LucideIcons.upload),
        label: Text(l10n.uploadMaterial),
      ),
      body: materials.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(adminMaterialsControllerProvider(courseId)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: 'Chưa có tài liệu',
              message:
                  'Upload tài liệu chung cho môn $title. '
                  'Tài liệu này dùng cho RAG/quiz của toàn course.',
              ctaLabel: l10n.uploadMaterial,
              onCta: () => _showUploadSheet(context, courseId),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(adminMaterialsControllerProvider(courseId).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) => _AdminMaterialCard(
                courseId: courseId,
                material: items[index],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showUploadSheet(BuildContext context, String courseId) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (_) => _AdminUploadSheet(courseId: courseId),
    );
  }
}

class _AdminMaterialCard extends ConsumerWidget {
  const _AdminMaterialCard({required this.courseId, required this.material});

  final String courseId;
  final CourseMaterial material;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final scopeLabel = material.classId == null || material.classId!.isEmpty
        ? 'Chung course'
        : 'Lớp ${material.classId}';

    Future<void> reindex() async {
      try {
        await ref
            .read(adminMaterialsControllerProvider(courseId).notifier)
            .reindex(material.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.materialReindexed),
              backgroundColor: AppColors.success,
            ),
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

    Future<void> confirmDelete() async {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.card,
          title: Text(l10n.deleteMaterial),
          content: Text(l10n.deleteMaterialConfirm(material.title)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.cancelAction)),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l10n.deleteMaterial, style: const TextStyle(color: AppColors.error)),
            ),
          ],
        ),
      );
      if (ok != true) return;
      try {
        await ref.read(adminMaterialsControllerProvider(courseId).notifier).delete(material.id);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      }
    }

    return FptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  material.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: Insets.xs),
                decoration: BoxDecoration(
                  color: AppColors.raised,
                  borderRadius: BorderRadius.circular(Radii.full),
                ),
                child: Text(
                  scopeLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const Gap(Insets.sm),
          Text(
            '${material.fileTypeLabel}'
            '${material.isIndexed ? ' · Đã index' : ' · Chưa index'}'
            '${material.pageCount != null && material.pageCount! > 0 ? ' · ${material.pageCount} trang' : ''}'
            '${material.tocItemCount != null && material.tocItemCount! > 0 ? ' · ${material.tocItemCount} mục lục' : ''}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
          ),
          const Gap(Insets.md),
          Row(
            children: [
              FptButton(
                label: 'Re-index',
                size: FptButtonSize.sm,
                variant: FptButtonVariant.secondary,
                onPressed: reindex,
              ),
              const Spacer(),
              IconButton(
                tooltip: l10n.deleteMaterial,
                icon: const Icon(LucideIcons.trash2, size: 18, color: AppColors.error),
                onPressed: confirmDelete,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AdminUploadSheet extends HookConsumerWidget {
  const _AdminUploadSheet({required this.courseId});

  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final titleController = useTextEditingController();
    final pickedFile = useState<PlatformFile?>(null);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> submit() async {
      final title = titleController.text.trim();
      final path = pickedFile.value?.path;
      if (title.isEmpty || path == null) {
        errorText.value = l10n.uploadMaterialValidation;
        return;
      }
      if (pickedFile.value != null) {
        final validation = validateCourseMaterialPdfFile(pickedFile.value!);
        if (validation != null) {
          errorText.value = validation;
          return;
        }
      }
      submitting.value = true;
      errorText.value = null;
      try {
        final uploaded = await ref
            .read(adminMaterialsControllerProvider(courseId).notifier)
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
          Text(
            'Tài liệu chung course',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Gap(Insets.sm),
          Text(
            'Tài liệu admin dùng cho toàn môn — không gắn lớp cụ thể.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
          ),
          const Gap(Insets.lg),
          FptTextField(controller: titleController, label: l10n.materialTitleLabel),
          const Gap(Insets.md),
          FptButton(
            label: pickedFile.value?.name ?? l10n.pickFile,
            variant: FptButtonVariant.secondary,
            icon: LucideIcons.paperclip,
            onPressed: () async {
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
            },
          ),
          const Gap(Insets.xs),
          Text(
            'PDF · tối đa 50 MB · BE trả HTTP 202 và index nền',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
          ),
          if (errorText.value != null) ...[
            const Gap(Insets.md),
            Text(errorText.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
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
