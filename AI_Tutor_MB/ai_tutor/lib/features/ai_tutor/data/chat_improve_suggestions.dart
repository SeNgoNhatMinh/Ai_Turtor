import '../../../core/utils/study_suggestion_prompt.dart';
import '../../../shared/models/improve_suggestion.dart';

/// Gợi ý "Tiếp tục học" trong chat — khớp FE web `lessonSuggestionsForMessage`.
///
/// Ưu tiên `nextImproveSuggestions` từ câu trả lời AI; nếu trống thì parse
/// các dòng "Bài N" trong markdown. Không mở màn Improve Plan.
List<ImproveSuggestionItem> chatImproveSuggestionsForMessage({
  required String answer,
  List<ImproveSuggestionItem> apiSuggestions = const [],
  bool apiSuggestionsProvided = false,
}) {
  final actionableApi = apiSuggestions
      .where(
        (item) => isActionableStudySuggestionText(
          item.effectiveText.trim().isNotEmpty
              ? item.effectiveText
              : item.title,
        ),
      )
      .map(
        (item) => item.copyWith(
          interactionType: item.interactionType ?? 'GUIDED_LESSON',
        ),
      )
      .toList();
  if (apiSuggestionsProvided && actionableApi.isEmpty) return const [];
  final path = lessonSuggestionsForMessage(
    answer: answer,
    apiSuggestionTitles: [
      for (final item in actionableApi)
        if (item.effectiveText.trim().isNotEmpty)
          item.effectiveText.trim()
        else if (item.title.trim().isNotEmpty)
          item.title.trim(),
    ],
  );
  if (path.isEmpty) return const [];
  final pathKeys = path
      .map((item) => item.suggestionText.trim().toLowerCase())
      .toSet();
  final apiKeys = actionableApi
      .map(
        (item) =>
            (item.effectiveText.trim().isNotEmpty
                    ? item.effectiveText
                    : item.title)
                .trim()
                .toLowerCase(),
      )
      .toSet();
  if (actionableApi.isNotEmpty && pathKeys.every(apiKeys.contains)) {
    return actionableApi;
  }
  return [
    for (final item in path)
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
