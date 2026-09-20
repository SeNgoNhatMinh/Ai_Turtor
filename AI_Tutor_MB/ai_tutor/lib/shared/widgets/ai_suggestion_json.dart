import 'dart:convert';

import '../../shared/models/improve_suggestion.dart';

final _jsonString = RegExp(r'"((?:\\.|[^"\\])*)"');

/// Payload `{ "suggestions": [...], "notes": "..." }` mà n8n nhét vào mọi môn.
bool isSuggestionEnvelope(Map<String, dynamic> value) {
  return value.containsKey('suggestions') ||
      value.containsKey('ruleSuggestions') ||
      value.containsKey('aiSuggestion') ||
      value.containsKey('notes');
}

bool looksLikeSuggestionJson(String? value) {
  if (value == null) return false;
  final text = _normalizeSuggestionText(value);
  if (text.length < 12) return false;
  final lower = text.toLowerCase();
  final hasEnvelope =
      lower.contains('"suggestions"') ||
      lower.contains("'suggestions'") ||
      lower.contains('"rulesuggestions"') ||
      lower.contains('"aisuggestion"') ||
      lower.contains('"nextsteps"') ||
      (lower.contains('"title"') && lower.contains('"reason"'));
  if (!hasEnvelope) return false;
  return text.contains('{') || text.contains('[') || text.startsWith('```');
}

Map<String, dynamic>? parseSuggestionJson(String? value) {
  if (value == null) return null;
  var text = _normalizeSuggestionText(value);
  if (text.isEmpty) return null;
  text = text.replaceFirst(
    RegExp(r'^```(?:json)?\s*', caseSensitive: false),
    '',
  );
  text = text.replaceFirst(RegExp(r'\s*```$'), '');
  text = text.trim();

  Map<String, dynamic>? decode(String source) {
    try {
      var decoded = jsonDecode(source);
      if (decoded is String) {
        decoded = jsonDecode(decoded);
      }
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      if (decoded is List) return {'suggestions': decoded};
    } catch (_) {
      try {
        final repaired = source
            .replaceAll(RegExp(r',\s*}'), '}')
            .replaceAll(RegExp(r',\s*]'), ']');
        final decoded = jsonDecode(repaired);
        if (decoded is Map<String, dynamic>) return decoded;
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
        if (decoded is List) return {'suggestions': decoded};
      } catch (_) {}
    }
    return null;
  }

  final direct = decode(text);
  if (direct != null) return direct;

  final complete = _firstCompleteJsonObject(text);
  if (complete != null) {
    final parsed = decode(complete);
    if (parsed != null) return parsed;
  }

  final firstBrace = text.indexOf('{');
  final firstBracket = text.indexOf('[');
  final first =
      firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
      ? firstBrace
      : firstBracket;
  final lastBrace = text.lastIndexOf('}');
  final lastBracket = text.lastIndexOf(']');
  final last = lastBrace > lastBracket ? lastBrace : lastBracket;
  if (first < 0 || last <= first) return null;
  return decode(text.substring(first, last + 1));
}

Map<String, dynamic>? suggestionEnvelopeFrom(String? value) {
  final parsed = parseSuggestionJson(value);
  if (parsed == null) return null;
  if (isSuggestionEnvelope(parsed)) return parsed;
  if (parsed['title'] != null || parsed['nextSteps'] != null) {
    return {
      'suggestions': [parsed],
    };
  }
  return null;
}

