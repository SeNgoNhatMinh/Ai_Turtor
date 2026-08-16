import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_controllers.dart';
import '../data/admin_repository.dart';

class AdminImportScreen extends HookConsumerWidget {
  const AdminImportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = useState(0);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Import dữ liệu'),
      body: Column(
        children: [
          Container(
            color: AppColors.card,
            padding: const EdgeInsets.fromLTRB(Insets.screenH, 0, Insets.screenH, Insets.sm),
            child: Row(
              children: [
                _Tab(
                  label: 'Giảng viên',
                  selected: tabIndex.value == 0,
                  onTap: () => tabIndex.value = 0,
                ),
                const Gap(Insets.sm),
                _Tab(
                  label: 'Sinh viên',
                  selected: tabIndex.value == 1,
                  onTap: () => tabIndex.value = 1,
                ),
              ],
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: tabIndex.value,
              children: const [
                _ImportTeachersTab(),
                _ImportStudentsTab(),
              ],
            ),
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
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: Insets.xs),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : AppColors.raised,
            borderRadius: BorderRadius.circular(Radii.full),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : AppColors.textTertiary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Import teachers tab ───────────────────────────────────────────

class _ImportTeachersTab extends HookConsumerWidget {
  const _ImportTeachersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final result = useState<Map<String, dynamic>?>(null);
    final loading = useState(false);
    final error = useState<String?>(null);

    return ListView(
      padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.lg, Insets.screenH, Insets.xxxl),
      children: [
        // ── Instructions ──────────────────────────────────────
        FptCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.infoBg,
                      borderRadius: BorderRadius.circular(Radii.md),
                    ),
                    child: const Icon(LucideIcons.info, size: 18, color: AppColors.info),
                  ),
                  const Gap(Insets.sm),
                  Text(
                    'Import giảng viên',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const Gap(Insets.md),
              const Text(
                'Upload file Excel (.xlsx) hoặc CSV theo mẫu. Hệ thống sẽ tạo tài khoản giảng viên tự động.',
                style: TextStyle(fontSize: 13, height: 1.5),
              ),
              const Gap(Insets.md),
              _TemplateRow(
                label: 'Template Excel',
                onDownload: () => _downloadTemplate(context, ref),
              ),
            ],
          ),
        ),
        const Gap(Insets.lg),
        // ── Upload area ────────────────────────────────────────
        _UploadCard(
          title: 'Chọn file giảng viên',
          subtitle: 'Excel (.xlsx) hoặc CSV',
          icon: LucideIcons.userPlus,
          color: AppColors.info,
          bg: AppColors.infoBg,
          loading: loading.value,
          onUpload: (bytes, name) async {
            loading.value = true;
            error.value = null;
            result.value = null;
            try {
              final res = await ref
                  .read(adminRepositoryProvider)
                  .importTeachersExcel(bytes, name);
              result.value = res;
            } catch (e) {
              error.value = describeError(e);
            } finally {
              loading.value = false;
            }
          },
        ),
        if (error.value != null) ...[
          const Gap(Insets.md),
          _ErrorBanner(message: error.value!),
        ],
        if (result.value != null) ...[
          const Gap(Insets.md),
          _ImportResultCard(result: result.value!),
        ],
      ],
    );
  }

  Future<void> _downloadTemplate(BuildContext context, WidgetRef ref) async {
    final url = ref.read(adminRepositoryProvider).mentorImportTemplateUrl();
    final uri = Uri.parse(url);
    final launched = await canLaunchUrl(uri) &&
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Không thể mở link tải: $url'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }
}

// ── Import students tab ───────────────────────────────────────────

