import '../../core/utils/json_helpers.dart';

class TeacherDashboard {
  const TeacherDashboard({
    this.classCount = 0,
    this.pendingEscalations = 0,
    this.pendingGrading = 0,
    this.pendingReviews = 0,
    this.weakTopics = const [],
    this.todayTasks = const [],
  });

  final int classCount;
  final int pendingEscalations;
  final int pendingGrading;
  final int pendingReviews;
  final List<WeakTopicStat> weakTopics;
  final List<TodayTask> todayTasks;

  factory TeacherDashboard.fromJson(Map<String, dynamic> json) {
    final analytics = json['analytics'];
    final analyticsMap = analytics is Map
        ? Map<String, dynamic>.from(analytics)
        : const <String, dynamic>{};

    int readInt(
      dynamic direct,
      String analyticsKey, [
      List<String> altKeys = const [],
    ]) {
      if (direct is num) return direct.toInt();
      final fromAnalytics = analyticsMap[analyticsKey];
      if (fromAnalytics is num) return fromAnalytics.toInt();
      for (final key in altKeys) {
        final value = json[key];
        if (value is num) return value.toInt();
      }
      return 0;
    }

    var pendingGrading = readInt(
      json['pendingGrading'],
      'pendingSubmissionCount',
      ['pendingSubmissions'],
    );
    if (pendingGrading == 0) {
      final submissions = unwrapList(json['submissions']);
      pendingGrading = submissions.where((item) {
        if (item is! Map) return false;
        final status = item['status']?.toString().toUpperCase();
        return status == 'SUBMITTED' ||
            status == 'PENDING_REVIEW' ||
            status == 'NEEDS_REVIEW';
      }).length;
    }

    return TeacherDashboard(
      classCount: readInt(json['classCount'], 'classCount', ['totalClasses']),
      pendingEscalations: readInt(
        json['pendingEscalations'],
        'pendingEscalationCount',
        ['escalationCount'],
      ),
      pendingGrading: pendingGrading,
      pendingReviews: readInt(
        json['pendingReviews'],
        'pendingKnowledgeCandidateCount',
        ['reviewCount'],
      ),
      weakTopics: _parseWeakTopics(json),
      todayTasks: _parseTodayTasks(json),
    );
  }
}

List<WeakTopicStat> _parseWeakTopics(Map<String, dynamic> json) {
  final direct = parseList(json['weakTopics'], WeakTopicStat.fromJson);
  if (direct.isNotEmpty) return direct;

  final counts = json['weakTopicCounts'];
  if (counts is Map) {
    return counts.entries
        .map(
          (entry) => WeakTopicStat(
            topic: entry.key,
            count: (entry.value as num?)?.toInt() ?? 0,
          ),
        )
        .toList()
      ..sort((a, b) => b.count.compareTo(a.count));
  }
  return const [];
}

List<TodayTask> _parseTodayTasks(Map<String, dynamic> json) {
  final direct = parseList(
    json['todayTasks'] ?? json['actionItems'],
    TodayTask.fromJson,
  );
  if (direct.isNotEmpty) return direct;

  final tasks = <TodayTask>[];
  for (final item in unwrapList(json['escalations'])) {
    if (item is! Map) continue;
    final status = item['status']?.toString().toUpperCase();
    if (status == 'COMPLETED' || status == 'CANCELLED') continue;
    final question = item['originalQuestion']?.toString();
    tasks.add(
      TodayTask(
        title: question != null && question.isNotEmpty
            ? question
            : 'Escalation chờ xử lý',
        type: 'ESCALATION',
        referenceId: item['id']?.toString(),
      ),
    );
  }

  for (final item in unwrapList(json['submissions'])) {
    if (item is! Map) continue;
    final status = item['status']?.toString().toUpperCase();
    if (status != 'SUBMITTED' && status != 'PENDING_REVIEW') continue;
    tasks.add(
      TodayTask(
        title: item['assignmentTitle']?.toString() ?? 'Bài nộp cần chấm',
        type: 'GRADING',
        referenceId: item['assignmentId']?.toString(),
      ),
    );
  }

  return tasks;
}

class WeakTopicStat {
  const WeakTopicStat({required this.topic, this.count = 0});

  final String topic;
  final int count;

  factory WeakTopicStat.fromJson(Map<String, dynamic> json) {
    return WeakTopicStat(
      topic: readString(json, 'topic', fallback: readString(json, 'name')),
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class TodayTask {
  const TodayTask({required this.title, this.type, this.referenceId});

  final String title;
  final String? type;
  final String? referenceId;

  factory TodayTask.fromJson(Map<String, dynamic> json) {
    return TodayTask(
      title: readString(json, 'title', fallback: readString(json, 'label')),
      type: json['type']?.toString(),
      referenceId: json['referenceId']?.toString() ?? json['id']?.toString(),
    );
  }
}
