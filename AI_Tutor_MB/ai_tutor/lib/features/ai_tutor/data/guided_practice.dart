// Port of web `guidedPracticeFill.js`: finds the "Bài tập có hướng dẫn"
// section of an AI answer and splits its exercise into text and blanks.

final _sectionHeading = RegExp(
  r'^(#{1,6})\s+(?:\d+\.\s*)?bài tập có hướng dẫn\s*$',
  caseSensitive: false,
);
final _sectionEnd = RegExp(
  r'^(#{1,6})\s+(?:\d+\.\s*)?(?:lưu ý để học tốt hơn|kiến thức bổ sung|tự thực hành|kiểm tra hiểu|understanding check|quiz tự luyện|học chuyên sâu|nguồn tài liệu|bài tiếp theo|gợi ý học tập)',
  caseSensitive: false,
);
final _fence = RegExp(r'```[^\n]*\n([\s\S]*?)```');
final _blank = RegExp(
  r'_{3,}|【\s*】|\[\s*(?:\.{2,}|blank)\s*\]|\bTODO\b',
  caseSensitive: false,
);

sealed class PracticeSegment {
  const PracticeSegment();
}

class PracticeText extends PracticeSegment {
  const PracticeText(this.text);
  final String text;
}

class PracticeBlank extends PracticeSegment {
  const PracticeBlank(this.index);
  final int index;
}

class GuidedPractice {
  const GuidedPractice({
    required this.before,
    required this.section,
    required this.after,
    required this.prose,
    required this.code,
    required this.segments,
    required this.blankCount,
  });

  /// Markdown before / after the exercise section.
  final String before;
  final String section;
  final String after;

  /// Instruction sentence written above the exercise.
  final String prose;
  final String code;
  final List<PracticeSegment> segments;
  final int blankCount;

  /// At least one answer box, even when the model wrote no `____`.
  int get inputCount => blankCount > 0 ? blankCount : 1;
}

String _fillableBody(String body) {
  return body
      .replaceAll(r'\n', '\n')
      .replaceAll(RegExp(r'```[^\n]*\n?'), '')
      .replaceAll('```', '')
      .trim();
}

GuidedPractice? extractGuidedPractice(String markdown) {
  final lines = markdown.replaceAll('\r\n', '\n').split('\n');
  final start = lines.indexWhere(
    (line) => _sectionHeading.hasMatch(line.trim()),
  );
  if (start < 0) return null;

  var end = lines.length;
  for (var index = start + 1; index < lines.length; index++) {
    if (_sectionEnd.hasMatch(lines[index].trim())) {
      end = index;
      break;
    }
  }

  final body = lines.sublist(start + 1, end).join('\n').trim();
  if (body.isEmpty) return null;
  final fence = _fence.firstMatch(body);
  final code = fence == null
      ? ''
      : fence[1]!.replaceFirst(RegExp(r'\n$'), '');
  final prose = (fence == null ? body : body.replaceFirst(_fence, ''))
      .split('\n')
      .map((line) => line.trim())
      .where((line) => line.isNotEmpty && !line.startsWith('#'))
      .take(2)
      .join(' ')
      .trim();

  final source = _fillableBody(body).isNotEmpty
      ? _fillableBody(body)
      : (code.isNotEmpty ? code : body);
  final segments = <PracticeSegment>[];
  var cursor = 0;
  var blanks = 0;
  for (final match in _blank.allMatches(source)) {
    segments.add(PracticeText(source.substring(cursor, match.start)));
    segments.add(PracticeBlank(blanks++));
    cursor = match.end;
  }
  segments.add(PracticeText(source.substring(cursor)));

  return GuidedPractice(
    before: lines.sublist(0, start).join('\n').trim(),
    section: lines.sublist(start, end).join('\n').trim(),
    after: lines.sublist(end).join('\n').trim(),
    // With a fenced exercise the sentence above it is the instruction; when
    // the blanks sit in prose, the prose is already the exercise.
    prose: fence == null && blanks > 0 ? '' : prose,
    code: code,
    segments: segments,
    blankCount: blanks,
  );
}

String _wrapPracticeMessage(String body) {
  return 'Mình điền bài tập có hướng dẫn như sau:\n\n```\n${body.trim()}\n```\n\n'
      'Nhờ kiểm tra phần mình điền, chưa đưa lời giải hoàn chỉnh.';
}

/// Message sent to AI Tutor with the filled exercise (same text as web).
/// Empty while any blank is still empty.
String filledPracticeMessage(GuidedPractice practice, List<String> values) {
  final filled = values.map((value) => value.trim()).toList();
  if (filled.length < practice.inputCount || filled.any((v) => v.isEmpty)) {
    return '';
  }
  if (practice.blankCount == 0) {
    final exercise = practice.code.isNotEmpty ? practice.code : practice.section;
    return _wrapPracticeMessage('$exercise\n\nChỗ mình điền: ${filled.first}');
  }
  final body = practice.segments.map((segment) {
    return switch (segment) {
      PracticeText(:final text) => text,
      PracticeBlank(:final index) => filled[index],
    };
  }).join();
  return _wrapPracticeMessage(body);
}
