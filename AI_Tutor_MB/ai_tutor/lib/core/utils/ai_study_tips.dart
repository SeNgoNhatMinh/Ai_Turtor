/// Preprocess markdown study tips giống FE web (`markdownPreprocessor.enhanceStudyTips`).
library;

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

    if (!inStudyTips || trimmed.isEmpty || _hasMarkdownLink(trimmed)) {
      output.add(line);
      continue;
    }

    final bullet = RegExp(r'^(\s*[-*+]\s+)(.+)$').firstMatch(line);
    if (bullet != null) {
      output.add(
        '${bullet.group(1)}${_studyTipLink(bullet.group(2)!.trim(), tipIndex++)}',
      );
      continue;
    }

    final ordered = RegExp(r'^(\s*\d+[.)]\s+)(.+)$').firstMatch(line);
    if (ordered != null) {
      output.add(
        '${ordered.group(1)}${_studyTipLink(ordered.group(2)!.trim(), tipIndex++)}',
      );
      continue;
    }

    output.add('- ${_studyTipLink(trimmed, tipIndex++)}');
  }

  return output.join('\n');
}

bool _hasMarkdownLink(String text) {
  return RegExp(r'\[[^\]]+\]\([^)]+\)').hasMatch(text);
}

String _studyTipLink(String label, int index) {
  final escaped = label.replaceAll('[', r'\[').replaceAll(']', r'\]');
  return '[$escaped](#ai-study-tip-$index)';
}

bool isStudyTipHref(String? href) {
  return href != null && href.startsWith('#ai-study-tip-');
}
