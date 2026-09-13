import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';

final _welcomeOpening = RegExp(
  r'chào mừng bạn đến với (?:buổi học|môn)',
  caseSensitive: false,
);

class TutorSessionState {
  const TutorSessionState({
    required this.id,
    this.studentId = '',
    this.courseId = '',
    this.classId = '',
    this.status = 'ACTIVE',
    this.phase = 'OPEN',
    this.supportLevel = 'STANDARD',
    this.suggestedTopics = const [],
    this.summaryId,
    this.conversationIds = const [],
  });

  final String id;
  final String studentId;
  final String courseId;
  final String classId;
  final String status;
  final String phase;
  final String supportLevel;
  final List<String> suggestedTopics;
  final String? summaryId;
  final List<String> conversationIds;

  bool get isCompleted => status.toUpperCase() == 'COMPLETED';
  bool get isActive => status.toUpperCase() == 'ACTIVE';

  TutorSessionState copyWith({
    String? id,
    String? studentId,
    String? courseId,
    String? classId,
    String? status,
    String? phase,
    String? supportLevel,
    List<String>? suggestedTopics,
    String? summaryId,
    List<String>? conversationIds,
  }) {
    return TutorSessionState(
      id: id ?? this.id,
      studentId: studentId ?? this.studentId,
      courseId: courseId ?? this.courseId,
      classId: classId ?? this.classId,
      status: status ?? this.status,
      phase: phase ?? this.phase,
      supportLevel: supportLevel ?? this.supportLevel,
      suggestedTopics: suggestedTopics ?? this.suggestedTopics,
      summaryId: summaryId ?? this.summaryId,
      conversationIds: conversationIds ?? this.conversationIds,
    );
  }

  TutorSessionState merge(TutorSessionState next) {
    if (id.isNotEmpty && next.id.isNotEmpty && id != next.id) return next;
    return copyWith(
      id: next.id.isNotEmpty ? next.id : id,
      studentId: next.studentId.isNotEmpty ? next.studentId : studentId,
      courseId: next.courseId.isNotEmpty ? next.courseId : courseId,
      classId: next.classId.isNotEmpty ? next.classId : classId,
      status: next.status.isNotEmpty ? next.status : status,
      phase: next.phase.isNotEmpty ? next.phase : phase,
      supportLevel: next.supportLevel.isNotEmpty
          ? next.supportLevel
          : supportLevel,
      suggestedTopics: next.suggestedTopics.isNotEmpty
          ? next.suggestedTopics
          : suggestedTopics,
      summaryId: next.summaryId ?? summaryId,
      conversationIds: next.conversationIds.isNotEmpty
          ? next.conversationIds
          : conversationIds,
    );
  }

  factory TutorSessionState.fromJson(Map<String, dynamic> json) {
    return TutorSessionState(
      id: (json['id'] ?? json['sessionId'] ?? '').toString().trim(),
      studentId: (json['studentId'] ?? '').toString().trim(),
      courseId: (json['courseId'] ?? '').toString().trim(),
      classId: (json['classId'] ?? '').toString().trim(),
      status: (json['status'] ?? 'ACTIVE').toString().trim(),
      phase: (json['phase'] ?? 'OPEN').toString().trim(),
      supportLevel: (json['supportLevel'] ?? 'STANDARD').toString().trim(),
      suggestedTopics: parseStringList(json['suggestedTopics']),
      summaryId: (json['summaryId'] ?? '').toString().trim().isEmpty
          ? null
          : json['summaryId'].toString().trim(),
      conversationIds: parseStringList(json['conversationIds']),
    );
  }
}

class TutorSessionSummaryInfo {
  const TutorSessionSummaryInfo({
    required this.id,
    this.sessionId = '',
    this.summaryText = '',
    this.topicsCovered = const [],
    this.recommendedNextSteps = const [],
  });

  final String id;
  final String sessionId;
  final String summaryText;
  final List<String> topicsCovered;
  final List<String> recommendedNextSteps;

  factory TutorSessionSummaryInfo.fromJson(Map<String, dynamic> json) {
    return TutorSessionSummaryInfo(
      id: (json['id'] ?? json['summaryId'] ?? '').toString().trim(),
      sessionId: (json['sessionId'] ?? '').toString().trim(),
      summaryText: (json['summaryText'] ?? '').toString().trim(),
      topicsCovered: parseStringList(json['topicsCovered']),
      recommendedNextSteps: parseStringList(json['recommendedNextSteps']),
    );
  }
}

