import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/authenticated_file_open.dart';
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/course_material.dart';
import '../../../shared/widgets/widgets.dart';
import '../../assignments/application/assignments_controller.dart';
import '../../assignments/presentation/widgets/student_assignment_card.dart';
import '../../courses/application/courses_controller.dart';
import '../../courses/data/courses_repository.dart';
import '../application/student_materials_controller.dart';

String _resolveApiCourseId(WidgetRef ref, String courseRouteId) {
  final courses = ref.read(coursesControllerProvider).valueOrNull ?? [];
  for (final course in courses) {
    if (course.id == courseRouteId || course.code == courseRouteId) {
      return course.code.isNotEmpty ? course.code : course.id;
    }
  }
  return courseRouteId;
}

class StudentMaterialsScreen extends HookConsumerWidget {
  const StudentMaterialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final tabController = useTabController(initialLength: 2);
    final courses = ref.watch(coursesControllerProvider);
    final selected = ref.watch(selectedCourseProvider);

    return courses.when(
      loading: () => const Scaffold(body: LoadingSkeleton(itemCount: 4)),
      error: (error, _) => Scaffold(
        body: ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(coursesControllerProvider),
        ),
      ),
      data: (items) {
        final unique = _uniqueCourses(items);
        if (unique.isEmpty) {
          return Scaffold(
            body: EmptyState(
              title: l10n.emptyCoursesTitle,
              message: l10n.emptyCoursesMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(coursesControllerProvider),
            ),
          );
        }

        final active = _resolveActiveCourse(unique, selected);
        if (selected == null || selected.selectionKey != active.selectionKey) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.read(selectedCourseProvider.notifier).state = active;
          });
        }

        final scope = (
          courseRouteId: active.id,
          classId: active.classId,
        );

        return Scaffold(
          backgroundColor: Colors.transparent,
          appBar: FptAppBar(
            title: 'Tài liệu & bài tập',
            leading: IconButton(
              icon: const Icon(LucideIcons.arrowLeft),
              onPressed: () =>
                  context.canPop() ? context.pop() : context.go(AppRoutes.studentHome),
            ),
          ),
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.screenH,
                  Insets.md,
                  Insets.screenH,
                  Insets.sm,
                ),
                child: _CoursePicker(
                  courses: unique,
                  value: active,
                  onChanged: (course) {
                    ref.read(selectedCourseProvider.notifier).state = course;
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
                child: TabBar(
                  controller: tabController,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.textTertiary,
                  indicatorColor: AppColors.primary,
                  tabs: const [
                    Tab(text: 'Tài liệu'),
                    Tab(text: 'Bài tập'),
                  ],
                ),
              ),
              Expanded(
                child: TabBarView(
                  controller: tabController,
                  children: [
                    _MaterialsTab(scope: scope),
                    _AssignmentsTab(course: active),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  List<Course> _uniqueCourses(List<Course> courses) {
    final unique = <Course>[];
    final seen = <String>{};
    for (final course in courses) {
      if (seen.add(course.selectionKey)) unique.add(course);
    }
    return unique;
  }

  Course _resolveActiveCourse(List<Course> courses, Course? selected) {
    if (selected != null &&
        courses.any((c) => c.selectionKey == selected.selectionKey)) {
      return courses.firstWhere((c) => c.selectionKey == selected.selectionKey);
    }
    return courses.first;
  }
}

class _CoursePicker extends StatelessWidget {
  const _CoursePicker({
    required this.courses,
    required this.value,
    required this.onChanged,
  });

  final List<Course> courses;
  final Course value;
  final ValueChanged<Course> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<Course>(
          value: value,
          isExpanded: true,
          items: courses
              .map(
                (course) => DropdownMenuItem(
                  value: course,
                  child: Text(
                    course.name.isNotEmpty
                        ? '${course.code} — ${course.name}'
                        : course.code,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (course) {
            if (course != null) onChanged(course);
          },
        ),
      ),
    );
  }
}

class _MaterialsTab extends HookConsumerWidget {
  const _MaterialsTab({required this.scope});

  final StudentMaterialsScope scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final query = useState('');
    final materials = ref.watch(studentMaterialsProvider(scope));

    return materials.when(
      loading: () => const LoadingSkeleton(itemCount: 4),
      error: (error, _) => ErrorState(
        message: describeError(error),
        onRetry: () => ref.invalidate(studentMaterialsProvider(scope)),
      ),
      data: (items) {
        final needle = query.value.trim().toLowerCase();
        final visible = needle.isEmpty
            ? items
            : items.where((item) {
                return item.title.toLowerCase().contains(needle) ||
                    (item.category ?? '').toLowerCase().contains(needle);
              }).toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.md,
                Insets.screenH,
                Insets.sm,
              ),
              child: TextField(
                onChanged: (value) => query.value = value,
                decoration: InputDecoration(
                  hintText: 'Tìm tài liệu...',
                  prefixIcon: const Icon(LucideIcons.search, size: 18),
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            Expanded(
              child: items.isEmpty
                  ? EmptyState(
                      title: 'Chưa có tài liệu',
                      message:
                          'Giảng viên chưa tải học liệu cho môn này hoặc tài liệu đang được index.',
                      ctaLabel: l10n.refresh,
                      onCta: () =>
                          ref.invalidate(studentMaterialsProvider(scope)),
                    )
                  : visible.isEmpty
                  ? const EmptyState(
                      title: 'Không tìm thấy tài liệu',
                      message: 'Thử từ khóa khác theo tên hoặc danh mục.',
                    )
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () =>
                          ref.refresh(studentMaterialsProvider(scope).future),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                          Insets.screenH,
                          Insets.sm,
                          Insets.screenH,
                          Insets.xxxl,
                        ),
                        itemCount: visible.length,
                        separatorBuilder: (_, __) => const Gap(Insets.md),
                        itemBuilder: (context, index) {
                          final apiCourseId = _resolveApiCourseId(
                            ref,
                            scope.courseRouteId,
                          );
                          return _StudentMaterialTile(
                            apiCourseId: apiCourseId,
                            material: visible[index],
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _StudentMaterialTile extends ConsumerWidget {
  const _StudentMaterialTile({
    required this.apiCourseId,
    required this.material,
  });

  final String apiCourseId;
  final CourseMaterial material;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = material.indexStatus?.toUpperCase();
    final statusLabel = switch (status) {
      'PROCESSING' || 'PENDING' || 'INDEXING' => 'Đang index',
      'INDEXED' || 'COMPLETED' || 'READY' => 'Đã index',
      'FAILED' => 'Lỗi index',
      _ => material.isIndexed ? 'Sẵn sàng' : 'Chưa index',
    };

    Future<void> openPdf() async {
      if (!material.hasPdf) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tài liệu này chưa có file PDF để tải.')),
        );
        return;
      }
      try {
        final repo = ref.read(coursesRepositoryProvider);
        await openAuthenticatedApiDownload(
          ref.read(springDioProvider),
          apiPath: repo.materialPdfApiPath(apiCourseId, material.id),
          fileName: '${material.title}.pdf',
        );
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(error))),
          );
        }
      }
    }

    return PlugProCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primaryWash,
                  borderRadius: BorderRadius.circular(Radii.md),
                ),
                child: const Icon(
                  LucideIcons.fileText,
                  size: 20,
                  color: AppColors.primary,
                ),
              ),
              const Gap(Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      material.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (material.category != null &&
                        material.category!.trim().isNotEmpty)
                      Text(
                        material.category!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textTertiary,
                        ),
                      ),
                  ],
                ),
              ),
              Chip(
                label: Text(statusLabel),
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ],
          ),
          const Gap(Insets.sm),
          Wrap(
            spacing: Insets.sm,
            runSpacing: Insets.xs,
            children: [
              if (material.pageCount != null)
                Text(
                  '${material.pageCount} trang',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              if (material.displayFileSize != null)
                Text(
                  formatFileSize(material.displayFileSize!),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              if (material.uploadedAt != null)
                Text(
                  formatRelativeTime(material.uploadedAt!),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
            ],
          ),
          const Gap(Insets.md),
          FptButton(
            label: material.hasPdf ? 'Tải PDF' : 'Không có PDF',
            icon: LucideIcons.download,
            variant: FptButtonVariant.secondary,
            size: FptButtonSize.sm,
            expand: true,
            onPressed: material.hasPdf ? openPdf : null,
          ),
        ],
      ),
    );
  }
}

