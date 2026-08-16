import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/theme/theme_extensions.dart';
import '../../shared/models/senior_queue.dart';
import 'status_pill.dart';

class KnowledgeCandidateCard extends StatelessWidget {
  const KnowledgeCandidateCard({
    super.key,
    required this.candidate,
    this.onTap,
    this.disabled = false,
    this.disabledReason,
  });

  final KnowledgeCandidateItem candidate;
  final VoidCallback? onTap;
  final bool disabled;
  final String? disabledReason;

  @override
  Widget build(BuildContext context) {
    final fpt = context.fpt;
    final borderColor = switch (candidate.status) {
      'INDEXED' => AppColors.success,
      'REJECTED' => AppColors.error,
      _ => AppColors.warning,
    };

    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: Material(
        color: fpt.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        elevation: 0,
        child: InkWell(
          onTap: disabled ? null : onTap,
          borderRadius: BorderRadius.circular(Radii.lg),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.lg),
              border: Border.all(color: fpt.borderHairline),
              boxShadow: Shadows.md,
            ),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Radii.lg),
                border: Border(left: BorderSide(color: borderColor, width: 4)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(Insets.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            candidate.courseName ?? '—',
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(color: fpt.textPrimary),
                          ),
                        ),
                        StatusPill(
                          domain: 'candidate',
                          value: candidate.status,
                        ),
                      ],
                    ),
                    if (candidate.candidateType != null) ...[
                      const Gap(Insets.xs),
                      Text(
                        candidate.candidateType!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: fpt.textTertiary,
                        ),
                      ),
                    ],
                    const Gap(Insets.md),
                    Text(
                      candidate.question ?? '—',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: fpt.textSecondary,
                      ),
                    ),
                    if (disabled && disabledReason != null) ...[
                      const Gap(Insets.sm),
                      Row(
                        children: [
                          const Icon(
                            LucideIcons.info,
                            size: 14,
                            color: AppColors.warning,
                          ),
                          const Gap(Insets.sm),
                          Expanded(
                            child: Text(
                              disabledReason!,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: AppColors.warning),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