class TutorSessionOpenResult {
  const TutorSessionOpenResult({
    required this.conversationId,
    this.openingMessage,
    this.resumed = false,
    this.session,
  });

  final String conversationId;
  final AiMessage? openingMessage;
  final bool resumed;
  final TutorSessionState? session;

  factory TutorSessionOpenResult.fromJson(Map<String, dynamic> json) {
    final rawSession = json['session'];
    return TutorSessionOpenResult(
      conversationId: (json['conversationId'] ?? '').toString().trim(),
      openingMessage: parseOpeningMessage(json['openingMessage']),
      resumed: json['resumed'] == true,
      session: rawSession is Map
          ? TutorSessionState.fromJson(Map<String, dynamic>.from(rawSession))
          : null,
    );
  }
}

AiMessage? parseOpeningMessage(dynamic value) {
  if (value is! Map) return null;
  final json = Map<String, dynamic>.from(value);
  final content = (json['content'] ?? json['answer'] ?? '').toString().trim();
  if (content.isEmpty) return null;
  return AiMessage(
    id: (json['messageId'] ?? json['id'] ?? 'opening-${content.hashCode}')
        .toString(),
    content: content,
    isUser: false,
    mode: 'TUTOR',
    proactive: true,
  );
}

final _numberedLessonTitle = RegExp(
  r'^(?:\d+\.\d+\s+|chapter\s+\d+\b|bài\s+\d+\b)',
  caseSensitive: false,
);

/// Lời chào giống web: tiêu đề môn + (tuỳ chọn) danh sách bài trong lộ trình.
AiMessage buildCourseWelcomeOpening({
  required String courseLabel,
  String? courseName,
  List<String> lessonStarters = const [],
}) {
  final code = courseLabel.trim().isEmpty ? 'môn học' : courseLabel.trim();
  final name = (courseName ?? '').trim();
  final title = name.isEmpty ? code : '$code ($name)';
  final buffer = StringBuffer()
    ..writeln('## Chào mừng bạn đến với môn $title')
    ..writeln()
    ..writeln(
      'Mình sẽ đồng hành như gia sư: cùng xem môn này dạy những gì, '
      'rồi học từng phần theo lộ trình.',
    );

  final starters = pickOpeningLessonStarters(lessonStarters);
  final displayedStarters = starters.isEmpty
      ? <String>['phần mở đầu môn $code']
      : starters;
  buffer
    ..writeln()
    ..writeln('### Bắt đầu học một phần của môn');
  for (final topic in displayedStarters) {
    buffer.writeln('- $topic');
  }
  buffer.writeln(
    '\nChọn một gợi ý ở trên để bắt đầu học, hoặc nhập chủ đề khác.',
  );

  return AiMessage(
    id: 'opening-local-$code',
    content: buffer.toString().trim(),
    isUser: false,
    mode: 'TUTOR',
    proactive: true,
  );
}

@Deprecated('Use buildCourseWelcomeOpening')
AiMessage fallbackCourseWelcome({
  required String courseLabel,
  String? courseName,
}) {
  return buildCourseWelcomeOpening(
    courseLabel: courseLabel,
    courseName: courseName,
  );
}

List<String> pickOpeningLessonStarters(
  Iterable<String> titles, {
  int limit = 4,
}) {
  bool usable(String raw) {
    final title = raw.trim();
    if (title.isEmpty) return false;
    final lower = title.toLowerCase();
    if (lower.startsWith('0.')) return false;
    if (lower.contains('about the author')) return false;
    if (lower.contains('mục lục')) return false;
    return _numberedLessonTitle.hasMatch(title);
  }

  final picked = <String>[];
  for (final title in titles) {
    if (!usable(title)) continue;
    if (picked.contains(title)) continue;
    picked.add(title);
    if (picked.length >= limit) break;
  }
  return picked;
}

Set<String> tutorSessionClassIdAliases({Course? course, String? classId}) {
  final values = <String>{
    if ((classId ?? '').trim().isNotEmpty) classId!.trim(),
    if ((course?.classId ?? '').trim().isNotEmpty) course!.classId!.trim(),
    if ((course?.className ?? '').trim().isNotEmpty) course!.className!.trim(),
  };
  final expanded = <String>{};
  for (final value in values) {
    expanded.add(value);
    expanded.add(value.toUpperCase());
    final stripped = value.replaceFirst(
      RegExp(r'^Lớp\s+', caseSensitive: false),
      '',
    );
    if (stripped.trim().isNotEmpty) {
      expanded.add(stripped.trim());
      expanded.add(stripped.trim().toUpperCase());
    }
  }
  expanded.removeWhere((item) => item.trim().isEmpty);
  return expanded;
}

