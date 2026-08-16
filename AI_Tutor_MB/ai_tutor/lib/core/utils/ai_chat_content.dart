// Luôn loại bỏ "Nguồn tài liệu đã dùng" và materialId khỏi câu trả lời AI trong chat.

import 'ai_study_tips.dart';

String sanitizeAiChatContent(String content) {
  return _stripSourceSection(content).trimRight();
}

/// Markdown hiển thị chat: bỏ nguồn, giữ "Lưu ý..." và biến bullet thành link bấm được.
String prepareAiChatMarkdown(String content) {
  return enhanceStudyTips(sanitizeAiChatContent(content));
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
