final _nonTopicSuggestion = RegExp(
  r'^(?:assignment score|teacher feedback|điểm|nhận xét|ai learning|improvement plan|learning plan|code debugging|tóm tắt|cải thiện|review|summary|recent questions)\b|:\s*\d+(?:[.,]\d+)?\s*$',
  caseSensitive: false,
);

List<String> buildQuizTopicSuggestions({
  Iterable<String> weakTopics = const [],
  Iterable<String> curriculumTopics = const [],
}) {
  final seen = <String>{};
  final result = <String>[];
  for (final raw in [...weakTopics, ...curriculumTopics]) {
    final topic = raw.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (topic.isEmpty || _nonTopicSuggestion.hasMatch(topic)) continue;
    final key = topic.toLowerCase();
    if (seen.add(key)) result.add(topic);
  }
  return result;
}
