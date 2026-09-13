import '../../../core/utils/study_suggestion_prompt.dart';
import '../../../shared/models/improve_suggestion.dart';

/// Gợi ý "Tiếp tục học" trong chat — khớp FE web `lessonSuggestionsForMessage`.
///
/// Ưu tiên `nextImproveSuggestions` từ câu trả lời AI; nếu trống thì parse
/// các dòng "Bài N" trong markdown. Không mở màn Improve Plan.
List<ImproveSuggestionItem> chatImproveSuggestionsForMessage({
  required String answer,
  List<ImproveSuggestionItem> apiSuggestions = const [],
}) {
  final path = lessonSuggestionsForMessage(
    answer: answer,
    apiSuggestionTitles: [
      for (final item in apiSuggestions)
        if (item.effectiveText.trim().isNotEmpty)
          item.effectiveText.trim()
        else if (item.title.trim().isNotEmpty)
          item.title.trim(),
    ],
  );
  if (path.isEmpty) return const [];
  if (apiSuggestions.isNotEmpty) return apiSuggestions;
  return [
    for (final item in path)
      ImproveSuggestionItem.fromLabel(item.suggestionText),
  ];
}

bool answerHasLessonPathSuggestions(String? answer) {
  return parseLessonSuggestionsFromAnswer(answer).isNotEmpty;
}
