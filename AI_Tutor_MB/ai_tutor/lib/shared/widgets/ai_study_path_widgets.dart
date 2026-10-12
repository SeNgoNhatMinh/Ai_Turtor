import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

final nextLessonTipPattern = RegExp(
  r'^(?:bắt đầu\s+|bat dau\s+)?(?:bài|bai)\s+\d+',
  caseSensitive: false,
);

bool isNextLessonStudyTip(String text) {
  return nextLessonTipPattern.hasMatch(text.trim());
}

/// Danh sách "Bắt đầu bài N" trong câu trả lời — giữ số thứ tự, bấm để học.
class AiLessonChoiceList extends StatelessWidget {
  const AiLessonChoiceList({super.key, required this.lessons, this.onSelect});

  final List<String> lessons;
  final ValueChanged<String>? onSelect;

  @override
  Widget build(BuildContext context) {
    if (lessons.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: Insets.xs, bottom: Insets.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var index = 0; index < lessons.length; index++)
            InkWell(
              onTap: onSelect == null ? null : () => onSelect!(lessons[index]),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 28,
                      child: Text(
                        '${index + 1}.',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: AppColors.textPrimary,
                          height: 1.45,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        lessons[index],
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: onSelect == null
                              ? AppColors.textPrimary
                              : AppColors.studyTipLink,
                          decoration: onSelect == null
                              ? TextDecoration.none
                              : TextDecoration.underline,
                          decorationColor: AppColors.studyTipLink,
                          height: 1.45,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Chip bài tiếp theo — khớp web `ai-answer-study-tip--lesson`.
class AiNextLessonChip extends StatelessWidget {
  const AiNextLessonChip({super.key, required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final child = Text(
      label,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
        color: AppColors.nextLessonChipText,
        fontSize: 13.5,
        height: 1.35,
      ),
    );
    return Semantics(
      button: onTap != null,
      label: label,
      hint: 'Bắt đầu bài này với AI Tutor',
      child: Material(
        color: AppColors.nextLessonChipFill,
        shape: const StadiumBorder(
          side: BorderSide(color: AppColors.nextLessonChipBorder),
        ),
        child: InkWell(
          onTap: onTap,
          customBorder: const StadiumBorder(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            child: child,
          ),
        ),
      ),
    );
  }
}

class AiStudyPathBlock extends StatelessWidget {
  const AiStudyPathBlock({
    super.key,
    required this.heading,
    required this.tips,
    required this.isNextLessonHeading,
    this.onStudyTipTap,
  });

  final String heading;
  final List<String> tips;
  final bool isNextLessonHeading;
  final ValueChanged<String>? onStudyTipTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: Insets.md, bottom: Insets.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            heading,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.splashNavy,
            ),
          ),
          const SizedBox(height: Insets.xs),
          for (final tip in tips)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: EdgeInsets.only(
                      top: isNextLessonStudyTip(tip) || isNextLessonHeading
                          ? 10
                          : 8,
                      right: 8,
                    ),
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppColors.accent,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Expanded(
                    child: isNextLessonStudyTip(tip) || isNextLessonHeading
                        ? Align(
                            alignment: Alignment.centerLeft,
                            child: AiNextLessonChip(
                              label: tip,
                              onTap: onStudyTipTap == null
                                  ? null
                                  : () => onStudyTipTap!(tip),
                            ),
                          )
                        : InkWell(
                            onTap: onStudyTipTap == null
                                ? null
                                : () => onStudyTipTap!(tip),
                            child: Text(
                              tip,
                              style: Theme.of(context).textTheme.bodyLarge
                                  ?.copyWith(
                                    color: onStudyTipTap == null
                                        ? AppColors.textPrimary
                                        : AppColors.studyTipLink,
                                    decoration: onStudyTipTap == null
                                        ? TextDecoration.none
                                        : TextDecoration.underline,
                                    decorationColor: AppColors.studyTipLink,
                                    height: 1.45,
                                  ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
