// Port of the web `normalizeAiMarkdown` pipeline
// (Ai_Turtor_FE/src/utils/markdownPreprocessor.js) so mobile renders AI
// answers with the same structure as the web chat.
//
// Steps that only matter to the web renderer (KaTeX math, source-section
// re-listing, study-tip links, long-prose splitting) are handled elsewhere on
// mobile or intentionally skipped.

/// Normalizes messy AI markdown into clean GFM for flutter_markdown.
/// Idempotent and safe on partial (streaming/reveal) text.
String normalizeAiMarkdown(String input) {
  var text = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  if (text.trim().isEmpty) return '';

  text = text.replaceAll(RegExp(r'[ \t]+$', multiLine: true), '');
  text = _collapseBlankLines(text);
  text = _stripPromptLeak(text);
  text = _stripNumberedCurriculumFromNormalAnswer(text);

  final vault = _BlockVault();
  text = vault.protect(text);

  text = _normalizeVietnameseSectionLabels(text);
  text = _hardFixInlineTables(text);
  text = _normalizeLists(text);
  text = _repairTables(text);
  text = _inferHeadings(text);
  text = text.replaceAll(RegExp(r'^>[ \t]*', multiLine: true), '> ');

  text = vault.restore(text);
  text = _collapseBlankLines(text);
  return _dropEmptyHeadingsAndCloseNumbers(text);
}

/// Last-resort readable text when a markdown block cannot be rendered:
/// keeps the words and line structure, removes markdown syntax.
String markdownToPlainText(String markdown) {
  final lines = <String>[];
  for (final raw in markdown.replaceAll('\r\n', '\n').split('\n')) {
    var line = raw;
    if (_isFenceLine(line)) continue;
    if (RegExp(r'^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$')
        .hasMatch(line)) {
      continue;
    }
    line = line
        .replaceFirst(RegExp(r'^\s{0,3}#{1,6}\s+'), '')
        .replaceFirst(RegExp(r'^\s{0,3}>\s?'), '')
        .replaceFirstMapped(RegExp(r'^(\s*)[-*+]\s+'), (m) => '${m[1]}• ')
        .replaceAllMapped(RegExp(r'!?\[([^\]]*)\]\([^)]*\)'), (m) => m[1]!)
        .replaceAllMapped(RegExp(r'(\*\*|__)(.+?)\1'), (m) => m[2]!)
        .replaceAllMapped(
          RegExp(r'(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])'),
          (m) => m[1]!,
        )
        .replaceAllMapped(RegExp(r'`([^`\n]+)`'), (m) => m[1]!)
        .replaceAllMapped(RegExp(r'~~(.+?)~~'), (m) => m[1]!);
    final trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      line = _splitCells(trimmed).where((c) => c.isNotEmpty).join('  ·  ');
    }
    lines.add(line);
  }
  return _collapseBlankLines(lines.join('\n')).trim();
}

/// Splits markdown into top-level blocks separated by blank lines, keeping
/// fenced code blocks whole.
List<String> splitMarkdownBlocks(String markdown) {
  final blocks = <String>[];
  final current = <String>[];
  var inFence = false;
  void flush() {
    if (current.any((line) => line.trim().isNotEmpty)) {
      blocks.add(current.join('\n'));
    }
    current.clear();
  }

  for (final line in markdown.replaceAll('\r\n', '\n').split('\n')) {
    if (_isFenceLine(line)) inFence = !inFence;
    if (!inFence && line.trim().isEmpty) {
      flush();
      continue;
    }
    current.add(line);
  }
  flush();
  return blocks;
}

String _collapseBlankLines(String text) =>
    text.replaceAll(RegExp(r'\n{3,}'), '\n\n');

// ---------------------------------------------------------------------------
// Vietnamese helpers
// ---------------------------------------------------------------------------

const _vnFrom =
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const _vnTo =
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

/// Lower-case, accent-free key used to compare Vietnamese section titles.
String vietnameseSectionKey(String value) {
  final lower = value.toLowerCase();
  final buffer = StringBuffer();
  for (final rune in lower.runes) {
    final char = String.fromCharCode(rune);
    final index = _vnFrom.indexOf(char);
    buffer.write(index < 0 ? char : _vnTo[index]);
  }
  return buffer.toString().replaceAll(RegExp(r'\s+'), ' ').trim();
}

