class UnderstandingOption {
  const UnderstandingOption({required this.key, required this.text});

  final String key;
  final String text;
}

class UnderstandingQuiz {
  const UnderstandingQuiz({
    required this.question,
    required this.options,
    this.correctKey = '',
    this.explanation = '',
  });

  final String question;
  final List<UnderstandingOption> options;
  final String correctKey;
  final String explanation;

  UnderstandingOption? optionFor(String key) {
    final needle = key.trim().toUpperCase();
    for (final option in options) {
      if (option.key == needle) return option;
    }
    return null;
  }
}

class UnderstandingCheckExtract {
  const UnderstandingCheckExtract({
    required this.before,
    required this.after,
    this.quiz,
  });

  final String before;
  final String after;
  final UnderstandingQuiz? quiz;
}

class UnderstandingCheckAttempt {
  const UnderstandingCheckAttempt({
    required this.quiz,
    required this.selected,
    required this.isCorrect,
  });

  final UnderstandingQuiz quiz;
  final UnderstandingOption selected;
  final bool isCorrect;
}

UnderstandingCheckExtract resolveUnderstandingCheck({
  required String markdown,
  dynamic structured,
}) {
  final extracted = extractUnderstandingCheck(markdown);
  final quiz =
      normalizeStructuredUnderstandingQuiz(structured) ?? extracted.quiz;
  return UnderstandingCheckExtract(
    before: extracted.before,
    after: extracted.after,
    quiz: quiz,
  );
}

final _checkHeading = RegExp(
  r'^(#{1,6})\s*(?:kiểm tra hiểu|understanding check|câu(?:\s+hỏi)?\s+trắc nghiệm mới(?:\s*\((?:(?:được|đã)\s+)?paraphrase\))?|câu hỏi ôn tập)\s*$',
  caseSensitive: false,
  multiLine: true,
);
final _optionMark = RegExp(r'(?:^|\s)(?:\(([A-Da-d])\)|([A-Da-d])\.)\s+');
final _canonicalAnswer = RegExp(
  r'(?:^|\s)(?<!chọn\s)(?<!choose\s)(?<!pick\s)(?:đáp án|dap an|(?:the\s+)?(?:correct\s+)?answer)(?:\s+đúng)?\s*(?:là|is|:|：|-)?\s*([A-Da-d])\b[^\n]*',
  caseSensitive: false,
);
final _revealedAnswer = RegExp(
  r'(?:^|\s)\s*[-*+]?\s*chọn đáp án đúng\s*[:：-]\s*(?:\n\s*[-*+]?\s*)?([A-Da-d])\s*[.)]?\s*[^\n]*',
  caseSensitive: false,
);
final _answerPromptMarker = RegExp(
  r'(?:^|\s)\s*[-*+]?\s*chọn đáp án đúng\s*[:：-]\s*(?:[-*+]\s*)?',
  caseSensitive: false,
);
final _leakedAnswer = RegExp(
  r'nếu bạn chọn(?:\s+đáp án)?\s+([A-Da-d])\b',
  caseSensitive: false,
);
final _chooseAnswer = RegExp(
  r'(?:chọn|choose|pick)\s+(?:đáp án\s+)?([A-Da-d])\b',
  caseSensitive: false,
);
final _loneKey = RegExp(r'(?:^|\n)\s*([A-Da-d])\s*[.)]?\s*$');
final _explainMarker = RegExp(
  r'(?:^|\s)(?:giải thích|giai thich|explanation|lý do|ly do)\s*[:：]\s*',
  caseSensitive: false,
);
final _questionPrefix = RegExp(
  r'^(?:câu hỏi|cau hoi|question)\s*[:：]\s*',
  caseSensitive: false,
  multiLine: true,
);
final _headingBreak = RegExp(r'(?:^|\n)#{1,6}\s+\S');

int javaStringHash(String value) {
  var hash = 0;
  for (final unit in value.codeUnits) {
    hash = (hash * 31 + unit).toSigned(32);
  }
  return hash;
}