class _ImportStudentsTab extends HookConsumerWidget {
  const _ImportStudentsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseIdCtrl = useTextEditingController();
    final classIdCtrl = useTextEditingController();
    final result = useState<Map<String, dynamic>?>(null);
    final loading = useState(false);
    final error = useState<String?>(null);
    final coursesAsync = ref.watch(adminCoursesProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.lg, Insets.screenH, Insets.xxxl),
      children: [
        FptCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.successBg,
                      borderRadius: BorderRadius.circular(Radii.md),
                    ),
                    child: const Icon(LucideIcons.info, size: 18, color: AppColors.success),
                  ),
                  const Gap(Insets.sm),
                  Text(
                    'Import sinh viên vào lớp',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const Gap(Insets.md),
              const Text(
                'Upload file Excel (.xlsx) danh sách sinh viên cho một lớp cụ thể.',
                style: TextStyle(fontSize: 13, height: 1.5),
              ),
            ],
          ),
        ),
        const Gap(Insets.lg),
        // ── Course + class selectors ───────────────────────────
        if (coursesAsync.valueOrNull?.isNotEmpty == true) ...[
          Text('Khoá học', style: Theme.of(context).textTheme.labelMedium),
          const Gap(Insets.xs),
          DropdownButtonFormField<String>(
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.raised,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(Radii.md),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: Insets.sm),
            ),
            hint: const Text('Chọn khoá học'),
            items: coursesAsync.valueOrNull!
                .map((c) => DropdownMenuItem(value: c.id, child: Text('${c.code} – ${c.name}', overflow: TextOverflow.ellipsis)))
                .toList(),
            onChanged: (v) => courseIdCtrl.text = v ?? '',
          ),
          const Gap(Insets.md),
        ] else ...[
          FptTextField(controller: courseIdCtrl, label: 'Course ID'),
          const Gap(Insets.md),
        ],
        FptTextField(controller: classIdCtrl, label: 'Class ID (mã lớp)'),
        const Gap(Insets.lg),
        _UploadCard(
          title: 'Chọn file sinh viên',
          subtitle: 'Excel (.xlsx)',
          icon: LucideIcons.users,
          color: AppColors.success,
          bg: AppColors.successBg,
          loading: loading.value,
          onUpload: (bytes, name) async {
            final courseId = courseIdCtrl.text.trim();
            final classId = classIdCtrl.text.trim();
            if (courseId.isEmpty || classId.isEmpty) {
              error.value = 'Vui lòng chọn khoá học và nhập mã lớp';
              return;
            }
            loading.value = true;
            error.value = null;
            result.value = null;
            try {
              final res = await ref
                  .read(adminRepositoryProvider)
                  .importStudentsExcel(courseId, classId, bytes, name);
              result.value = res;
            } catch (e) {
              error.value = describeError(e);
            } finally {
              loading.value = false;
            }
          },
        ),
        if (error.value != null) ...[
          const Gap(Insets.md),
          _ErrorBanner(message: error.value!),
        ],
        if (result.value != null) ...[
          const Gap(Insets.md),
          _ImportResultCard(result: result.value!),
        ],
      ],
    );
  }
}

// ── Shared widgets ────────────────────────────────────────────────

class _TemplateRow extends StatelessWidget {
  const _TemplateRow({required this.label, required this.onDownload});
  final String label;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(LucideIcons.fileSpreadsheet, size: 16, color: AppColors.success),
        const Gap(Insets.xs),
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const Spacer(),
        TextButton.icon(
          onPressed: onDownload,
          icon: const Icon(LucideIcons.download, size: 14),
          label: const Text('Tải mẫu'),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: Insets.sm, vertical: 4),
            visualDensity: VisualDensity.compact,
          ),
        ),
      ],
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.bg,
    required this.loading,
    required this.onUpload,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Color bg;
  final bool loading;
  final Future<void> Function(List<int> bytes, String name) onUpload;

  @override
  Widget build(BuildContext context) {
    return FptCard(
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Radii.lg)),
            child: Icon(icon, size: 28, color: color),
          ),
          const Gap(Insets.md),
          Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const Gap(4),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary)),
          const Gap(Insets.lg),
          loading
              ? const CircularProgressIndicator(color: AppColors.primary)
              : FptButton(
                  label: 'Chọn file',
                  expand: true,
                  onPressed: _pickFile,
                ),
        ],
      ),
    );
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['xlsx', 'xls', 'csv'],
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) return;
    await onUpload(bytes, file.name);
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Insets.md),
      decoration: BoxDecoration(
        color: AppColors.errorBg,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.alertCircle, size: 16, color: AppColors.error),
          const Gap(Insets.sm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _ImportResultCard extends StatelessWidget {
  const _ImportResultCard({required this.result});
  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final success = (result['successCount'] as num?)?.toInt()
        ?? (result['imported'] as num?)?.toInt()
        ?? 0;
    final failed = (result['failCount'] as num?)?.toInt()
        ?? (result['failed'] as num?)?.toInt()
        ?? 0;

    return Container(
      padding: const EdgeInsets.all(Insets.md),
      decoration: BoxDecoration(
        color: AppColors.successBg,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.checkCircle2, size: 16, color: AppColors.success),
              const Gap(Insets.sm),
              Text(
                'Import hoàn tất',
                style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ],
          ),
          const Gap(Insets.sm),
          Text('Thành công: $success', style: const TextStyle(fontSize: 13)),
          if (failed > 0)
            Text('Thất bại: $failed', style: const TextStyle(fontSize: 13, color: AppColors.error)),
        ],
      ),
    );
  }
}