String _unwrapSimpleDecoration(String value) {
  var text = value.trim();
  text = text
      .replaceFirstMapped(RegExp(r'^\*\*([\s\S]+)\*\*$'), (m) => m[1]!)
      .trim();
  text = text.replaceFirstMapped(RegExp(r'^__([\s\S]+)__$'), (m) => m[1]!).trim();
  text = text.replaceFirstMapped(RegExp(r'^`([\s\S]+)`$'), (m) => m[1]!).trim();
  return text.replaceFirst(RegExp(r'\s*[:：]\s*$'), '').trim();
}

const _exactSectionLabels = <String, String>{
  'tai lieu mon hoc': 'Tài liệu môn học',
  'theo tai lieu mon hoc': 'Theo tài liệu môn học',
  'vi du nho': 'Ví dụ nhỏ',
  'vi du nho neu can': 'Ví dụ nhỏ nếu cần',
  'luu y de hoc tot hon': 'Lưu ý để học tốt hơn',
  'nguon tai lieu da dung': 'Nguồn tài liệu đã dùng',
  'chan doan van de': 'Chẩn đoán vấn đề',
  'nguyen nhan co the': 'Nguyên nhân có thể',
  'cach debug tung buoc': 'Cách debug từng bước',
  'goi y sua': 'Gợi ý sửa',
  'chu de nen on lai': 'Chủ đề nên ôn lại',
  'bai tiep theo': 'Bài tiếp theo',
  'kiem tra hieu': 'Kiểm tra hiểu',
  'hoc chuyen sau': 'Học chuyên sâu',
  'hoc tiep phan nay': 'Học tiếp phần này',
};

