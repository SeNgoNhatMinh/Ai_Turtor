import '../../core/utils/json_helpers.dart';

class StudentDashboard {
  const StudentDashboard({
    this.weakTopics = const [],
    this.upcomingAssignments = const [],
    this.enrolledCourseCount = 0,
    this.questionsAsked = 0,
    this.studyStreak = 0,
  });

  final List<String> weakTopics;
  final List<String> upcomingAssignments;
  final int enrolledCourseCount;
  final int questionsAsked;
  final int studyStreak;

  factory StudentDashboard.fromJson(Map<String, dynamic> json) {
    final enrollments = unwrapList(json['enrollments']);
    final assignments = unwrapList(json['assignments']);
    final submissions = unwrapList(json['submissions']);
    final escalations = unwrapList(json['escalations']);

    final submittedAssignmentIds = submissions
        .whereType<Map>()
        .map((item) => item['assignmentId']?.toString())
        .whereType<String>()
        .toSet();

    final upcoming = assignments.whereType<Map>().map((item) {
      final id = item['id']?.toString();
      if (id != null && submittedAssignmentIds.contains(id)) return null;
      final title = item['title']?.toString();
      if (title != null && title.isNotEmpty) return title;
      return item['assignmentTitle']?.toString();
    }).whereType<String>().toList();

    final enrolledCourseCount =
        (json['enrolledCourseCount'] as num?)?.toInt() ??
        (json['courseCount'] as num?)?.toInt() ??
        enrollments
            .whereType<Map>()
            .map((item) => item['courseId']?.toString())
            .whereType<String>()
            .toSet()
            .length;

    final questionsAsked =
        (json['questionsAsked'] as num?)?.toInt() ??
        (json['totalQuestionsAsked'] as num?)?.toInt() ??
        (json['aiQuestionCount'] as num?)?.toInt() ??
        (json['questionCount'] as num?)?.toInt() ??
        escalations.length;

    return StudentDashboard(
      weakTopics: parseStringList(json['weakTopics']),
      upcomingAssignments: upcoming.isNotEmpty
          ? upcoming
          : parseStringList(
              json['upcomingAssignments'] ?? json['pendingTasks'],
            ),
      enrolledCourseCount: enrolledCourseCount,
      questionsAsked: questionsAsked,
      studyStreak:
          (json['studyStreak'] as num?)?.toInt() ??
          (json['streak'] as num?)?.toInt() ??
          (json['streakDays'] as num?)?.toInt() ??
          0,
    );
  }
}
