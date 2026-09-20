class NumberedLesson {
  const NumberedLesson({
    required this.number,
    required this.title,
    required this.kind,
  });

  final String number;
  final String title;
  final String kind;
}

class StudyPathSuggestion {
  const StudyPathSuggestion({
    required this.title,
    required this.suggestionText,
  });

  final String title;
  final String suggestionText;
}

final _deepListLesson = RegExp(
  r'^(?:gợi ý\s+)?học chuyên sâu bài\s+(\d+)\s*[:：.\-–—]\s*(.+)$',
  caseSensitive: false,
);
final _deepTeachLesson = RegExp(
  r'^đào sâu bài\s+(\d+)\s*[:：.\-–—]\s*(.+)$',
  caseSensitive: false,
);
final _numberedLesson = RegExp(
  r'^(?:bắt đầu\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-–—]\s*(.+)$',
  caseSensitive: false,
);
final _normalizeLesson = RegExp(
  r'^(?:bắt đầu\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-–—]\s*(.+)$',
  caseSensitive: false,
);
final _alreadyLessonStart = RegExp(
  r'bắt đầu bài\s+\d+|bat dau bai\s+\d+',
  caseSensitive: false,
);
final _bareLessonStart = RegExp(
  r'^(?:bắt đầu\s+)?(?:bài|bai)\s+\d+',
  caseSensitive: false,
);
final _deepDiveHeading = RegExp(
  r'^#{1,6}\s*(?:học chuyên sâu|học tiếp phần này)\s*$',
  caseSensitive: false,
  multiLine: true,
);
final _sectionHeading = RegExp(r'^#{1,6}\s+\S');
final _emptyBullet = RegExp(r'^[\s–—_*+.·•…-]+$');
final _lessonLine = RegExp(
  r'^(?:\d+[.)]\s*)?(?:bắt đầu\s+|bat dau\s+)?(?:bài|bai)\s+(\d+)\s*[:：.-]\s*(.+)$',
  caseSensitive: false,
);
final _topicStudyAlready = RegExp(
  r'^(?:nay|hôm nay)\s+(?:mình|em)\s+học\b|^(?:mình|em)\s+muốn\s+học\b|^bắt đầu\s+học\b',
  caseSensitive: false,
);

NumberedLesson? parseNumberedLesson(String? text) {
  final topic = (text ?? '').trim();
  if (topic.isEmpty) return null;

  final deepList = _deepListLesson.firstMatch(topic);
  if (deepList != null) {
    return NumberedLesson(
      number: deepList[1]!,
      title: deepList[2]!.trim(),
      kind: 'deep-list',
    );
  }
  final deepTeach = _deepTeachLesson.firstMatch(topic);
  if (deepTeach != null) {
    return NumberedLesson(
      number: deepTeach[1]!,
      title: deepTeach[2]!.trim(),
      kind: 'deep-teach',
    );
  }
  final numbered = _numberedLesson.firstMatch(topic);
  if (numbered != null) {
    return NumberedLesson(
      number: numbered[1]!,
      title: numbered[2]!.trim(),
      kind: 'lesson',
    );
  }
  return null;
}

String teacherStudentPathLabel(String text) {
  final lesson = parseNumberedLesson(text);
  if (lesson?.kind == 'deep-list') return 'Yêu cầu học chuyên sâu';
  if (lesson?.kind == 'deep-teach') return 'Đào sâu bài ${lesson!.number}';
  if (lesson?.kind == 'lesson') return 'Bài ${lesson!.number}';
  return '';
}

bool isDeepDiveListPrompt(String text) {
  return parseNumberedLesson(text)?.kind == 'deep-list';
}

bool isDeepDiveTopicPrompt(String text) {
  return parseNumberedLesson(text)?.kind == 'deep-teach';
}

bool answerHasDeepDiveList(String? answer) {
  return _deepDiveHeading.hasMatch(answer ?? '');
}

String buildDeepDiveListPrompt(String? lessonText, [String answerText = '']) {
  final lesson = parseNumberedLesson(lessonText);
  if (lesson == null || lesson.kind != 'lesson') return '';
  if (answerHasDeepDiveList(answerText)) return '';
  return 'Gợi ý học chuyên sâu bài ${lesson.number}: ${lesson.title}';
}

String normalizeLessonStart(String? suggestionText) {
  final topic = (suggestionText ?? '').trim();
  if (topic.isEmpty) return '';
  final numbered = _normalizeLesson.firstMatch(topic);
  if (numbered != null) {
    return 'Bắt đầu bài ${numbered[1]}: ${numbered[2]!.trim()}';
  }
  if (_alreadyLessonStart.hasMatch(topic)) return topic;
  return '';
}

String buildDeepDiveTopicPrompt(String? lessonNumber, String? topicText) {
  final number = (lessonNumber ?? '').trim();
  final topic = (topicText ?? '').trim();
  if (number.isEmpty || topic.isEmpty) return '';
  if (parseNumberedLesson(topic)?.kind == 'lesson') {
    return normalizeLessonStart(topic);
  }
  if (isDeepDiveTopicPrompt(topic) || isDeepDiveListPrompt(topic)) {
    return topic;
  }
  return 'Đào sâu bài $number: $topic';
}