List<(String courseId, String? classId)> tutorSessionOpenAttempts({
  Course? course,
  String? courseId,
  String? classId,
}) {
  final seen = <String>{};
  final attempts = <(String, String?)>[];
  void offer(String rawCourseId, String? rawClassId) {
    final cid = rawCourseId.trim();
    if (cid.isEmpty) return;
    final cl = (rawClassId ?? '').trim();
    final key = '$cid|${cl.isEmpty ? '-' : cl}';
    if (!seen.add(key)) return;
    attempts.add((cid, cl.isEmpty ? null : cl));
  }

  final classAliases = tutorSessionClassIdAliases(
    course: course,
    classId: classId,
  );
  final courseKeys = <String>{
    if ((course?.id ?? '').trim().isNotEmpty) course!.id.trim(),
    if ((course?.code ?? '').trim().isNotEmpty) course!.code.trim(),
    if ((courseId ?? '').trim().isNotEmpty) courseId!.trim(),
  };

  for (final courseKey in courseKeys) {
    if (course?.classId?.trim().isNotEmpty == true) {
      offer(courseKey, course!.classId);
    }
    for (final classKey in classAliases) {
      offer(courseKey, classKey);
    }
    offer(courseKey, null);
  }
  return attempts;
}

String resolveTutorClassId({String? classId, String? className}) {
  for (final value in [classId, className]) {
    final text = (value ?? '').trim();
    if (text.isNotEmpty) return text;
  }
  return '';
}

bool conversationBelongsToCourse(
  AiConversation conversation, {
  String? courseId,
  String? courseCode,
}) {
  final cid = (conversation.courseId ?? '').trim();
  if (cid.isEmpty) return false;
  final id = (courseId ?? '').trim();
  final code = (courseCode ?? '').trim();
  return (id.isNotEmpty && cid == id) || (code.isNotEmpty && cid == code);
}

/// Môn đang chọn đã từng hỏi AI hay chưa — áp dụng cho mọi courseId/code,
/// không gắn cứng một môn. Conversation trống / chỉ lời chào không tính.
bool hasStudentChattedCourse(
  Iterable<AiConversation> conversations, {
  String? courseId,
  String? courseCode,
}) {
  final id = (courseId ?? '').trim();
  final code = (courseCode ?? '').trim();
  final scoped = id.isEmpty && code.isEmpty
      ? conversations
      : conversations.where(
          (item) =>
              conversationBelongsToCourse(item, courseId: id, courseCode: code),
        );
  return scoped.any(
    (item) => item.userQuestionCount > 0 || item.messageCount >= 2,
  );
}

bool isWelcomeOpeningText(String? content) {
  return _welcomeOpening.hasMatch(content ?? '');
}

bool isWelcomeTutorTurn(AiMessage message, {String? precedingUserQuestion}) {
  if (message.isUser) return false;
  if (message.proactive) return true;
  if ((precedingUserQuestion ?? '').trim().isNotEmpty) return false;
  return isWelcomeOpeningText(message.content);
}

final _numberedLessonTopic = RegExp(
  r'(?:bắt đầu\s+)?(?:bài|bai)\s+\d+',
  caseSensitive: false,
);

List<String> composerTopicsForSession({
  required List<String> sessionTopics,
  List<String> parsedLessons = const [],
}) {
  final session = sessionTopics
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
  final parsed = parsedLessons
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
  if (session.any(_numberedLessonTopic.hasMatch)) return session;
  if (parsed.isNotEmpty) return parsed;
  return session;
}

List<AiMessage> seedOpeningMessage(
  List<AiMessage> messages,
  AiMessage? opening,
) {
  if (opening == null || opening.content.trim().isEmpty) return messages;
  final current = List<AiMessage>.from(messages);
  final welcomeIndex = current.indexWhere((item) {
    if (item.id == opening.id) return true;
    if (item.content.trim() == opening.content.trim()) return true;
    return !item.isUser &&
        (item.proactive || isWelcomeOpeningText(item.content));
  });
  if (welcomeIndex < 0) return [opening, ...current];

  final existing = current[welcomeIndex];
  current[welcomeIndex] = existing.copyWith(
    content: opening.content,
    proactive: true,
    conversationId: opening.conversationId ?? existing.conversationId,
  );
  return current;
}
