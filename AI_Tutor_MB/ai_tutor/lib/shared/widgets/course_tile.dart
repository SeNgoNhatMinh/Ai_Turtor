import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../shared/models/course.dart';
import 'fpt_card.dart';
import 'status_pill.dart';

class CourseTile extends StatelessWidget {
  const CourseTile({
    super.key,
    required this.course,
    this.onTap,
    this.compact = false,
  });

  final Course course;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final width = compact ? 220.0 : null;
    return SizedBox(
      width: width,
      child: FptCard(
        onTap: onTap,
        padding: EdgeInsets.all(compact ? Insets.md : Insets.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    course.code,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.primaryDark,
                    ),
                  ),
                ),
                StatusPill(domain: 'enrollment', value: course.status),
              ],
            ),
            const Gap(Insets.sm),
            Text(
              course.name,
              style: Theme.of(context).textTheme.titleMedium,
              maxLines: compact ? 2 : 3,
              overflow: TextOverflow.ellipsis,
            ),
            if (course.className != null) ...[
              const Gap(Insets.xs),
              Text(
                course.className!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (course.semester != null) ...[
              const Gap(Insets.xs),
              Text(
                course.semester!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
