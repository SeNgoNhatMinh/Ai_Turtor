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
    this.improvePlanId,
    this.planItemId,
    this.groundingStatus,
    this.sourceMaterialIds = const [],
    this.sourceChunkIds = const [],
  });

  final String key;
  final String title;
  final String? reason;
  final String? learnTopic;
  final String? suggestionText;
  final String? source;
  final List<String> nextSteps;
  final String? improvePlanId;
  final String? planItemId;
  final String? groundingStatus;
  final List<String> sourceMaterialIds;
  final List<String> sourceChunkIds;

  bool get hasImprovePlanGrounding {
    return (improvePlanId ?? '').trim().isNotEmpty &&
        (planItemId ?? '').trim().isNotEmpty;
  }

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

  factory ImproveSuggestionItem.reviewItem({
    required String title,
    required String text,
    String? improvePlanId,
    String? planItemId,
    String? groundingStatus,
    List<String> sourceMaterialIds = const [],
    List<String> sourceChunkIds = const [],
  }) {
    return ImproveSuggestionItem(
      key: _slug(text),
      title: title.trim().isEmpty ? text : title,
      learnTopic: text,
      suggestionText: text,
      improvePlanId: improvePlanId,
      planItemId: planItemId,
      groundingStatus: groundingStatus,
      sourceMaterialIds: sourceMaterialIds,
      sourceChunkIds: sourceChunkIds,
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
      suggestionText:
          json['suggestionText']?.toString() ??
          json['instruction']?.toString() ??
          json['content']?.toString() ??
          title,
      source: json['source']?.toString(),
      nextSteps: nextSteps,
      improvePlanId: json['improvePlanId']?.toString(),
      planItemId: json['planItemId']?.toString(),
      groundingStatus: json['groundingStatus']?.toString(),
      sourceMaterialIds: parseStringList(json['sourceMaterialIds']),
      sourceChunkIds: parseStringList(json['sourceChunkIds']),
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
              sourceMaterialIds: item.sourceMaterialIds,
              sourceChunkIds: item.sourceChunkIds,
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