String formatSuggestionEnvelope(Map<String, dynamic> envelope) {
  final buffer = StringBuffer();
  final notes = envelope['notes']?.toString().trim() ?? '';
  if (notes.isNotEmpty) {
    buffer.writeln(notes);
    buffer.writeln();
  }

  void writeItem(Map<String, dynamic> item) {
    final title =
        item['title']?.toString().trim() ??
        item['topic']?.toString().trim() ??
        '';
    final reason =
        item['reason']?.toString().trim() ??
        item['content']?.toString().trim() ??
        item['description']?.toString().trim() ??
        '';
    if (title.isNotEmpty) {
      buffer.writeln('### $title');
      buffer.writeln();
    }
    if (reason.isNotEmpty) {
      buffer.writeln(reason);
      buffer.writeln();
    }
    final steps = item['nextSteps'] ?? item['steps'] ?? item['actions'];
    if (steps is List) {
      for (final step in steps) {
        final text = step.toString().trim();
        if (text.isEmpty || looksLikeSuggestionJson(text)) continue;
        buffer.writeln('- $text');
      }
      buffer.writeln();
    }
  }

  void writeList(dynamic raw) {
    if (raw is! List) return;
    for (final item in raw) {
      if (item is Map) {
        writeItem(Map<String, dynamic>.from(item));
      } else if (item is String) {
        final nested = suggestionEnvelopeFrom(item);
        if (nested != null) {
          buffer.writeln(formatSuggestionEnvelope(nested));
          buffer.writeln();
        } else if (item.trim().isNotEmpty && !looksLikeSuggestionJson(item)) {
          buffer.writeln('- ${item.trim()}');
        }
      }
    }
  }

  writeList(envelope['suggestions']);
  writeList(envelope['ruleSuggestions']);
  final aiSuggestion = envelope['aiSuggestion'];
  if (aiSuggestion is Map) {
    writeItem(Map<String, dynamic>.from(aiSuggestion));
  } else if (aiSuggestion is String && aiSuggestion.trim().isNotEmpty) {
    final nested = suggestionEnvelopeFrom(aiSuggestion);
    if (nested != null) {
      buffer.writeln(formatSuggestionEnvelope(nested));
    } else if (!looksLikeSuggestionJson(aiSuggestion)) {
      buffer.writeln(aiSuggestion.trim());
    }
  }

  return buffer.toString().trim();
}

/// Đổi JSON gợi ý thành markdown. Không để lộ `"suggestions"` dù JSON cắt dở.
String rewriteSuggestionJson(String content) {
  if (content.trim().isEmpty) return content;

  var text = _normalizeSuggestionText(content).replaceAllMapped(
    RegExp(r'```(?:json)?\s*([\s\S]*?)```', caseSensitive: false),
    (match) {
      final inner = match[1] ?? '';
      if (!looksLikeSuggestionJson(inner) &&
          parseSuggestionJson(inner) == null) {
        return match[0]!;
      }
      return _markdownFromSuggestionBlob(inner);
    },
  );

  if (!looksLikeSuggestionJson(text)) return text;
  return _markdownFromSuggestionBlob(text);
}

List<ImproveSuggestionItem> suggestionItemsFromJson(String answer) {
  final envelope = suggestionEnvelopeFrom(answer);
  if (envelope != null) {
    final items = <ImproveSuggestionItem>[];
    void add(dynamic raw) {
      if (raw is List) {
        for (final item in raw) {
          add(item);
        }
        return;
      }
      if (raw is Map) {
        items.add(
          ImproveSuggestionItem.fromJson(Map<String, dynamic>.from(raw)),
        );
        return;
      }
      if (raw is String && raw.trim().isNotEmpty) {
        final nested = suggestionItemsFromJson(raw);
        if (nested.isNotEmpty) {
          items.addAll(nested);
        } else if (!looksLikeSuggestionJson(raw)) {
          items.add(ImproveSuggestionItem.fromLabel(raw.trim()));
        }
      }
    }

    add(envelope['suggestions']);
    add(envelope['ruleSuggestions']);
    add(envelope['aiSuggestion']);
    final chips = ImproveSuggestionItem.actionableChips(
      items,
    ).where((item) => !looksLikeSuggestionJson(item.title)).toList();
    if (chips.isNotEmpty) return chips;
  }

  return ImproveSuggestionItem.actionableChips(
    _salvageSuggestionMaps(answer).map(ImproveSuggestionItem.fromJson).toList(),
  ).where((item) => !looksLikeSuggestionJson(item.title)).toList();
}

List<ImproveSuggestionItem> expandImproveSuggestions(
  List<ImproveSuggestionItem> items, {
  String answer = '',
}) {
  final result = <ImproveSuggestionItem>[];
  final seen = <String>{};

  void add(ImproveSuggestionItem item) {
    if (looksLikeSuggestionJson(item.title) ||
        looksLikeSuggestionJson(item.effectiveText)) {
      final blob = item.effectiveText.trim().isNotEmpty
          ? item.effectiveText
          : item.title;
      for (final extracted in suggestionItemsFromJson(blob)) {
        add(extracted);
      }
      return;
    }
    final key = item.title.trim().toLowerCase();
    if (key.isEmpty || seen.contains(key)) return;
    seen.add(key);
    result.add(item);
  }

  for (final item in items) {
    add(item);
  }
  if (looksLikeSuggestionJson(answer)) {
    for (final item in suggestionItemsFromJson(answer)) {
      add(item);
    }
  }
  return result;
}

