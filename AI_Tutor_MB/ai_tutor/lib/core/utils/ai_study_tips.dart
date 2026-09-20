/// Preprocess markdown study tips giống FE web (`markdownPreprocessor.enhanceStudyTips`).
library;

import 'study_suggestion_prompt.dart' as study;

final _studyTipHeading = RegExp(
  r'^#{1,6}\s*lưu ý',
  caseSensitive: false,
  unicode: true,
);

final _sectionHeading = RegExp(r'^#{1,6}\s+\S');

bool isStudyTipHeadingLine(String line) {
  final trimmed = line.trim();
  if (_studyTipHeading.hasMatch(trimmed)) return true;
  final lower = trimmed.toLowerCase();
  return lower.contains('lưu ý để học tốt hơn');
}

bool hasStudyTipsSection(String content) {
  return content.split('\n').any(isStudyTipHeadingLine);
}

String enhanceStudyTips(String text) {
  final lines = text.split('\n');
  final output = <String>[];
  var inStudyTips = false;
  var tipIndex = 1;

  for (final line in lines) {
    final trimmed = line.trim();

    if (isStudyTipHeadingLine(line)) {
      inStudyTips = true;
      output.add(line);
      continue;
    }

    if (inStudyTips && _sectionHeading.hasMatch(trimmed)) {
      inStudyTips = false;
      output.add(line);
      continue;
    }

    if (!inStudyTips ||
        trimmed.isEmpty ||
        _isTableLine(line) ||
        _isFenceLine(line) ||
        _isSourceHeading(trimmed) ||
        _hasMarkdownLink(trimmed)) {
      output.add(line);
      continue;
    }

    final bullet = RegExp(r'^(\s*[-*+]\s+)(.+)$').firstMatch(line);
    if (bullet != null) {
      if (_isEmptyStudyTipPlaceholder(bullet.group(2)!)) continue;
      output.add(
        '${bullet.group(1)}${_studyTipLink(bullet.group(2)!.trim(), tipIndex++)}',
      );
      continue;
    }

    final ordered = RegExp(r'^(\s*\d+[.)]\s+)(.+)$').firstMatch(line);
    if (ordered != null) {
      if (_isEmptyStudyTipPlaceholder(ordered.group(2)!)) continue;
      output.add(
        '${ordered.group(1)}${_studyTipLink(ordered.group(2)!.trim(), tipIndex++)}',
      );
      continue;
    }

    if (_isEmptyStudyTipPlaceholder(trimmed)) continue;
    output.add('- ${_studyTipLink(trimmed, tipIndex++)}');
  }

  return output.join('\n');
}

bool _hasMarkdownLink(String text) {
  return RegExp(r'\[[^\]]+\]\([^)]+\)').hasMatch(text);
}

bool _isFenceLine(String line) => RegExp(r'^\s*(```|~~~)').hasMatch(line);

bool _isTableLine(String line) {
  final trimmed = line.trim();
  if (!trimmed.contains('|')) return false;
  final cells = trimmed
      .replaceFirst(RegExp(r'^\|'), '')
      .replaceFirst(RegExp(r'\|$'), '')
      .split('|');
  return cells.length >= 2;
}

bool _isSourceHeading(String line) {
  final lower = line.toLowerCase().trim();
  return lower.contains('nguồn tài liệu') ||
      lower.contains('source material') ||
      lower.contains('sources used') ||
      lower.contains('tài liệu đã dùng');
}

bool _isEmptyStudyTipPlaceholder(String text) {
  final plain = text
      .trim()
      .replaceFirst(RegExp(r'^\*\*([\s\S]+)\*\*$'), r'$1')
      .replaceFirst(RegExp(r'^__([\s\S]+)__$'), r'$1')
      .replaceFirst(RegExp(r'^`([\s\S]+)`$'), r'$1')
      .replaceFirst(RegExp(r'\s*[:：]\s*$'), '')
      .trim();
  if (plain.isEmpty) return true;
  return RegExp(r'^[\s–—_*+.·•…-]+$', unicode: true).hasMatch(plain);
}

String _studyTipLink(String label, int index) {
  final escaped = label.replaceAll('[', r'\[').replaceAll(']', r'\]');
  return '[$escaped](#ai-study-tip-$index)';
}

bool isStudyTipHref(String? href) {
  return href != null && href.startsWith('#ai-study-tip-');
}

/// Prompt "Học ngay" — khớp FE web `buildStudySuggestionPrompt`.
String buildStudySuggestionPrompt(
  String suggestionText, {
  String? improvePlanId,
  String? planItemId,
}) {
  return study.buildStudySuggestionPrompt(
    suggestionText,
    improvePlanId: improvePlanId,
    planItemId: planItemId,
  );
}
