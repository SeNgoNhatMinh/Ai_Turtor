import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/models/course.dart';

class HomeCourseRow extends StatelessWidget {
  const HomeCourseRow({
    super.key,
    required this.course,
    required this.index,
    this.onTap,
  });

  final Course course;
  final int index;
  final VoidCallback? onTap;

  static const _badgePalettes = [
    (bg: Color(0xFFFFF0E6), fg: AppColors.primary),
    (bg: Color(0xFFE8F4FC), fg: AppColors.peacockBlue),
    (bg: Color(0xFFEAF6E4), fg: AppColors.splashHillGreen),
    (bg: Color(0xFFFFF8E1), fg: Color(0xFFE09B00)),
  ];

  @override
  Widget build(BuildContext context) {
    final palette = _badgePalettes[index % _badgePalettes.length];
    final prefix = _coursePrefix(course.code);
    final title = course.name.isNotEmpty
        ? '${course.code} — ${course.name}'
        : course.code;

    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(Radii.lg),
      elevation: 0,
      shadowColor: const Color(0x14000000),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: AppColors.borderHairline),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A211C18),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(Insets.lg),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: palette.bg,
                    borderRadius: BorderRadius.circular(Radii.md),
                  ),
                  child: Text(
                    prefix,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: palette.fg,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const Gap(Insets.md),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.splashNavy,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _coursePrefix(String code) {
    final cleaned = code.trim();
    if (cleaned.isEmpty) return '—';
    final match = RegExp(r'^[A-Za-z]+').firstMatch(cleaned);
    if (match != null) return match.group(0)!.toUpperCase();
    return cleaned.length >= 3
        ? cleaned.substring(0, 3).toUpperCase()
        : cleaned.toUpperCase();
  }
}
