import '../../../core/utils/study_suggestion_prompt.dart';
import '../../../shared/models/improve_suggestion.dart';

/// Gợi ý "Tiếp tục học" trong chat.
///
/// Ưu tiên `nextImproveSuggestions` mà API đã xác nhận. Khi payload này không
/// tồn tại, fallback sang lộ trình `Bài N` được phân tích từ câu trả lời.
List<ImproveSuggestionItem> chatImproveSuggestionsForMessage({
  required String answer,
  List<ImproveSuggestionItem> apiSuggestions = const [],
  bool apiSuggestionsProvided = false,
}) {
  if (apiSuggestionsProvided && apiSuggestions.isNotEmpty) {
    final actionable = ImproveSuggestionItem.actionableChips(apiSuggestions)
        .where((item) => isActionableStudySuggestionText(item.effectiveText))
        .map(
          (item) => item.copyWith(
            interactionType: item.interactionType ?? 'GUIDED_LESSON',
          ),
        )
        .take(8)
        .toList();
    if (actionable.isNotEmpty) return actionable;
  } else if (apiSuggestionsProvided) {
    return const [];
  }

  final parsedLessons = parseLessonSuggestionsFromAnswer(answer);
  if (parsedLessons.isEmpty) return const [];
  return [
    for (final item in parsedLessons)
      ImproveSuggestionItem.fromLabel(
        item.suggestionText,
      ).copyWith(interactionType: 'GUIDED_LESSON'),
  ];
}

bool answerHasLessonPathSuggestions(String? answer) {
  return parseLessonSuggestionsFromAnswer(answer).isNotEmpty;
}

List<String> chatComposerTopicsForMessage({
  required String answer,
  List<ImproveSuggestionItem> apiSuggestions = const [],
  bool apiSuggestionsProvided = false,
  List<String> sessionTopics = const [],
}) {
  List<String> clean(Iterable<String> values) {
    final seen = <String>{};
    return [
      for (final raw in values)
        if (isActionableStudySuggestionText(raw) &&
            seen.add(raw.trim().toLowerCase()))
          raw.trim(),
    ].take(8).toList();
  }

  final session = clean(sessionTopics);
  final parsedLessons = clean(
    parseLessonSuggestionsFromAnswer(answer).map((item) => item.suggestionText),
  );
  final message = clean(
    chatImproveSuggestionsForMessage(
      answer: answer,
      apiSuggestions: apiSuggestions,
      apiSuggestionsProvided: apiSuggestionsProvided,
    ).map((item) => item.effectiveText),
  );
  if (message.isNotEmpty) return message;
  if (parsedLessons.isNotEmpty) return parsedLessons;
  return session;
}