({List<UnderstandingOption> options, String correctKey})
shuffleCorrectAnswerPosition(
  String question,
  List<UnderstandingOption> options,
  String correctKey,
) {
  if (correctKey.isEmpty || options.length < 2) {
    return (options: options, correctKey: correctKey);
  }
  final correctOption = options.where((o) => o.key == correctKey).firstOrNull;
  if (correctOption == null) {
    return (options: options, correctKey: '');
  }
  final seedInput =
      '$question\u001f${options.map((o) => '${o.key}\u001e${o.text}').join('\u001f')}';
  final targetIndex =
      ((javaStringHash(seedInput) % options.length) + options.length) %
      options.length;
  final reordered = options.where((o) => o.key != correctKey).toList();
  reordered.insert(targetIndex, correctOption);
  var shuffledCorrectKey = '';
  final relabeled = <UnderstandingOption>[];
  for (var index = 0; index < reordered.length; index++) {
    final key = String.fromCharCode(65 + index);
    if (reordered[index].key == correctKey) shuffledCorrectKey = key;
    relabeled.add(UnderstandingOption(key: key, text: reordered[index].text));
  }
  return (options: relabeled, correctKey: shuffledCorrectKey);
}

String stripDecorations(String value) {
  return value
      .replaceAll(RegExp(r'^\s*[-*+]\s+', multiLine: true), '')
      .replaceAll(RegExp(r'[*_`]+'), '')
      .replaceAll(RegExp(r'\s+-{2,}\s*$'), '')
      .replaceAll(RegExp(r'^\s*-{3,}\s*$', multiLine: true), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

int nextSectionBreak(String text) {
  final heading = _headingBreak.firstMatch(text);
  return heading?.start ?? -1;
}

UnderstandingQuiz? normalizeStructuredUnderstandingQuiz(dynamic value) {
  if (value is! Map) return null;
  final map = Map<String, dynamic>.from(value);
  final question = map['question']?.toString().trim() ?? '';
  final seenKeys = <String>{};
  final options = <UnderstandingOption>[];
  final rawOptions = map['options'];
  if (rawOptions is List) {
    for (final entry in rawOptions) {
      if (entry is! Map) continue;
      final option = Map<String, dynamic>.from(entry);
      final key = option['key']?.toString().trim().toUpperCase() ?? '';
      final text = option['text']?.toString().trim() ?? '';
      if (!RegExp(r'^[A-D]$').hasMatch(key) ||
          text.isEmpty ||
          seenKeys.contains(key)) {
        continue;
      }
      seenKeys.add(key);
      options.add(UnderstandingOption(key: key, text: text));
    }
  }
  if (question.isEmpty || options.length < 2) return null;
  final requestedKey = map['correctKey']?.toString().trim().toUpperCase() ?? '';
  final correctKey = options.any((o) => o.key == requestedKey)
      ? requestedKey
      : '';
  return UnderstandingQuiz(
    question: question,
    options: options,
    correctKey: correctKey,
    explanation: map['explanation']?.toString().trim() ?? '',
  );
}

UnderstandingQuiz? parseUnderstandingQuiz(String sectionBody) {
  var raw = sectionBody.replaceAll(RegExp(r'[*_`]+'), '').trim();
  if (raw.isEmpty) return null;

  final canonicalMatch = _canonicalAnswer.firstMatch(raw);
  final revealedAnswerMatch = _revealedAnswer.firstMatch(raw);
  final leakedMatch = _leakedAnswer.firstMatch(raw);
  final chooseMatch = _chooseAnswer.firstMatch(raw);
  final loneMatch = _loneKey.firstMatch(raw);
  final answerMatch =
      canonicalMatch ??
      revealedAnswerMatch ??
      leakedMatch ??
      chooseMatch ??
      loneMatch;
  final answerPromptMatch = _answerPromptMarker.firstMatch(raw);
  int? answerPromptIndex;
  if (answerPromptMatch != null) {
    final before = raw.substring(0, answerPromptMatch.start);
    if (_optionMark.allMatches(before).length >= 2) {
      answerPromptIndex = answerPromptMatch.start;
    }
  }
  final explainMarkers = _explainMarker.allMatches(raw).toList();
  final firstExplain = explainMarkers.isEmpty ? null : explainMarkers.first;
  final explanationEndCandidates = <int>[
    ...explainMarkers.skip(1).map((item) => item.start),
    if (canonicalMatch != null) canonicalMatch.start,
    if (revealedAnswerMatch != null) revealedAnswerMatch.start,
    raw.length,
  ].where((index) => firstExplain == null || index > firstExplain.start);
  final explanationEnd = explanationEndCandidates.isEmpty
      ? raw.length
      : explanationEndCandidates.reduce((a, b) => a < b ? a : b);
  final parsedExplanation = firstExplain == null
      ? ''
      : raw.substring(
          firstExplain.start + firstExplain[0]!.length,
          explanationEnd,
        );

  final metadataIndexes = <int>[
    if (canonicalMatch != null) canonicalMatch.start,
    if (revealedAnswerMatch != null) revealedAnswerMatch.start,
    if (answerPromptIndex != null) answerPromptIndex,
    ...explainMarkers.map((item) => item.start),
  ];
  var working = raw;
  if (metadataIndexes.isNotEmpty) {
    final cut = metadataIndexes.reduce((a, b) => a < b ? a : b);
    working = working
        .substring(0, cut)
        .replaceFirst(RegExp(r'(?:^|\n)\s*[-+]\s*$'), '');
  } else if (leakedMatch == null && chooseMatch == null && loneMatch != null) {
    working = working.replaceFirst(loneMatch[0]!, '\n');
  }
  working = working.replaceFirst(_questionPrefix, '').trim();

  final marks = <({String key, int start, int textStart})>[];
  for (final match in _optionMark.allMatches(working)) {
    final key = (match[1] ?? match[2] ?? '').toUpperCase();
    marks.add((
      key: key,
      start: match.start,
      textStart: match.start + match[0]!.length,
    ));
  }
  if (marks.length < 2) return null;

  final question = stripDecorations(
    working.substring(0, marks.first.start),
  ).replaceFirst(RegExp(r'[?\s]+$'), '');
  if (question.isEmpty) return null;

  final options = <UnderstandingOption>[];
  for (var index = 0; index < marks.length; index++) {
    final end = index + 1 < marks.length
        ? marks[index + 1].start
        : working.length;
    final text = stripDecorations(
      working.substring(marks[index].textStart, end),
    ).replaceFirst(RegExp(r'[;|]+$'), '');
    if (text.isNotEmpty) {
      options.add(UnderstandingOption(key: marks[index].key, text: text));
    }
  }
  if (options.length < 2) return null;

  var correctKey = answerMatch == null
      ? ''
      : (answerMatch[1] ?? '').toUpperCase();
  var explanation = stripDecorations(
    parsedExplanation
        .replaceAll(_canonicalAnswer, ' ')
        .replaceAll(_revealedAnswer, ' ')
        .replaceAll(_explainMarker, ' '),
  );
  final last = options.last;
  final leaked = RegExp(
    r'^(.{12,}?[.!?])\s+(Nếu bạn chọn(?:\s+đáp án)?\s+[A-D]\b[\s\S]+)$',
    caseSensitive: false,
  ).firstMatch(last.text);
  if (leaked != null) {
    options[options.length - 1] = UnderstandingOption(
      key: last.key,
      text: stripDecorations(leaked[1] ?? ''),
    );
    final leakedKey = _leakedAnswer.firstMatch(leaked[2] ?? '');
    if (correctKey.isEmpty && leakedKey != null) {
      correctKey = (leakedKey[1] ?? '').toUpperCase();
    }
    if (explanation.isEmpty) explanation = stripDecorations(leaked[2] ?? '');
  }

  final shuffled = shuffleCorrectAnswerPosition(question, options, correctKey);
  return UnderstandingQuiz(
    question: '$question?',
    options: shuffled.options,
    correctKey: shuffled.correctKey,
    explanation: explanation,
  );
}

UnderstandingCheckExtract extractUnderstandingCheck(String markdown) {
  final text = markdown;
  final heading = _checkHeading.firstMatch(text);
  if (heading == null) {
    return UnderstandingCheckExtract(before: text, after: '', quiz: null);
  }
  final afterHeading = heading.end;
  final rest = text.substring(afterHeading).replaceFirst(RegExp(r'^\s*\n'), '');
  final breakAt = nextSectionBreak(rest);
  final sectionBody = (breakAt < 0 ? rest : rest.substring(0, breakAt)).trim();
  final quiz = parseUnderstandingQuiz(sectionBody);
  if (quiz == null) {
    return UnderstandingCheckExtract(before: text, after: '', quiz: null);
  }
  final after = breakAt < 0
      ? ''
      : rest
            .substring(breakAt)
            .replaceFirst(RegExp(r'^\s*-{3,}\s*'), '')
            .trim();
  return UnderstandingCheckExtract(
    before: text.substring(0, heading.start).trimRight(),
    after: after,
    quiz: quiz,
  );
}

String buildUnderstandingCheckPrompt(
  UnderstandingQuiz quiz,
  UnderstandingOption selected,
) {
  final question = quiz.question.trim();
  final choice = selected.key.trim();
  if (question.isEmpty || choice.isEmpty) return '';
  final options = quiz.options
      .map((item) => '${item.key}. ${item.text}')
      .join('\n');
  return [
    'Đây là câu kiểm tra hiểu trong bài đang học, không phải chủ đề mới.',
    'Câu hỏi: $question',
    'Lựa chọn:',
    options,
    'Học sinh chọn: $choice. ${selected.text}',
    'Hãy chấm: nói rõ Đúng hay Chưa đúng, nêu đáp án đúng, và giải thích ngắn theo tài liệu. Không mở lộ trình bài mới.',
  ].join('\n');
}

String buildIncorrectAnswerRemediationPrompt(
  UnderstandingQuiz quiz,
  UnderstandingOption selected,
) {
  final question = quiz.question.trim();
  final selectedKey = selected.key.trim().toUpperCase();
  final correctKey = quiz.correctKey.trim().toUpperCase();
  final correctOption = quiz.optionFor(correctKey);
  if (question.isEmpty ||
      selectedKey.isEmpty ||
      correctKey.isEmpty ||
      selectedKey == correctKey) {
    return '';
  }
  return [
    'Ôn lại sau câu trả lời chưa đúng.',
    'Câu vừa làm: $question',
    'Em đã chọn: $selectedKey. ${selected.text}',
    'Đáp án đúng: $correctKey. ${correctOption?.text.trim() ?? ''}',
    if (quiz.explanation.trim().isNotEmpty)
      'Lý do trong bài: ${quiz.explanation.trim()}',
    'Hãy tự động giảng lại đúng kiến thức này bằng cách dễ hiểu hơn, dùng cả Giải thích khái niệm (Conceptual Explanation) và Minh họa trực quan (Visual Representation).',
    'Sau đó cho em làm lại một câu trắc nghiệm dễ hơn về cùng kiến thức, nhưng phải paraphrase câu hỏi và các lựa chọn; không lặp nguyên văn câu cũ và không chuyển sang chủ đề mới.',
  ].join('\n');
}

String buildMissingAnswerKeyRemediationPrompt(
  UnderstandingQuiz quiz,
  UnderstandingOption selected,
) {
  final question = quiz.question.trim();
  final selectedKey = selected.key.trim().toUpperCase();
  final options = quiz.options
      .map((option) => '${option.key}. ${option.text.trim()}')
      .where((option) => option.length > 3)
      .join('\n');
  if (question.isEmpty || selectedKey.isEmpty || options.isEmpty) return '';
  return [
    'Ôn lại sau câu kiểm tra chưa có đáp án.',
    'Câu vừa làm: $question',
    'Các lựa chọn:',
    options,
    'Em đã chọn: $selectedKey. ${selected.text}',
    'Hãy dựa vào tài liệu môn học để xác định và chấm đáp án em đã chọn, rồi giảng lại kiến thức này bằng Giải thích khái niệm (Conceptual Explanation) và Minh họa trực quan (Visual Representation).',
    'Sau đó cho em làm lại một câu trắc nghiệm dễ hơn về cùng kiến thức nhưng được paraphrase. Câu mới phải có các lựa chọn A, B, C và kết thúc bằng đúng hai dòng: Đáp án: <A hoặc B hoặc C>; Giải thích: <một câu ngắn>.',
  ].join('\n');
}

String understandingCheckStorageKey(String messageId) {
  return 'understanding-check:student:${messageId.trim()}';
}
