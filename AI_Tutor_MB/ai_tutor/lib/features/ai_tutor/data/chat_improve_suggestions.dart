import '../../../core/utils/study_suggestion_prompt.dart';
import '../../../shared/models/improve_suggestion.dart';

/// Gợi ý "Tiếp tục học" trong chat.
///
/// Chỉ hiện khi câu trả lời là lộ trình (`Bài N` từ 2 bài trở lên).
/// Câu trả lời thường không lấy chip API generic.
List<ImproveSuggestionItem> chatImproveSuggestionsForMessage({
  required String answer,
  List<ImproveSuggestionItem> apiSuggestions = const [],
  bool apiSuggestionsProvided = false,
}) {
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
