import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/theme/app_typography.dart';
import '../../shared/models/escalation.dart';
import 'fpt_card.dart';

class MentorCard extends StatelessWidget {
  const MentorCard({
    super.key,
    required this.mentor,
    required this.onSelect,
    this.loading = false,
  });

  final MentorCandidate mentor;
  final VoidCallback? onSelect;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return FptCard(
      onTap: loading ? null : onSelect,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.primaryWash,
                backgroundImage: mentor.avatarUrl != null
                    ? NetworkImage(mentor.avatarUrl!)
                    : null,
                child: mentor.avatarUrl == null
                    ? Text(
                        mentor.fullName.isNotEmpty
                            ? mentor.fullName[0].toUpperCase()
                            : '?',
                        style: textTheme.titleMedium?.copyWith(
                          color: AppColors.primaryDark,
                        ),
                      )
                    : null,
              ),
              const Gap(Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(mentor.fullName, style: textTheme.titleMedium),
                    if (mentor.isClassTeacher)
                      Padding(
                        padding: const EdgeInsets.only(top: Insets.xs),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: Insets.sm,
                            vertical: Insets.xs,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.infoBg,
                            borderRadius: BorderRadius.circular(Radii.full),
                          ),
                          child: Text(
                            'Giảng viên lớp của bạn',
                            style: textTheme.bodySmall?.copyWith(
                              color: AppColors.info,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (mentor.matchScore != null)
                Text(
                  '${mentor.matchScore!.toStringAsFixed(0)}%',
                  style: statStyle().copyWith(
                    fontSize: 20,
                    color: AppColors.primaryDark,
                  ),
                ),
            ],
          ),
          if (mentor.rating != null ||
              mentor.sessionsCount != null ||
              mentor.responseTimeMinutes != null) ...[
            const Gap(Insets.md),
            Wrap(
              spacing: Insets.lg,
              runSpacing: Insets.sm,
              children: [
                if (mentor.rating != null)
                  _StatChip(
                    icon: LucideIcons.star,
                    label: mentor.rating!.toStringAsFixed(1),
                  ),
                if (mentor.sessionsCount != null)
                  _StatChip(
                    icon: LucideIcons.messageCircle,
                    label: '${mentor.sessionsCount} phiên',
                  ),
                if (mentor.responseTimeMinutes != null)
                  _StatChip(
                    icon: LucideIcons.clock,
                    label: '~${mentor.responseTimeMinutes} phút',
                  ),
              ],
            ),
          ],
          if (mentor.matchReason != null) ...[
            const Gap(Insets.md),
            Text(mentor.matchReason!, style: textTheme.bodyMedium),
          ],
          if (mentor.specializations.isNotEmpty) ...[
            const Gap(Insets.sm),
            Wrap(
              spacing: Insets.sm,
              runSpacing: Insets.sm,
              children: mentor.specializations
                  .map(
                    (s) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: Insets.sm,
                        vertical: Insets.xs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.raised,
                        borderRadius: BorderRadius.circular(Radii.sm),
                      ),
                      child: Text(s, style: textTheme.bodySmall),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textTertiary),
        const Gap(Insets.xs),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