class _AssignmentsTab extends HookConsumerWidget {
  const _AssignmentsTab({required this.course});

  final Course course;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final query = useState('');
    final data = ref.watch(assignmentsControllerProvider);

    return data.when(
      loading: () => const LoadingSkeleton(itemCount: 4),
      error: (error, _) => ErrorState(
        message: describeError(error),
        onRetry: () => ref.invalidate(assignmentsControllerProvider),
      ),
      data: (payload) {
        final assignments = payload.assignments
            .map(payload.enriched)
            .where(
              (item) =>
                  item.courseId == course.id ||
                  item.courseId == course.code ||
                  item.courseCode == course.code,
            )
            .toList();
        final needle = query.value.trim().toLowerCase();
        final visible = needle.isEmpty
            ? assignments
            : assignments
                  .where((item) => item.title.toLowerCase().contains(needle))
                  .toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.md,
                Insets.screenH,
                Insets.sm,
              ),
              child: TextField(
                onChanged: (value) => query.value = value,
                decoration: InputDecoration(
                  hintText: 'Tìm bài tập...',
                  prefixIcon: const Icon(LucideIcons.search, size: 18),
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            Expanded(
              child: assignments.isEmpty
                  ? EmptyState(
                      title: l10n.emptyAssignmentsTitle,
                      message: 'Chưa có bài tập nào cho môn ${course.code}.',
                      ctaLabel: l10n.refresh,
                      onCta: () =>
                          ref.invalidate(assignmentsControllerProvider),
                    )
                  : visible.isEmpty
                  ? const EmptyState(
                      title: 'Không tìm thấy bài tập',
                      message: 'Thử từ khóa khác theo tên bài tập.',
                    )
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () =>
                          ref.refresh(assignmentsControllerProvider.future),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                          Insets.screenH,
                          Insets.sm,
                          Insets.screenH,
                          Insets.xxxl,
                        ),
                        itemCount: visible.length,
                        separatorBuilder: (_, __) => const Gap(Insets.md),
                        itemBuilder: (context, index) {
                          final assignment = visible[index];
                          return StudentAssignmentCard(
                            assignment: assignment,
                            onTap: () => context.push(
                              AppRoutes.studentAssignmentDetail(assignment.id),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}
