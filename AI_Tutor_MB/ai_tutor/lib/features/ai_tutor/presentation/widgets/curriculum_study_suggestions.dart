import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/theme/theme_extensions.dart';
import '../../../../core/utils/study_suggestion_prompt.dart';

final _curriculumStarterHeading = RegExp(
  r'^(?:\d+(?:\.\d+)*[.)]?\s*)?gợi ý học tập\s*$',
  caseSensitive: false,
);
final _curriculumStarterNoise = RegExp(
  r'^(?:bạn có thể bắt đầu|mẹo\b)',
  caseSensitive: false,
);

List<StudyPathSuggestion> parseCurriculumStudySuggestions(String markdown) {
  return parseBulletsUnderHeadings(markdown, _curriculumStarterHeading)
      .where(
        (item) =>
            !_curriculumStarterNoise.hasMatch(item.title) &&
            !item.title.endsWith(':'),
      )
      .take(5)
      .toList();
}

List<StudyPathSuggestion> curriculumStudySuggestionsForMessage({
  required String markdown,
  required bool isUser,
  required bool hasInteractiveQuiz,
}) {
  if (isUser || hasInteractiveQuiz) {
    return const <StudyPathSuggestion>[];
  }
  return parseCurriculumStudySuggestions(markdown);
}

String stripCurriculumStudySuggestionSection(String markdown) {
  final kept = <String>[];
  var skipping = false;
  for (final raw in markdown.split(RegExp(r'\r?\n'))) {
    final trimmed = raw.trim();
    if (RegExp(r'^#{1,6}\s+\S').hasMatch(trimmed)) {
      final heading = trimmed.replaceFirst(RegExp(r'^#{1,6}\s*'), '');
      skipping = _curriculumStarterHeading.hasMatch(heading);
      if (skipping) continue;
    }
    if (!skipping) kept.add(raw);
  }
  return kept.join('\n').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
}

class CurriculumStudySuggestions extends StatelessWidget {
  const CurriculumStudySuggestions({
    super.key,
    required this.suggestions,
    required this.onSelected,
    this.enabled = true,
  });

  final List<StudyPathSuggestion> suggestions;
  final ValueChanged<String> onSelected;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (suggestions.isEmpty) return const SizedBox.shrink();
    final colors = context.fpt;

    return Container(
      padding: const EdgeInsets.all(Insets.md),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: colors.borderHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Gợi ý học tập',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const Gap(Insets.xs),
          Text(
            'Nhấn vào một gợi ý để hỏi AI Tutor ngay nội dung đó.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
          const Gap(Insets.md),
          for (var index = 0; index < suggestions.length; index++) ...[
            _CurriculumSuggestionRow(
              key: ValueKey(suggestions[index].suggestionText),
              suggestion: suggestions[index],
              enabled: enabled,
              onTap: () => onSelected(suggestions[index].suggestionText),
            ),
            if (index != suggestions.length - 1) const Gap(Insets.sm),
          ],
        ],
      ),
    );
  }
}

class _CurriculumSuggestionRow extends StatelessWidget {
  const _CurriculumSuggestionRow({
    super.key,
    required this.suggestion,
    required this.enabled,
    required this.onTap,
  });

  final StudyPathSuggestion suggestion;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.fpt;
    final foreground = enabled ? colors.textPrimary : colors.textTertiary;
    final actionColor = enabled ? colors.textSecondary : colors.textTertiary;

    return Semantics(
      button: true,
      enabled: enabled,
      label: 'Học ngay: ${suggestion.title}',
      child: Material(
        color: colors.card,
        borderRadius: BorderRadius.circular(Radii.md),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(Radii.md),
          focusColor: AppColors.focusRing.withValues(alpha: 0.10),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: Insets.md,
                vertical: Insets.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      suggestion.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: foreground,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const Gap(Insets.sm),
                  Icon(LucideIcons.bookOpenCheck, size: 19, color: actionColor),
                  const Gap(Insets.xs),
                  Text(
                    'Học ngay',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: actionColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
