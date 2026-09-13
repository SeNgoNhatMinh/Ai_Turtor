import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/course_material.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_materials_controller.dart';

/// Admin xem/quản lý tài liệu **chung course**. Upload file không còn trên mobile.
class AdminCourseMaterialsScreen extends ConsumerWidget {
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
                  'Chưa có tài liệu chung cho môn $title. '
                  'Mobile không hỗ trợ tải file lên.',
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
