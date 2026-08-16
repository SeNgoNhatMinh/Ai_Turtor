import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:open_filex/open_filex.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/assignment.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/assignments_controller.dart';
import '../data/assignments_repository.dart';
import 'widgets/student_assignment_card.dart';

class StudentAssignmentsScreen extends HookConsumerWidget {
  const StudentAssignmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final data = ref.watch(assignmentsControllerProvider);
    final filter = useState(AssignmentFilter.pending);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: data.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(assignmentsControllerProvider),
        ),
        data: (payload) {
            final assignments =
                payload.assignments.map(payload.enriched).toList();
            final pending = assignments
                .where((a) => assignmentMatchesFilter(a, AssignmentFilter.pending))
                .toList();
            final visible = assignments
                .where((a) => assignmentMatchesFilter(a, filter.value))
                .toList();

            if (assignments.isEmpty) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: MediaQuery.paddingOf(context).top + Insets.md),
                  Expanded(
                    child: EmptyState(
                      title: l10n.emptyAssignmentsTitle,
                      message: l10n.emptyAssignmentsMessage,
                      ctaLabel: l10n.refresh,
                      onCta: () => ref.invalidate(assignmentsControllerProvider),
                    ),
                  ),
                ],
              );
            }

            return RefreshIndicator(
              color: AppColors.navActive,
              onRefresh: () =>
                  ref.refresh(assignmentsControllerProvider.future),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                slivers: [
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: MediaQuery.paddingOf(context).top + Insets.md,
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: PlugProHeroCard(
                      tag: 'Nhắc nhở',
                      title: 'Nộp bài đúng hạn',
                      subtitle:
                          'Theo dõi bài chờ nộp, đã nộp và đã chấm điểm tại đây.',
                      ctaLabel: pending.isNotEmpty ? 'Xem chờ nộp' : 'Làm mới',
                      showMascot: false,
                      onCta: () {
                        if (pending.isNotEmpty) {
                          filter.value = AssignmentFilter.pending;
                        } else {
                          ref.invalidate(assignmentsControllerProvider);
                        }
                      },
                    ).animate().fadeIn(duration: Motion.base),
                  ),
                  const SliverToBoxAdapter(child: Gap(Insets.lg)),
                  SliverToBoxAdapter(
                    child: PlugProPills(
                      pills: [
                        PlugProPill(
                          id: 'pending',
                          label: l10n.assignmentFilterPending(pending.length),
                          icon: LucideIcons.clock,
                        ),
                        PlugProPill(
                          id: 'submitted',
                          label: l10n.assignmentFilterSubmitted,
                          icon: LucideIcons.send,
                        ),
                        PlugProPill(
                          id: 'reviewed',
                          label: l10n.assignmentFilterReviewed,
                          icon: LucideIcons.checkCircle,
                        ),
                      ],
                      selectedId: switch (filter.value) {
                        AssignmentFilter.pending => 'pending',
                        AssignmentFilter.submitted => 'submitted',
                        AssignmentFilter.reviewed => 'reviewed',
                      },
                      onSelected: (id) {
                        filter.value = switch (id) {
                          'submitted' => AssignmentFilter.submitted,
                          'reviewed' => AssignmentFilter.reviewed,
                          _ => AssignmentFilter.pending,
                        };
                      },
                    ),
                  ),
                  const SliverToBoxAdapter(child: Gap(Insets.md)),
                  if (visible.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyState(title: l10n.emptyAssignmentsTitle),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        Insets.screenH,
                        Insets.sm,
                        Insets.screenH,
                        Insets.xxxl,
                      ),
                      sliver: SliverList.separated(
                        itemCount: visible.length,
                        separatorBuilder: (_, __) => const Gap(Insets.md),
                        itemBuilder: (context, index) {
                          final assignment = visible[index];
                          return StudentAssignmentCard(
                            assignment: assignment,
                            onTap: () => context.push(
                              AppRoutes.studentAssignmentDetail(assignment.id),
                            ),
                            onSubmit: assignment.status != 'SUBMITTED' &&
                                    assignment.status != 'REVIEWED'
                                ? () => context.push(
                                      AppRoutes.studentAssignmentSubmit(
                                        assignment.id,
                                      ),
                                    )
                                : null,
                          ).animate(delay: (40 * index).clamp(0, 240).ms)
                              .fadeIn(duration: Motion.base);
                        },
                      ),
                    ),
                ],
              ),
            );
          },
        ),
    );
  }
}

class AssignmentDetailScreen extends ConsumerWidget {
  const AssignmentDetailScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final data = ref.watch(assignmentsControllerProvider);

    return data.when(
      loading: () => Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: Text(l10n.tabAssignments)),
        body: const LoadingSkeleton(itemCount: 2),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: Text(l10n.tabAssignments)),
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
            appBar: AppBar(title: Text(l10n.tabAssignments)),
            body: ErrorState(
              message: l10n.assignmentNotFound,
              onRetry: () => context.pop(),
            ),
          );
        }

        final resolved = assignment;
        final reviewed = resolved.status == 'REVIEWED';
        final submitted = resolved.status == 'SUBMITTED' || reviewed;

        return Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            title: Text(
              resolved.title,
              style: const TextStyle(fontWeight: FontWeight.w800),
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
              StudentAssignmentCard(
                assignment: resolved,
                onTap: () {},
              ),
              const Gap(Insets.xl),
              FptButton(
                label: l10n.downloadAssignment,
                variant: FptButtonVariant.secondary,
                expand: true,
                onPressed: () async {
                  try {
                    final result = await ref
                        .read(assignmentsRepositoryProvider)
                        .downloadAndOpenAssignmentFile(
                          assignmentId: resolved.id,
                          suggestedFileName: '${resolved.title}.pdf',
                        );
                    if (!context.mounted) return;
                    if (result.type == ResultType.done) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(l10n.assignmentDownloadSuccess),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    } else if (result.type == ResultType.noAppToOpen) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(l10n.assignmentDownloadSuccess),
                          backgroundColor: AppColors.info,
                        ),
                      );
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(result.message),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  } on DioException catch (e) {
                    if (!context.mounted) return;
                    final message = e.response?.statusCode == 404
                        ? l10n.assignmentNoAttachment
                        : describeError(e);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(message),
                        backgroundColor: AppColors.error,
                      ),
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    final message = e.toString().contains('EMPTY_ASSIGNMENT_FILE')
                        ? l10n.assignmentNoAttachment
                        : describeError(e);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(message),
                        backgroundColor: AppColors.error,
                      ),
                    );
                  }
                },
              ),
              if (!submitted) ...[
                const Gap(Insets.lg),
                FptButton(
                  label: l10n.submitAssignment,
                  expand: true,
                  onPressed: () => context.push(
                    AppRoutes.studentAssignmentSubmit(resolved.id),
                  ),
                ),
              ],
              if (reviewed && resolved.score != null) ...[
                const Gap(Insets.xl),
                Text(
                  l10n.assignmentGradeLabel,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const Gap(Insets.sm),
                Text(
                  '${resolved.score!.toStringAsFixed(1)} /10',
                  style: statStyle().copyWith(color: AppColors.success),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
