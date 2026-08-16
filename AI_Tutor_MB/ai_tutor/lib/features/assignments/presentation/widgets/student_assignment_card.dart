import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/models/assignment.dart';

enum AssignmentFilter { pending, submitted, reviewed }

class StudentAssignmentCard extends StatelessWidget {
  const StudentAssignmentCard({
    super.key,
    required this.assignment,
    required this.onTap,
    this.onSubmit,
  });

  final Assignment assignment;
  final VoidCallback onTap;
  final VoidCallback? onSubmit;

  bool get _isReviewed => assignment.status == 'REVIEWED';
  bool get _isSubmitted =>
      assignment.status == 'SUBMITTED' || assignment.status == 'REVIEWED';
  bool get _isUrgent =>
      !_isSubmitted && isDueWithinHours(assignment.dueAt, 12);

  Color get _courseColor {
    final code = _displayCourseCode;
    if (code.startsWith('DBI')) return AppColors.peacockBlue;
    if (code.startsWith('SWE')) return AppColors.leafGreen;
    return AppColors.primary;
  }

  String get _displayCourseCode =>
      assignment.courseCode ??
      assignment.courseId ??
      '—';

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.homeOrangeWash),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A211C18),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Stack(
            children: [
              if (_isUrgent)
                Positioned(
                  left: 0,
                  top: 0,
                  bottom: 0,
                  child: Container(
                    width: 4,
                    decoration: const BoxDecoration(
                      color: AppColors.error,
                      borderRadius: BorderRadius.horizontal(
                        left: Radius.circular(Radii.lg),
                      ),
                    ),
                  ),
                ),
              Padding(
                padding: EdgeInsets.only(left: _isUrgent ? 4 : 0),
                child: Padding(
                  padding: const EdgeInsets.all(Insets.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            _displayCourseCode,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(
                                  color: _courseColor,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const Spacer(),
                          _StatusTag(
                            assignment: assignment,
                            urgent: _isUrgent,
                          ),
                        ],
                      ),
                      const Gap(Insets.sm),
                      Text(
                        assignment.title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.splashNavy,
                        ),
                      ),
                      if (assignment.description != null) ...[
                        const Gap(Insets.xs),
                        Text(
                          assignment.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                      const Gap(Insets.lg),
                      if (_isReviewed && assignment.score != null) ...[
                        Text(
                          '${assignment.score!.toStringAsFixed(1)} /10',
                          style: statStyle().copyWith(
                            color: AppColors.success,
                            fontSize: 28,
                          ),
                        ),
                        if (assignment.feedback != null) ...[
                          const Gap(Insets.sm),
                          Text(
                            '"${assignment.feedback!}"',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: AppColors.textTertiary,
                                  fontStyle: FontStyle.italic,
                                ),
                          ),
                        ],
                      ] else ...[
                        Row(
                          children: [
                            const Icon(
                              Icons.calendar_today_outlined,
                              size: 16,
                              color: AppColors.textTertiary,
                            ),
                            const Gap(Insets.xs),
                            Text(
                              assignment.dueAt == null
                                  ? '—'
                                  : formatDueShort(assignment.dueAt!),
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: AppColors.textTertiary),
                            ),
                            const Spacer(),
                            if (!_isSubmitted && onSubmit != null)
                              _ActionButton(
                                label: l10n.submitAssignment,
                                filled: true,
                                onPressed: onSubmit!,
                              )
                            else if (_isSubmitted && !_isReviewed)
                              _ActionButton(
                                label: l10n.viewAssignment,
                                filled: false,
                                onPressed: onTap,
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.assignment, required this.urgent});

  final Assignment assignment;
  final bool urgent;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    late final String label;
    late final Color fg;
    late final Color bg;

    if (assignment.status == 'REVIEWED') {
      label = l10n.assignmentStatusReviewed;
      fg = AppColors.success;
      bg = AppColors.successBg;
    } else if (assignment.status == 'SUBMITTED') {
      label = l10n.assignmentStatusSubmitted;
      fg = AppColors.info;
      bg = AppColors.infoBg;
    } else if (urgent && assignment.dueAt != null) {
      label = formatDueCountdown(assignment.dueAt!);
      fg = AppColors.error;
      bg = AppColors.errorBg;
    } else if (assignment.dueAt != null) {
      label = formatDueCountdown(assignment.dueAt!);
      fg = AppColors.primary;
      bg = AppColors.primaryWash;
    } else {
      label = l10n.assignmentStatusPending;
      fg = AppColors.textSecondary;
      bg = const Color(0xFFF0F2F8);
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Insets.md,
        vertical: Insets.xs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Radii.full),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.filled,
    required this.onPressed,
  });

  final String label;
  final bool filled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? AppColors.primary : Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.full),
        side: filled
            ? BorderSide.none
            : const BorderSide(color: AppColors.primary),
      ),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(Radii.full),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Insets.lg,
            vertical: Insets.sm,
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: filled ? AppColors.onOrange : AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

bool assignmentMatchesFilter(Assignment assignment, AssignmentFilter filter) {
  return switch (filter) {
    AssignmentFilter.pending =>
      assignment.status != 'SUBMITTED' && assignment.status != 'REVIEWED',
    AssignmentFilter.submitted => assignment.status == 'SUBMITTED',
    AssignmentFilter.reviewed => assignment.status == 'REVIEWED',
  };
}