/// Restores Vietnamese accents on section titles a model wrote without them
/// ("## Kiem tra hieu" → "## Kiểm tra hiểu") so later parsers recognise them.
String _normalizeVietnameseSectionLabels(String text) {
  return text.split('\n').map((line) {
    final prefix = RegExp(r'^(\s*#{0,6}\s*)').firstMatch(line)?[1] ?? '';
    final body = line.substring(prefix.length).trim();
    if (body.isEmpty || body.length > 90) return line;
    // Only touch text written without accents; accented titles are kept.
    if (vietnameseSectionKey(body) != body.toLowerCase()) return line;
    final unwrapped = _unwrapSimpleDecoration(body)
        .replaceFirst(RegExp(r'^\d+\.\s+'), '');
    final label = _exactSectionLabels[vietnameseSectionKey(unwrapped)];
    return label == null ? line : '$prefix$label';
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Line detectors
// ---------------------------------------------------------------------------

bool _isHeadingLine(String line) => RegExp(r'^#{1,6}\s+').hasMatch(line.trim());

bool _isFenceLine(String line) => RegExp(r'^\s*(```|~~~)').hasMatch(line);

bool _isListLine(String line) =>
    RegExp(r'^\s*(?:[-*+]\s+|\d+[.)]\s+)').hasMatch(line);

bool _isTableLine(String line) {
  final trimmed = line.trim();
  if (!trimmed.contains('|')) return false;
  return _splitCells(trimmed).length >= 2;
}

List<String> _splitCells(String line) {
  return line
      .trim()
      .replaceFirst(RegExp(r'^\|'), '')
      .replaceFirst(RegExp(r'\|$'), '')
      .split('|')
      .map((cell) => cell.trim())
      .toList();
}

// ---------------------------------------------------------------------------
// Prompt leaks and stray curriculum sections
// ---------------------------------------------------------------------------

final _promptLeakLine = RegExp(
  r"the prompt says|as per instruction|as instructed|i'?ll omit|i will omit|"
  r'numbered path provided|omit as per|wait,?\s+the prompt|otherwise omit|'
  r'name the next bài|leave it blank as instructed|include the heading|'
  r'actually,?\s+the prompt|numbered lesson path',
  caseSensitive: false,
);

bool _isPromptLeakLine(String line) {
  final text = line.trim();
  if (text.isEmpty) return false;
  if (RegExp('^\\s*[-*+]?\\s*["\'`“”]+#{1,6}\\s*').hasMatch(text)) return true;
  return _promptLeakLine.hasMatch(text);
}

String _stripPromptLeak(String text) {
  final withoutParens = text.replaceAll(
    RegExp(
      r'\(\s*(?:Omit as per|Wait,?\s+the prompt|The prompt says|as per instruction|Actually,?\s+the prompt)[\s\S]*?\)',
      caseSensitive: false,
    ),
    '',
  );
  final lines = withoutParens
      .split('\n')
      .where((line) => !_isPromptLeakLine(line))
      .toList();
  final output = <String>[];
  final nextLessonHeading = RegExp(
    r'^#{1,6}\s*bài tiếp theo\s*$',
    caseSensitive: false,
  );
  final validLesson = RegExp(
    r'^\s*[-*+]?\s*(?:bài|bai)\s+\d+\s*[:：.\-–—]',
    caseSensitive: false,
  );
  for (var index = 0; index < lines.length; index++) {
    final line = lines[index];
    if (!nextLessonHeading.hasMatch(line.trim())) {
      output.add(line);
      continue;
    }
    final body = <String>[];
    var cursor = index + 1;
    while (cursor < lines.length && !_isHeadingLine(lines[cursor])) {
      body.add(lines[cursor]);
      cursor++;
    }
    // Keep "Bài tiếp theo" only when it names a real lesson.
    if (body.any((item) => validLesson.hasMatch(item.trim()))) {
      output
        ..add(line)
        ..addAll(body);
    }
    index = cursor - 1;
  }
  return _collapseBlankLines(output.join('\n')).trim();
}

String _dropHeadingSection(String text, RegExp heading) {
  final lines = text.split('\n');
  final output = <String>[];
  for (var index = 0; index < lines.length; index++) {
    if (!heading.hasMatch(lines[index].trim())) {
      output.add(lines[index]);
      continue;
    }
    var cursor = index + 1;
    while (cursor < lines.length && !_isHeadingLine(lines[cursor])) {
      cursor++;
    }
    index = cursor - 1;
  }
  return _collapseBlankLines(output.join('\n')).trim();
}

String _stripNumberedCurriculumFromNormalAnswer(String text) {
  final isNormalQa = RegExp(
    r'^#{1,6}\s*(?:\d+\.\s*)?theo tài liệu môn học\s*$',
    caseSensitive: false,
    multiLine: true,
  ).hasMatch(text);
  if (!isNormalQa) return text;
  var result = text;
  for (final title in const ['lộ trình học', 'bắt đầu thế nào', 'bài tiếp theo']) {
    result = _dropHeadingSection(
      result,
      RegExp('^#{1,6}\\s*$title\\s*\$', caseSensitive: false),
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Protect code fences and inline code from structural repairs
// ---------------------------------------------------------------------------

class _BlockVault {
  final _items = <String>[];

  String _store(String content) {
    final key = '\u0000BLK${_items.length}\u0000';
    _items.add(content);
    return key;
  }

  String protect(String text) {
    final output = <String>[];
    List<String>? block;
    for (final line in text.split('\n')) {
      if (block == null) {
        if (_isFenceLine(line)) {
          block = [line];
        } else {
          output.add(line);
        }
        continue;
      }
      block.add(line);
      if (_isFenceLine(line)) {
        output.add(_store(block.join('\n')));
        block = null;
      }
    }
    // An unfinished fence (streaming) is protected too.
    if (block != null) output.add(_store(block.join('\n')));

    return output
        .join('\n')
        .replaceAllMapped(
          RegExp(r'(`+)([^`\n]+?)\1'),
          (match) => _store(match[0]!),
        );
  }

  String restore(String text) {
    var result = text;
    for (var index = _items.length - 1; index >= 0; index--) {
      result = result.split('\u0000BLK$index\u0000').join(_items[index]);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/// "-item" → "- item", "1.item" → "1. item". Only `-`/`+` and numbers directly
/// followed by a letter are repaired, so "*italic*", "**bold**", "---", "-1"
/// and "1.5" stay intact.
String _normalizeLists(String text) {
  return text
      .replaceAllMapped(
        RegExp(r'^(\s*)[-+](\p{L})', multiLine: true, unicode: true),
        (m) => '${m[1]}- ${m[2]}',
      )
      .replaceAllMapped(
        RegExp(r'^(\s*)(\d+)[.)](\p{L})', multiLine: true, unicode: true),
        (m) => '${m[1]}${m[2]}. ${m[3]}',
      );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/// A model sometimes writes a whole table on one line:
/// "Text: | A | B | |---|---| |1|2|".
String _hardFixInlineTables(String text) {
  return text.replaceAllMapped(
    RegExp(r'([^\n|])[ \t]*(\|(?:[^|\n]+\|){1,}(?:[ \t]+\|(?:[^|\n]+\|){1,})+)'),
    (match) {
      final rows = match[2]!
          .replaceAll(RegExp(r'\|[ \t]+\|'), '|\n|')
          .replaceAll('||', '|\n|')
          .split('\n')
          .map((row) => row.trim())
          .where((row) => row.isNotEmpty);
      return '${match[1]}\n\n${rows.join('\n')}';
    },
  );
}

bool _isSeparatorRow(List<String> cells) =>
    cells.isNotEmpty && cells.every((c) => RegExp(r'^:?-{3,}:?$').hasMatch(c));

bool _looksLikeFakeHeader(List<String> cells) {
  final joined = cells.join();
  if (joined.isEmpty || RegExp(r'^table$', caseSensitive: false).hasMatch(joined)) {
    return true;
  }
  return cells.every((c) => c.isEmpty || RegExp(r'^:?-{2,}:?$').hasMatch(c));
}

bool _looksLikeCodeRow(List<String> cells) =>
    cells.any((c) => RegExp(r'[<>]|<%|%>|jsp:|@\w+').hasMatch(c));

String _wrapCodeishCell(String cell) {
  final value = cell.trim();
  if (value.isEmpty || value.contains('`')) return cell;
  if (RegExp(r'[<>]|<%|%>|jsp:|@WebServlet|doGet|doPost').hasMatch(value)) {
    return '`$value`';
  }
  return cell;
}

List<String> _buildGfmTable(List<String> rows) {
  final parsed = rows.map(_splitCells).toList();
  final cols = parsed.map((r) => r.length).reduce((a, b) => a > b ? a : b);
  final padded = [
    for (final row in parsed) [...row, for (var i = row.length; i < cols; i++) ''],
  ];

  var header = padded.first;
  var body = padded.sublist(1);
  if (_looksLikeFakeHeader(header) && padded.length > 1) {
    header = padded[1];
    body = padded.sublist(2);
  }
  if (body.isNotEmpty && _isSeparatorRow(body.first)) body = body.sublist(1);
  if (_looksLikeFakeHeader(header) && body.isNotEmpty) {
    header = body.first;
    body = body.sublist(1);
  }
  if (body.isNotEmpty && _isSeparatorRow(body.first)) body = body.sublist(1);
  if (_looksLikeCodeRow(header)) {
    final count = header.length < 2 ? 2 : header.length;
    body = [header, ...body];
    header = [for (var i = 0; i < count; i++) 'Cột ${i + 1}'];
  }

  final width = header.length > cols ? header.length : cols;
  header = [...header, for (var i = header.length; i < width; i++) ''];
  return [
    '| ${header.map(_wrapCodeishCell).join(' | ')} |',
    '| ${List.filled(width, '---').join(' | ')} |',
    for (final row in body)
      '| ${[...row, for (var i = row.length; i < width; i++) ''].map(_wrapCodeishCell).join(' | ')} |',
  ];
}

/// A GFM row starts or ends with a pipe. List items such as
/// "- Bài 1: X || 1 X" are never table rows.
bool _isTableRowCandidate(String line) {
  final trimmed = line.trim();
  if (_isListLine(trimmed) || !_isTableLine(trimmed)) return false;
  return trimmed.startsWith('|') || trimmed.endsWith('|');
}

String _repairTables(String text) {
  final cleaned = text.split('\n').map((line) {
    if (RegExp(r'^\s*TABLE\s*$', caseSensitive: false).hasMatch(line)) return '';
    if (!_isTableLine(line)) {
      final caption = RegExp(r'^\|\s*([^|]+)\s*\|\s*$').firstMatch(line.trim());
      if (caption != null &&
          !RegExp(r'^:?-{2,}:?$').hasMatch(caption[1]!.trim())) {
        return caption[1]!.trim();
      }
    }
    return line;
  });

  final out = <String>[];
  final buffer = <String>[];
  void flush() {
    // A single "a | b" line is prose, not a table.
    if (buffer.length >= 2) {
      out.addAll(_buildGfmTable(buffer));
    } else {
      out.addAll(buffer);
    }
    buffer.clear();
  }

  for (final line in cleaned) {
    if (_isTableRowCandidate(line)) {
      buffer.add(line);
    } else {
      flush();
      out.add(line);
    }
  }
  flush();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

const _sectionBoundary = r'(?=\s|:|$)';
RegExp _sectionPattern(String label) =>
    RegExp('^$label$_sectionBoundary', caseSensitive: false, unicode: true);

final _headingPatterns = <RegExp>[
  RegExp(r'^tài liệu môn học$', caseSensitive: false),
  RegExp(r'^theo tài liệu môn học$', caseSensitive: false),
  for (final label in const [
    'mô tả',
    'cấu trúc',
    'giá trị',
    'thuật toán',
    'ví dụ',
    'lưu ý',
    'nguồn tài liệu',
    'công thức',
    'định nghĩa',
    'khái niệm',
    'chuyển đổi',
    'cơ số',
    'phần',
    'tóm tắt',
    'kết luận',
    'kết quả',
    'bước',
    'đặc điểm',
    'tính chất',
    'so sánh',
    'ứng dụng',
    'phương pháp',
    'chẩn đoán',
    'nguyên nhân',
    'cách debug',
    'gợi ý sửa',
    'chủ đề nên ôn',
  ])
    _sectionPattern(label),
  RegExp(r'^các .+ được đề cập$', caseSensitive: false),
];

/// Promotes short section titles written as plain text to `###` headings.
String _inferHeadings(String text) {
  return text.split('\n').map((line) {
    final t = line.trim();
    if (t.isNotEmpty &&
        t.length < 90 &&
        !_isHeadingLine(t) &&
        !_isListLine(t) &&
        !_isTableLine(t) &&
        !_isFenceLine(t) &&
        !t.contains('\u0000') &&
        // A sentence ("Ví dụ, khi gọi f(3) thì ...") is not a title.
        !RegExp(r'[.,;!?]\s+\S').hasMatch(t) &&
        _headingPatterns.any((pattern) => pattern.hasMatch(t))) {
      return '### $t';
    }
    return line;
  }).join('\n');
}

final _numberedHeading = RegExp(r'^(#{2,3})[ \t]+(\d+)\.\s+(.+?)\s*$');
final _anySectionHeading = RegExp(r'^(#{2,3})[ \t]+(?:\d+\.\s+)?(.+?)\s*$');
const _structuralHeadingKeys = <String>{
  'kiem tra hieu',
  'understanding check',
  'quiz tu luyen',
  'hoc chuyen sau',
  'hoc tiep phan nay',
  'bai tiep theo',
  'nguon tai lieu da dung',
  'lo trinh hoc',
  'bat dau the nao',
};

String _sectionKey(String title) =>
    vietnameseSectionKey(title.replaceFirst(RegExp(r'^\d+\.\s+'), ''));

/// Drops numbered titles with nothing under them and closes the numbering gap
/// ("## 1." "## 3." → "## 1." "## 2."). Numbering continues from the first
/// numbered title, so a split answer keeps its original numbers.
String _dropEmptyHeadingsAndCloseNumbers(String text) {
  final lines = text.split('\n');
  final insideFence = List<bool>.filled(lines.length, false);
  var inFence = false;
  for (var index = 0; index < lines.length; index++) {
    insideFence[index] = inFence;
    if (_isFenceLine(lines[index])) inFence = !inFence;
  }

  bool headingHasBody(int headingIndex) {
    for (var index = headingIndex + 1; index < lines.length; index++) {
      if (_isFenceLine(lines[index])) return true;
      if (insideFence[index] || lines[index].trim().isEmpty) continue;
      return !_anySectionHeading.hasMatch(lines[index]);
    }
    return false;
  }

  final kept = <String>[];
  for (var index = 0; index < lines.length; index++) {
    final heading = _numberedHeading.firstMatch(lines[index]);
    if (heading != null &&
        !insideFence[index] &&
        !_structuralHeadingKeys.contains(_sectionKey(heading[3]!)) &&
        !headingHasBody(index)) {
      continue;
    }
    kept.add(lines[index]);
  }

  int? number;
  inFence = false;
  return kept.map((line) {
    if (_isFenceLine(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    final heading = _numberedHeading.firstMatch(line);
    if (heading == null ||
        _structuralHeadingKeys.contains(_sectionKey(heading[3]!))) {
      return line;
    }
    number = number == null ? int.parse(heading[2]!) : number! + 1;
    return '${heading[1]} $number. ${heading[3]}';
  }).join('\n');
}