String _markdownFromSuggestionBlob(String blob) {
  final jsonStart = _jsonStartIndex(blob);
  final prefix = jsonStart > 0 ? blob.substring(0, jsonStart).trim() : '';

  String wrap(String formatted) {
    if (formatted.trim().isEmpty) {
      return prefix.isEmpty || looksLikeSuggestionJson(prefix)
          ? _hiddenJsonFallback
          : prefix;
    }
    if (prefix.isEmpty || looksLikeSuggestionJson(prefix)) return formatted;
    return '$prefix\n\n$formatted';
  }

  final envelope = suggestionEnvelopeFrom(blob);
  if (envelope != null) {
    final formatted = formatSuggestionEnvelope(envelope);
    if (formatted.isNotEmpty && !looksLikeSuggestionJson(formatted)) {
      return wrap(formatted);
    }
  }

  final salvaged = _salvageSuggestionMaps(blob);
  if (salvaged.isNotEmpty) {
    final formatted = formatSuggestionEnvelope({'suggestions': salvaged});
    if (formatted.isNotEmpty) return wrap(formatted);
  }

  return wrap(_hiddenJsonFallback);
}

const _hiddenJsonFallback =
    'AI Tutor đã chuẩn bị gợi ý học tập. Hãy chọn một mục bên dưới '
    'hoặc hỏi tiếp chủ đề bạn muốn ôn.';

String _normalizeSuggestionText(String value) {
  return value
      .replaceAll('\r\n', '\n')
      .replaceAll('&quot;', '"')
      .replaceAll('&#34;', '"')
      .replaceAll('“', '"')
      .replaceAll('”', '"')
      .replaceAll('‘', "'")
      .replaceAll('’', "'")
      .trim();
}

int _jsonStartIndex(String text) {
  final brace = text.indexOf('{');
  final bracket = text.indexOf('[');
  if (brace < 0) return bracket;
  if (bracket < 0) return brace;
  return brace < bracket ? brace : bracket;
}

List<Map<String, dynamic>> _salvageSuggestionMaps(String text) {
  final titles = RegExp(
    r'"title"\s*:\s*"((?:\\.|[^"\\])*)"',
  ).allMatches(text).map((m) => _unescapeJsonString(m[1]!)).toList();
  final reasons = RegExp(
    r'"reason"\s*:\s*"((?:\\.|[^"\\])*)(?:"|$)',
    dotAll: true,
  ).allMatches(text).map((m) => _unescapeJsonString(m[1]!)).toList();
  final stepBlock = RegExp(
    r'"nextSteps"\s*:\s*\[([\s\S]*)',
  ).firstMatch(text)?.group(1);
  final steps = <String>[];
  if (stepBlock != null) {
    for (final match in _jsonString.allMatches(stepBlock)) {
      final step = _unescapeJsonString(match[1]!);
      if (step.isEmpty || looksLikeSuggestionJson(step)) continue;
      if (const {
        'title',
        'reason',
        'nextSteps',
        'suggestions',
      }.contains(step)) {
        continue;
      }
      steps.add(step);
    }
  }

  if (titles.isEmpty && reasons.isEmpty && steps.isEmpty) return const [];
  if (titles.isEmpty) {
    return [
      {
        if (reasons.isNotEmpty) 'title': 'Gợi ý học tập',
        if (reasons.isNotEmpty) 'reason': reasons.first,
        'nextSteps': steps,
      },
    ];
  }

  return [
    for (var i = 0; i < titles.length; i++)
      {
        'title': titles[i],
        if (i < reasons.length) 'reason': reasons[i],
        if (i == 0 && steps.isNotEmpty) 'nextSteps': steps,
      },
  ];
}

String _unescapeJsonString(String value) {
  return value
      .replaceAll(r'\"', '"')
      .replaceAll(r'\n', '\n')
      .replaceAll(r'\t', '\t')
      .replaceAll(r'\\', r'\');
}

String? _firstCompleteJsonObject(String text) {
  final start = text.indexOf('{');
  if (start < 0) return null;
  var depth = 0;
  var inString = false;
  var escape = false;
  for (var i = start; i < text.length; i++) {
    final ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch == r'\') {
        escape = true;
        continue;
      }
      if (ch == '"') inString = false;
      continue;
    }
    if (ch == '"') {
      inString = true;
      continue;
    }
    if (ch == '{') depth += 1;
    if (ch == '}') {
      depth -= 1;
      if (depth == 0) return text.substring(start, i + 1);
    }
  }
  return null;
}
