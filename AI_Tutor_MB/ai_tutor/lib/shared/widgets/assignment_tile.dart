import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../../core/theme/app_tokens.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/formatters.dart';
import '../../shared/models/assignment.dart';
import 'fpt_card.dart';
import 'status_pill.dart';

class AssignmentTile extends StatelessWidget {
  const AssignmentTile({super.key, required this.assignment, this.onTap});

  final Assignment assignment;
  final VoidCallback? onTap;

  String get _statusValue {
    if (assignment.isOverdue) return 'LATE';
    if (assignment.status == 'REVIEWED') return 'REVIEWED';
    if (assignment.status == 'SUBMITTED') return 'SUBMITTED';
    return 'PENDING';
  }

  @override
  Widget build(BuildContext context) {
    final dueSoon = isDueWithinHours(assignment.dueAt, 48);
    return FptCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (assignment.courseName != null)
            Text(
              assignment.courseName!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          const Gap(Insets.xs),
          Text(
            assignment.title,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const Gap(Insets.sm),
          Row(
            children: [
              if (assignment.dueAt != null)
                Text(
                  formatDueCountdown(assignment.dueAt!),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: assignment.isOverdue || dueSoon
                        ? null
                        : Theme.of(context).textTheme.bodySmall?.color,
                  ),
                ),
              const Spacer(),
              if (_statusValue == 'LATE')
                StatusPill(domain: 'submission', value: 'LATE')
              else if (_statusValue == 'PENDING')
                StatusPill(domain: 'submission', value: 'PENDING')
              else
                StatusPill(domain: 'submission', value: _statusValue),
            ],
          ),
          if (assignment.score != null && assignment.status == 'REVIEWED') ...[
            const Gap(Insets.sm),
            Text(
              assignment.score!.toStringAsFixed(1),
              style: statStyle().copyWith(color: null),
            ),
          ],
        ],
      ),
    );
  }
}
