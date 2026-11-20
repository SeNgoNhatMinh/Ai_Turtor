import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/theme/theme_extensions.dart';
import '../../../../core/utils/study_suggestion_prompt.dart';

const _suggestionPageSize = 5;

final _curriculumStarterHeading = RegExp(
  r'^(?:\d+(?:\.\d+)*[.)]?\s*)?gợi ý học tập\s*$',
  caseSensitive: false,
);
final _curriculumStarterNoise = RegExp(
  r'^(?:bạn có thể bắt đầu|mẹo\b)',
  caseSensitive: false,
);
final _numberedCurriculumPrefix = RegExp(
  r'^(?:bài|bai)\s+\d+\s*[:：.\-–—]\s*',
  caseSensitive: false,
);

List<StudyPathSuggestion> parseCurriculumStudySuggestions(String markdown) {
  final result = <StudyPathSuggestion>[];
  final seen = <String>{};
  for (final raw in parseBulletsUnderHeadings(
    markdown,
    _curriculumStarterHeading,
  )) {
    final item = _collapseRepeatedCurriculumTitle(raw);
    if (_curriculumStarterNoise.hasMatch(item.title) ||
        item.title.endsWith(':')) {
      continue;
    }
    final key = item.title.toLowerCase();
    if (!seen.add(key)) continue;
    result.add(item);
  }
  return result;
}

StudyPathSuggestion _collapseRepeatedCurriculumTitle(
  StudyPathSuggestion suggestion,
) {
  final parts = suggestion.title
      .split(RegExp(r'\s*\|\|\s*'))
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.length < 2) return suggestion;

  final firstKey = _curriculumTitleKey(parts.first);
  final allRepeated =
      firstKey.isNotEmpty &&
      parts.skip(1).every((part) => _curriculumTitleKey(part) == firstKey);
  if (!allRepeated) return suggestion;

  final title = parts.first;
  return StudyPathSuggestion(title: title, suggestionText: title);
}

String _curriculumTitleKey(String value) {
  return value
      .replaceFirst(_numberedCurriculumPrefix, '')
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), ' ')
      .replaceAll(RegExp(r'[.!?]+$'), '')
      .trim();
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

class CurriculumStudySuggestions extends StatefulWidget {
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
  State<CurriculumStudySuggestions> createState() =>
      _CurriculumStudySuggestionsState();
}

class _CurriculumStudySuggestionsState
    extends State<CurriculumStudySuggestions> {
  final _searchController = TextEditingController();
  var _query = '';
  var _visibleCount = _suggestionPageSize;

  @override
  void didUpdateWidget(CurriculumStudySuggestions oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_suggestionSignature(oldWidget.suggestions) ==
        _suggestionSignature(widget.suggestions)) {
      return;
    }
    _searchController.clear();
    _query = '';
    _visibleCount = _suggestionPageSize;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _updateQuery(String value) {
    setState(() {
      _query = value.trim().toLowerCase();
      _visibleCount = _suggestionPageSize;
    });
  }

  void _clearQuery() {
    _searchController.clear();
    _updateQuery('');
  }

  static String _suggestionSignature(List<StudyPathSuggestion> suggestions) {
    return suggestions.map((item) => item.suggestionText).join('\u0000');
  }

  @override
  Widget build(BuildContext context) {
    if (widget.suggestions.isEmpty) return const SizedBox.shrink();
    final colors = context.fpt;
    final filteredSuggestions = _query.isEmpty
        ? widget.suggestions
        : widget.suggestions
              .where(
                (item) =>
                    item.title.toLowerCase().contains(_query) ||
                    item.suggestionText.toLowerCase().contains(_query),
              )
              .toList();
    final visibleSuggestions = filteredSuggestions.take(_visibleCount).toList();
    final remainingCount =
        filteredSuggestions.length - visibleSuggestions.length;
    final hasMore = remainingCount > 0;
    final canCollapse = _visibleCount > _suggestionPageSize;

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
          TextField(
            controller: _searchController,
            onChanged: _updateQuery,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Tìm bài học…',
              prefixIcon: Icon(
                LucideIcons.search,
                size: 18,
                color: colors.textSecondary,
              ),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      onPressed: _clearQuery,
                      tooltip: 'Xóa tìm kiếm',
                      icon: Icon(
                        LucideIcons.x,
                        size: 18,
                        color: colors.textSecondary,
                      ),
                    ),
              filled: true,
              fillColor: colors.card,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: Insets.md,
                vertical: Insets.sm,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(Radii.md),
                borderSide: BorderSide(color: colors.borderHairline),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(Radii.md),
                borderSide: const BorderSide(
                  color: AppColors.focusRing,
                  width: 1.5,
                ),
              ),
            ),
          ),
          const Gap(Insets.md),
          if (visibleSuggestions.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: Insets.md),
              child: Text(
                'Không tìm thấy bài học phù hợp.',
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
              ),
            )
          else
            for (var index = 0; index < visibleSuggestions.length; index++) ...[
              _CurriculumSuggestionRow(
                key: ValueKey(visibleSuggestions[index].suggestionText),
                suggestion: visibleSuggestions[index],
                enabled: widget.enabled,
                onTap: () =>
                    widget.onSelected(visibleSuggestions[index].suggestionText),
              ),
              if (index != visibleSuggestions.length - 1) const Gap(Insets.sm),
            ],
          if (hasMore || canCollapse) ...[
            const Gap(Insets.md),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: Insets.sm,
              runSpacing: Insets.xs,
              children: [
                if (hasMore)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _visibleCount += _suggestionPageSize;
                      });
                    },
                    style: TextButton.styleFrom(
                      minimumSize: const Size(48, 48),
                      foregroundColor: colors.textPrimary,
                    ),
                    child: Text(
                      'Hiển thị thêm '
                      '(${remainingCount.clamp(0, _suggestionPageSize)})',
                    ),
                  ),
                if (canCollapse)
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _visibleCount = _suggestionPageSize;
                      });
                    },
                    style: TextButton.styleFrom(
                      minimumSize: const Size(48, 48),
                      foregroundColor: colors.textSecondary,
                    ),
                    icon: const Icon(LucideIcons.chevronUp, size: 17),
                    label: const Text('Ẩn bớt'),
                  ),
              ],
            ),
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
