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
import '../../../shared/models/admin_models.dart';
import '../../../shared/models/class_section.dart';
import '../../../shared/models/course.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/admin_controllers.dart';

class AdminAcademicScreen extends HookConsumerWidget {
  const AdminAcademicScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = useState(0);
    final tabs = ['Học kỳ', 'Khoá học', 'Lớp học'];

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: 'Quản lý học thuật'),
      body: Column(
        children: [
          // ── Tab bar ──────────────────────────────────────────
          Container(
            color: AppColors.card,
            padding: const EdgeInsets.fromLTRB(Insets.screenH, 0, Insets.screenH, Insets.sm),
            child: Row(
              children: List.generate(tabs.length, (i) {
                final selected = i == tabIndex.value;
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: i < tabs.length - 1 ? Insets.sm : 0),
                    child: GestureDetector(
                      onTap: () => tabIndex.value = i,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: Insets.xs),
                        decoration: BoxDecoration(
                          color: selected ? AppColors.primary : AppColors.raised,
                          borderRadius: BorderRadius.circular(Radii.full),
                        ),
                        child: Center(
                          child: Text(
                            tabs[i],
                            style: TextStyle(
                              color: selected ? Colors.white : AppColors.textTertiary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          // ── Content ──────────────────────────────────────────
          Expanded(
            child: IndexedStack(
              index: tabIndex.value,
              children: const [
                _SemestersTab(),
                _CoursesTab(),
                _ClassesTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Semesters tab ─────────────────────────────────────────────────

class _SemestersTab extends ConsumerWidget {
  const _SemestersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final semestersAsync = ref.watch(adminSemestersProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showSemesterSheet(context, ref),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Thêm học kỳ', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: semestersAsync.when(
        loading: () => const LoadingSkeleton(),
        error: (e, _) => ErrorState(
          message: describeError(e),
          onRetry: () => ref.invalidate(adminSemestersProvider),
        ),
        data: (semesters) {
          if (semesters.isEmpty) {
            return EmptyState(
              title: 'Chưa có học kỳ',
              ctaLabel: 'Tạo học kỳ',
              onCta: () => _showSemesterSheet(context, ref),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(adminSemestersProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 100),
              itemCount: semesters.length,
              separatorBuilder: (_, __) => const Gap(Insets.sm),
              itemBuilder: (ctx, i) {
                final s = semesters[i];
                return _SemesterTile(semester: s)
                    .animate(delay: (40 * i).ms)
                    .fadeIn(duration: 250.ms);
              },
            ),
          );
        },
      ),
    );
  }

  void _showSemesterSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
      builder: (_) => _SemesterForm(ref: ref),
    );
  }
}

class _SemesterTile extends HookConsumerWidget {
  const _SemesterTile({required this.semester});
  final Semester semester;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FptCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primaryWash,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: const Icon(LucideIcons.calendar, size: 20, color: AppColors.primary),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  semester.semesterCode,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                if (semester.name != null)
                  Text(
                    semester.name!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                  ),
              ],
            ),
          ),
          _StatusBadge(status: semester.status),
          const Gap(Insets.xs),
          IconButton(
            icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.error),
            onPressed: () => _confirmDelete(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Xoá học kỳ'),
        content: Text('Xoá học kỳ ${semester.semesterCode}? Chỉ xoá được khi không có khoá học.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(adminSemestersProvider.notifier).delete(semester.semesterCode);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}

class _SemesterForm extends HookConsumerWidget {
  const _SemesterForm({required this.ref});
  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef widgetRef) {
    final codeCtrl = useTextEditingController();
    final nameCtrl = useTextEditingController();
    final saving = useState(false);
    final error = useState<String?>(null);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _SheetHandle(),
            Text('Tạo học kỳ', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const Gap(Insets.lg),
            FptTextField(controller: codeCtrl, label: 'Mã học kỳ (VD: SP2025)'),
            const Gap(Insets.md),
            FptTextField(controller: nameCtrl, label: 'Tên học kỳ (tuỳ chọn)'),
            if (error.value != null) ...[
              const Gap(Insets.sm),
              Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const Gap(Insets.xl),
            FptButton(
              label: saving.value ? 'Đang lưu...' : 'Tạo học kỳ',
              loading: saving.value,
              expand: true,
              onPressed: saving.value
                  ? null
                  : () async {
                      final code = codeCtrl.text.trim();
                      if (code.isEmpty) {
                        error.value = 'Vui lòng nhập mã học kỳ';
                        return;
                      }
                      saving.value = true;
                      error.value = null;
                      try {
                        await ref.read(adminSemestersProvider.notifier).save(
                              semesterCode: code,
                              name: nameCtrl.text.trim().isEmpty ? null : nameCtrl.text.trim(),
                            );
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        error.value = describeError(e);
                      } finally {
                        saving.value = false;
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }
}

// ── Courses tab ───────────────────────────────────────────────────

class _CoursesTab extends ConsumerWidget {
  const _CoursesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(adminCoursesProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCourseSheet(context, ref),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Thêm khoá học', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: coursesAsync.when(
        loading: () => const LoadingSkeleton(),
        error: (e, _) => ErrorState(
          message: describeError(e),
          onRetry: () => ref.invalidate(adminCoursesProvider),
        ),
        data: (courses) {
          if (courses.isEmpty) {
            return EmptyState(
              title: 'Chưa có khoá học',
              ctaLabel: 'Tạo khoá học',
              onCta: () => _showCourseSheet(context, ref),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(adminCoursesProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 100),
              itemCount: courses.length,
              separatorBuilder: (_, __) => const Gap(Insets.sm),
              itemBuilder: (ctx, i) {
                final c = courses[i];
                return _CourseTile(course: c)
                    .animate(delay: (40 * i).ms)
                    .fadeIn(duration: 250.ms);
              },
            ),
          );
        },
      ),
    );
  }

  void _showCourseSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
      builder: (_) => _CourseForm(ref: ref),
    );
  }
}

class _CourseTile extends HookConsumerWidget {
  const _CourseTile({required this.course});
  final Course course;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FptCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.infoBg,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: const Icon(LucideIcons.bookOpen, size: 20, color: AppColors.info),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  course.code,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  course.name,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          _StatusBadge(status: course.status),
          const Gap(Insets.xs),
          PopupMenuButton<String>(
            icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textTertiary),
            color: AppColors.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
            onSelected: (action) => _handleAction(context, ref, action),
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'materials',
                child: Row(children: [
                  Icon(LucideIcons.fileStack, size: 16, color: AppColors.info),
                  Gap(8),
                  Text('Tài liệu chung course'),
                ]),
              ),
              if (course.status != 'COMPLETED')
                const PopupMenuItem(
                  value: 'complete',
                  child: Row(children: [
                    Icon(LucideIcons.checkCircle2, size: 16, color: AppColors.success),
                    Gap(8),
                    Text('Đánh dấu hoàn thành'),
                  ]),
                ),
              const PopupMenuItem(
                value: 'delete',
                child: Row(children: [
                  Icon(LucideIcons.trash2, size: 16, color: AppColors.error),
                  Gap(8),
                  Text('Xoá', style: TextStyle(color: AppColors.error)),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, WidgetRef ref, String action) async {
    if (action == 'materials') {
      context.push(
        Uri(
          path: AppRoutes.adminCourseMaterials(course.id),
          queryParameters: {'label': '${course.code} — ${course.name}'},
        ).toString(),
      );
      return;
    }
    if (action == 'complete') {
      try {
        await ref.read(adminCoursesProvider.notifier).markComplete(course.id);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      }
      return;
    }
    await _confirmDelete(context, ref);
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Xoá khoá học'),
        content: Text('Xoá khoá học ${course.code}? Chỉ xoá được khi không có lớp đang học.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(adminCoursesProvider.notifier).delete(course.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}

class _CourseForm extends HookConsumerWidget {
  const _CourseForm({required this.ref});
  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef widgetRef) {
    final idCtrl = useTextEditingController();
    final codeCtrl = useTextEditingController();
    final nameCtrl = useTextEditingController();
    final semestersAsync = widgetRef.watch(adminSemestersProvider);
    final selectedSemester = useState<String?>(null);
    final saving = useState(false);
    final error = useState<String?>(null);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _SheetHandle(),
            Text('Tạo khoá học', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const Gap(Insets.lg),
            FptTextField(controller: idCtrl, label: 'Mã courseId (VD: PRF192)'),
            const Gap(Insets.md),
            FptTextField(controller: codeCtrl, label: 'Code hiển thị (VD: PRF192)'),
            const Gap(Insets.md),
            FptTextField(controller: nameCtrl, label: 'Tên khoá học'),
            const Gap(Insets.md),
            if (semestersAsync.valueOrNull?.isNotEmpty == true) ...[
              Text('Học kỳ', style: Theme.of(context).textTheme.labelMedium),
              const Gap(Insets.xs),
              DropdownButtonFormField<String>(
                initialValue: selectedSemester.value,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: Insets.sm),
                ),
                hint: const Text('Chọn học kỳ (tuỳ chọn)'),
                items: semestersAsync.valueOrNull!
                    .map((s) => DropdownMenuItem(value: s.semesterCode, child: Text(s.semesterCode)))
                    .toList(),
                onChanged: (v) => selectedSemester.value = v,
              ),
            ],
            if (error.value != null) ...[
              const Gap(Insets.sm),
              Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const Gap(Insets.xl),
            FptButton(
              label: saving.value ? 'Đang lưu...' : 'Tạo khoá học',
              loading: saving.value,
              expand: true,
              onPressed: saving.value
                  ? null
                  : () async {
                      final id = idCtrl.text.trim();
                      final code = codeCtrl.text.trim();
                      final name = nameCtrl.text.trim();
                      if (id.isEmpty || name.isEmpty) {
                        error.value = 'Vui lòng nhập đầy đủ thông tin';
                        return;
                      }
                      saving.value = true;
                      error.value = null;
                      try {
                        await ref.read(adminCoursesProvider.notifier).save(
                              courseId: id,
                              courseCode: code.isEmpty ? id : code,
                              name: name,
                              semesterCode: selectedSemester.value,
                            );
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        error.value = describeError(e);
                      } finally {
                        saving.value = false;
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }
}

// ── Classes tab ───────────────────────────────────────────────────

class _ClassesTab extends HookConsumerWidget {
  const _ClassesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(adminCoursesProvider);
    final selectedCourseId = useState<String?>(null);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        children: [
          // ── Course picker ──────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, 0),
            child: coursesAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (courses) => DropdownButtonFormField<String>(
                initialValue: selectedCourseId.value,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: Insets.md, vertical: Insets.sm),
                  hintText: 'Chọn khoá học để xem lớp',
                ),
                hint: const Text('Chọn khoá học'),
                items: courses.map((c) => DropdownMenuItem(
                  value: c.id,
                  child: Text('${c.code} – ${c.name}', overflow: TextOverflow.ellipsis),
                )).toList(),
                onChanged: (v) => selectedCourseId.value = v,
              ),
            ),
          ),
          const Gap(Insets.md),
          // ── Class list for selected course ────────────────
          Expanded(
            child: selectedCourseId.value == null
                ? const EmptyState(title: 'Chọn khoá học', message: 'Chọn khoá học ở trên để xem danh sách lớp.')
                : _ClassListForCourse(courseId: selectedCourseId.value!),
          ),
        ],
      ),
      floatingActionButton: selectedCourseId.value == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _showClassSheet(context, ref, selectedCourseId.value!),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Thêm lớp', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
    );
  }

  void _showClassSheet(BuildContext context, WidgetRef ref, String courseId) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
      builder: (_) => _ClassForm(ref: ref, courseId: courseId),
    );
  }
}

class _ClassListForCourse extends ConsumerWidget {
  const _ClassListForCourse({required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classesAsync = ref.watch(adminClassesProvider(courseId));

    return classesAsync.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
        message: describeError(e),
        onRetry: () => ref.invalidate(adminClassesProvider(courseId)),
      ),
      data: (classes) {
        if (classes.isEmpty) {
          return const EmptyState(title: 'Chưa có lớp nào', message: 'Nhấn + để tạo lớp học.');
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(Insets.screenH, 0, Insets.screenH, 100),
          itemCount: classes.length,
          separatorBuilder: (_, __) => const Gap(Insets.sm),
          itemBuilder: (ctx, i) {
            final cs = classes[i];
            return _ClassTile(courseId: courseId, section: cs)
                .animate(delay: (40 * i).ms)
                .fadeIn(duration: 250.ms);
          },
        );
      },
    );
  }
}

class _ClassTile extends ConsumerWidget {
  const _ClassTile({required this.courseId, required this.section});
  final String courseId;
  final ClassSection section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FptCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.successBg,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: const Icon(LucideIcons.users, size: 20, color: AppColors.success),
          ),
          const Gap(Insets.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  section.name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  section.id,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          _StatusBadge(status: section.status),
          const Gap(Insets.xs),
          PopupMenuButton<String>(
            icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textTertiary),
            color: AppColors.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
            onSelected: (action) => _handleAction(context, ref, action),
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'roster',
                child: Row(children: [
                  Icon(LucideIcons.userPlus, size: 16),
                  Gap(8),
                  Text('Quản lý sinh viên'),
                ]),
              ),
              if (section.status != 'COMPLETED')
                const PopupMenuItem(
                  value: 'complete',
                  child: Row(children: [
                    Icon(LucideIcons.checkCircle2, size: 16, color: AppColors.success),
                    Gap(8),
                    Text('Đánh dấu hoàn thành'),
                  ]),
                ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'delete',
                child: Row(children: [
                  Icon(LucideIcons.trash2, size: 16, color: AppColors.error),
                  Gap(8),
                  Text('Xoá', style: TextStyle(color: AppColors.error)),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, WidgetRef ref, String action) async {
    if (action == 'roster') {
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: AppColors.card,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
        builder: (_) => _RosterSheet(courseId: courseId, classId: section.id),
      );
      return;
    }
    if (action == 'complete') {
      try {
        await ref.read(adminClassesProvider(courseId).notifier).markComplete(courseId, section.id);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
          );
        }
      }
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Xoá lớp'),
        content: Text('Xoá lớp ${section.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Huỷ')),
          TextButton(
            onPressed: () => Navigator.pop(d, true),
            child: const Text('Xoá', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(adminClassesProvider(courseId).notifier).delete(courseId, section.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
        );
      }
    }
  }
}

/// Bottom sheet quản lý roster của 1 lớp: xem danh sách, thêm 1 SV, gỡ 1 SV.
/// Bổ sung cho luồng import Excel hàng loạt đã có sẵn.
class _RosterSheet extends HookConsumerWidget {
  const _RosterSheet({required this.courseId, required this.classId});
  final String courseId;
  final String classId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scope = (courseId: courseId, classId: classId);
    final rosterAsync = ref.watch(adminClassRosterProvider(scope));
    final studentIdCtrl = useTextEditingController();
    final nameCtrl = useTextEditingController();
    final emailCtrl = useTextEditingController();
    final adding = useState(false);
    final error = useState<String?>(null);

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
            children: [
              _SheetHandle(),
              Text('Quản lý sinh viên · $classId', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const Gap(Insets.lg),
              FptTextField(controller: studentIdCtrl, label: 'Student ID'),
              const Gap(Insets.sm),
              FptTextField(controller: nameCtrl, label: 'Tên (tuỳ chọn)'),
              const Gap(Insets.sm),
              FptTextField(controller: emailCtrl, label: 'Email (tuỳ chọn)'),
              if (error.value != null) ...[
                const Gap(Insets.sm),
                Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
              ],
              const Gap(Insets.md),
              FptButton(
                label: 'Thêm sinh viên',
                icon: LucideIcons.userPlus,
                loading: adding.value,
                expand: true,
                onPressed: adding.value
                    ? null
                    : () async {
                        final sid = studentIdCtrl.text.trim();
                        if (sid.isEmpty) {
                          error.value = 'Vui lòng nhập Student ID';
                          return;
                        }
                        adding.value = true;
                        error.value = null;
                        try {
                          await ref.read(adminClassRosterProvider(scope).notifier).enroll(
                                studentId: sid,
                                studentName: nameCtrl.text.trim().isEmpty ? null : nameCtrl.text.trim(),
                                studentEmail: emailCtrl.text.trim().isEmpty ? null : emailCtrl.text.trim(),
                              );
                          studentIdCtrl.clear();
                          nameCtrl.clear();
                          emailCtrl.clear();
                        } catch (e) {
                          error.value = describeError(e);
                        } finally {
                          adding.value = false;
                        }
                      },
              ),
              const Gap(Insets.xl),
              Text('Danh sách hiện tại', style: Theme.of(context).textTheme.labelLarge),
              const Gap(Insets.sm),
              rosterAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: Insets.lg),
                  child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                ),
                error: (e, _) => Text(describeError(e), style: const TextStyle(color: AppColors.error)),
                data: (students) {
                  if (students.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: Insets.lg),
                      child: Text('Chưa có sinh viên trong lớp này.'),
                    );
                  }
                  return Column(
                    children: students.map((s) {
                      final id = (s['studentId'] ?? s['id'] ?? '').toString();
                      final name = (s['studentName'] ?? s['name'] ?? id).toString();
                      final email = s['studentEmail']?.toString();
                      return Padding(
                        padding: const EdgeInsets.only(bottom: Insets.sm),
                        child: FptCard(
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                    if (email != null)
                                      Text(email, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary)),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(LucideIcons.userMinus, size: 16, color: AppColors.error),
                                onPressed: id.isEmpty
                                    ? null
                                    : () async {
                                        try {
                                          await ref.read(adminClassRosterProvider(scope).notifier).remove(id);
                                        } catch (e) {
                                          if (context.mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(content: Text(describeError(e)), backgroundColor: AppColors.error),
                                            );
                                          }
                                        }
                                      },
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ClassForm extends HookConsumerWidget {
  const _ClassForm({required this.ref, required this.courseId});
  final WidgetRef ref;
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef widgetRef) {
    final classIdCtrl = useTextEditingController();
    final classNameCtrl = useTextEditingController();
    final teacherIdCtrl = useTextEditingController();
    final saving = useState(false);
    final error = useState<String?>(null);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Insets.screenH, Insets.md, Insets.screenH, Insets.xxxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _SheetHandle(),
            Text('Tạo lớp học', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const Gap(Insets.lg),
            FptTextField(controller: classIdCtrl, label: 'Mã lớp (VD: SE1701)'),
            const Gap(Insets.md),
            FptTextField(controller: classNameCtrl, label: 'Tên lớp'),
            const Gap(Insets.md),
            FptTextField(
              controller: teacherIdCtrl,
              label: 'Mã giảng viên (tuỳ chọn)',
              hint: 'userId của giảng viên phụ trách',
            ),
            if (error.value != null) ...[
              const Gap(Insets.sm),
              Text(error.value!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ],
            const Gap(Insets.xl),
            FptButton(
              label: saving.value ? 'Đang lưu...' : 'Tạo lớp',
              loading: saving.value,
              expand: true,
              onPressed: saving.value
                  ? null
                  : () async {
                      final classId = classIdCtrl.text.trim();
                      final className = classNameCtrl.text.trim();
                      if (classId.isEmpty || className.isEmpty) {
                        error.value = 'Vui lòng nhập mã lớp và tên lớp';
                        return;
                      }
                      saving.value = true;
                      error.value = null;
                      try {
                        await ref.read(adminClassesProvider(courseId).notifier).save(
                              courseId: courseId,
                              classId: classId,
                              className: className,
                              teacherId: teacherIdCtrl.text.trim().isEmpty ? null : teacherIdCtrl.text.trim(),
                            );
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        error.value = describeError(e);
                      } finally {
                        saving.value = false;
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────

class _SheetHandle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        margin: const EdgeInsets.only(bottom: Insets.lg),
        decoration: BoxDecoration(
          color: AppColors.borderStrong,
          borderRadius: BorderRadius.circular(Radii.full),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final active = status == 'ACTIVE';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: active ? AppColors.successBg : AppColors.raised,
        borderRadius: BorderRadius.circular(Radii.full),
      ),
      child: Text(
        active ? 'Đang hoạt động' : status,
        style: TextStyle(
          color: active ? AppColors.success : AppColors.textTertiary,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