String resolveChatStudyTip(String? question, String? tipText) {
  final tip = (tipText ?? '').trim();
  if (tip.isEmpty) return '';
  if (parseNumberedLesson(tip)?.kind == 'lesson' ||
      _bareLessonStart.hasMatch(tip)) {
    final started = normalizeLessonStart(tip);
    return started.isEmpty ? tip : started;
  }
  final lesson = parseNumberedLesson(question);
  if (lesson != null) {
    return buildDeepDiveTopicPrompt(lesson.number, tip);
  }
  return tip;
}

String buildTopicStudyPrompt(String? suggestionText) {
  final topic = (suggestionText ?? '').trim();
  if (topic.isEmpty) return '';
  if (_topicStudyAlready.hasMatch(topic)) return topic;
  return 'Nay mình học $topic';
}

String buildLessonChatPrompt(String? suggestionText) {
  final topic = (suggestionText ?? '').trim();
  if (topic.isEmpty) return '';
  final lesson = normalizeLessonStart(topic);
  return lesson.isEmpty ? buildTopicStudyPrompt(topic) : lesson;
}

List<StudyPathSuggestion> parseBulletsUnderHeadings(
  String? answer,
  RegExp headingPattern,
) {
  final text = answer ?? '';
  if (text.trim().isEmpty) return const [];

  final items = <StudyPathSuggestion>[];
  final seen = <String>{};
  var inSection = false;
  for (final raw in text.split(RegExp(r'\r?\n'))) {
    final trimmed = raw.trim();
    if (_sectionHeading.hasMatch(trimmed)) {
      final heading = trimmed.replaceFirst(RegExp(r'^#{1,6}\s*'), '');
      inSection = headingPattern.hasMatch(heading);
      continue;
    }
    if (!inSection) continue;
    final line = trimmed
        .replaceFirst(RegExp(r'^[-*+]\s+'), '')
        .replaceFirst(RegExp(r'^\d+[.)]\s+'), '')
        .replaceFirstMapped(
          RegExp(r'^\[([^\]]+)\]\([^)]+\)$'),
          (match) => match[1] ?? '',
        )
        .replaceAll(RegExp(r'[*_`]+'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (line.isEmpty || _emptyBullet.hasMatch(line)) continue;
    final key = line.toLowerCase();
    if (seen.contains(key)) continue;
    seen.add(key);
    items.add(StudyPathSuggestion(title: line, suggestionText: line));
    if (items.length >= 8) break;
  }
  return items;
}

List<StudyPathSuggestion> parseDeepDiveSuggestionsFromAnswer(String? answer) {
  return parseBulletsUnderHeadings(
    answer,
    RegExp(r'^(?:học chuyên sâu|học tiếp phần này)\s*$', caseSensitive: false),
  );
}

List<StudyPathSuggestion> parseLessonSuggestionsFromAnswer(String? answer) {
  final text = answer ?? '';
  if (text.trim().isEmpty) return const [];

  final seen = <String>{};
  final items = <StudyPathSuggestion>[];
  for (final raw in text.split(RegExp(r'\r?\n'))) {
    final line = raw
        .replaceFirst(RegExp(r'^[\s>*-]+'), '')
        .replaceAll(RegExp(r'[*_`]+'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final match = _lessonLine.firstMatch(line);
    if (match == null || seen.contains(match[1])) continue;
    final title = (match[2] ?? '').trim();
    if (title.isEmpty) continue;
    seen.add(match[1]!);
    final prompt = 'Bắt đầu bài ${match[1]}: $title';
    items.add(StudyPathSuggestion(title: prompt, suggestionText: prompt));
    if (items.length >= 8) break;
  }
  if (items.length < 2) return const [];
  return items;
}

List<StudyPathSuggestion> parseNextLessonSuggestionsFromAnswer(String? answer) {
  final fromHeading = parseBulletsUnderHeadings(
    answer,
    RegExp(r'^(?:bài tiếp theo|bài kế tiếp)\s*$', caseSensitive: false),
  );
  if (fromHeading.isNotEmpty) return fromHeading;
  return parseLessonSuggestionsFromAnswer(answer);
}

List<StudyPathSuggestion> lessonSuggestionsForMessage({
  required String answer,
  List<String> apiSuggestionTitles = const [],
}) {
  final fromApi = apiSuggestionTitles
      .map((title) => title.trim())
      .where((title) => title.isNotEmpty)
      .map((title) => StudyPathSuggestion(title: title, suggestionText: title))
      .toList();
  if (fromApi.isNotEmpty) return fromApi;
  return parseLessonSuggestionsFromAnswer(answer);
}

/// Prompt "Học ngay" — khớp FE web `buildStudySuggestionPrompt`.
String buildStudySuggestionPrompt(
  String suggestionText, {
  String? improvePlanId,
  String? planItemId,
}) {
  final topic = suggestionText.trim();
  if (topic.isEmpty) return '';
  if ((improvePlanId ?? '').trim().isNotEmpty &&
      (planItemId ?? '').trim().isNotEmpty) {
    return 'Ôn tập theo Improve Plan: $topic';
  }
  if (isDeepDiveListPrompt(topic) || isDeepDiveTopicPrompt(topic)) {
    return topic;
  }
  final lesson = normalizeLessonStart(topic);
  if (lesson.isNotEmpty) return lesson;
  return 'Ôn tập phần "$topic"';
}
