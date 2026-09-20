// Luôn loại bỏ "Nguồn tài liệu đã dùng" và materialId khỏi câu trả lời AI trong chat.

import 'ai_study_tips.dart';

String sanitizeAiChatContent(String content) {
  return _stripSourceSection(content).trimRight();
}

/// Markdown hiển thị chat: bỏ nguồn, giữ "Lưu ý..." và biến bullet thành link bấm được.
String prepareAiChatMarkdown(String content) {
  final enhanced = enhanceStudyTips(sanitizeAiChatContent(content));
  return splitLongProseParagraphs(enhanced);
}

/// Làm sạch nội dung AI lưu kèm escalation (bỏ text debug n8n/backend).
String sanitizeEscalationAiPreview(String content) {
  final trimmed = sanitizeAiChatContent(content);
  if (trimmed.isEmpty) return trimmed;

  final lower = trimmed.toLowerCase();
  if (lower.contains('ai tutor is not confident') ||
      lower.contains('escalated by n8n') ||
      lower.contains('escalated by') ||
      lower.contains('reason:')) {
    return 'AI Tutor chưa đủ tin cậy để trả lời câu hỏi này. '
        'Bạn có thể trao đổi trực tiếp với giảng viên/mentor bên dưới.';
  }
  return trimmed;
}

String _stripSourceSection(String content) {
  final lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (_isSourceSectionHeaderLine(lines[i])) {
      return lines.sublist(0, i).join('\n').trimRight();
    }
  }

  // Phòng trường hợp backend trả materialId rời không kèm header.
  final filtered = lines
      .where((line) => !_isSourceSectionHeaderLine(line))
      .where((line) => !_looksLikeMaterialIdLine(_normalizeSourceLine(line)))
      .where((line) => !_looksLikeRawMaterialId(line.trim()))
      .toList();
  return filtered.join('\n').trimRight();
}

bool _isSourceSectionHeaderLine(String line) {
  final lower = line.toLowerCase().trim();
  if (lower.contains('nguồn tài liệu') ||
      lower.contains('source material') ||
      lower.contains('sources used') ||
      lower.contains('tài liệu đã dùng')) {
    return true;
  }
  final normalized = _normalizeSourceLine(line);
  return normalized.contains('nguon tai lieu da dung') ||
      normalized.contains('nguon tai lieu') ||
      normalized.contains('source material');
}

String _normalizeSourceLine(String line) {
  return line
      .toLowerCase()
      .replaceAll(RegExp(r'[^\p{L}\p{N}\s]', unicode: true), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

bool _looksLikeRawMaterialId(String line) {
  if (line.isEmpty) return false;
  final stripped = line.replaceFirst(RegExp(r'^[-*•#>\s]+'), '').trim();
  return RegExp(r'^[a-f0-9]{24}$', caseSensitive: false).hasMatch(stripped);
}

bool _looksLikeMaterialIdLine(String normalized) {
  return normalized.startsWith('materialid') ||
      normalized.contains(' materialid ');
}

const _longProseMinChars = 520;
const _longProseMinSentences = 4;
const _longProseTargetChars = 430;

final _sentenceBreak = RegExp(
  '[^.!?。！？]+[.!?。！？]+(?:["”\'\\)]+)?|[^.!?。！？]+\$',
  unicode: true,
);

/// Tách đoạn văn dài giống FE web `splitLongProseParagraphs`.
String splitLongProseParagraphs(String text) {
  if (text.trim().isEmpty) return text;
  return text.split(RegExp(r'\n{2,}')).map(_splitPlainProseBlock).join('\n\n');
}

String _splitPlainProseBlock(String block) {
  if (!_isPlainProseBlock(block)) return block;
  final sentences = _splitSentences(block);
  if (sentences.length < _longProseMinSentences) return block;

  final paragraphs = <String>[];
  var current = '';
  for (final sentence in sentences) {
    final next = current.isEmpty ? sentence : '$current $sentence';
    if (current.isNotEmpty && next.length > _longProseTargetChars) {
      paragraphs.add(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current.isNotEmpty) paragraphs.add(current);
  return paragraphs.length > 1 ? paragraphs.join('\n\n') : block;
}

List<String> _splitSentences(String text) {
  return _sentenceBreak
      .allMatches(text.replaceAll(RegExp(r'\s+'), ' ').trim())
      .map((match) => match[0]!.trim())
      .where((sentence) => sentence.isNotEmpty)
      .toList();
}

bool _isPlainProseBlock(String block) {
  final trimmed = block.trim();
  if (trimmed.length < _longProseMinChars) return false;
  if (RegExp(r'\[[^\]]+\]\([^)]+\)').hasMatch(trimmed)) return false;

  return trimmed.split('\n').every((line) {
    final value = line.trim();
    return value.isNotEmpty &&
        !_isHeadingLine(value) &&
        !_isListLine(value) &&
        !_isTableLine(value) &&
        !_isFenceLine(value) &&
        !value.startsWith('>') &&
        !_isSourceSectionHeaderLine(value);
  });
}

bool _isHeadingLine(String line) => RegExp(r'^#{1,6}\s+').hasMatch(line.trim());

bool _isListLine(String line) =>
    RegExp(r'^\s*(?:[-*+]\s+|\d+[.)]\s+)').hasMatch(line);

bool _isTableLine(String line) {
  final trimmed = line.trim();
  if (!trimmed.contains('|')) return false;
  final cells = trimmed
      .replaceFirst(RegExp(r'^\|'), '')
      .replaceFirst(RegExp(r'\|$'), '')
      .split('|')
      .map((cell) => cell.trim())
      .toList();
  return cells.length >= 2;
}

bool _isFenceLine(String line) => RegExp(r'^\s*(```|~~~)').hasMatch(line);
