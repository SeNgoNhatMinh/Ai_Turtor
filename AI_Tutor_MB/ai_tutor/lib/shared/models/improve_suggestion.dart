import '../../core/utils/json_helpers.dart';

/// Một gợi ý cải thiện từ backend (`SuggestionItem` hoặc chuỗi memory).
class ImproveSuggestionItem {
  const ImproveSuggestionItem({
    required this.key,
    required this.title,
    this.reason,
    this.learnTopic,
    this.suggestionText,
    this.source,
    this.nextSteps = const [],
  });

  final String key;
  final String title;
  final String? reason;
  final String? learnTopic;
  final String? suggestionText;
  final String? source;
  final List<String> nextSteps;

  String get effectiveTopic => learnTopic ?? title;

  String get effectiveText => suggestionText ?? title;

  factory ImproveSuggestionItem.fromLabel(String label) {
    final trimmed = label.trim();
    return ImproveSuggestionItem(
      key: _slug(trimmed),
      title: trimmed,
      learnTopic: trimmed,
      suggestionText: trimmed,
    );
  }

  factory ImproveSuggestionItem.fromJson(Map<String, dynamic> json) {
    final title = readString(json, 'title');
    final nextSteps = parseStringList(json['nextSteps']);
    final learnTopic = nextSteps.isNotEmpty ? nextSteps.first : title;
    return ImproveSuggestionItem(
      key: readString(json, 'key', fallback: _slug(learnTopic)),
      title: title,
      reason: json['reason']?.toString(),
      learnTopic: learnTopic,
      suggestionText: title,
      source: json['source']?.toString(),
      nextSteps: nextSteps,
    );
  }

  /// Chuyển `ruleSuggestions` thành các chip có thể bấm (ưu tiên `nextSteps`).
  static List<ImproveSuggestionItem> actionableChips(
    List<ImproveSuggestionItem> items,
  ) {
    final chips = <ImproveSuggestionItem>[];
    for (final item in items) {
      if (item.nextSteps.isNotEmpty) {
        for (final step in item.nextSteps) {
          final trimmed = step.trim();
          if (trimmed.isEmpty) continue;
          chips.add(
            ImproveSuggestionItem(
              key: _slug(trimmed),
              title: trimmed,
              learnTopic: trimmed,
              suggestionText: trimmed,
              source: item.source,
            ),
          );
        }
      } else if (item.title.trim().isNotEmpty) {
        chips.add(item);
      }
    }
    return chips;
  }

  static String _slug(String text) {
    return text
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9à-ỹ]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
  }
}
