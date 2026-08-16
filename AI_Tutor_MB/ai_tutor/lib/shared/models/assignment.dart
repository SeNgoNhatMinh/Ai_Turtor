import '../../core/utils/json_helpers.dart';
import 'course.dart';

class Assignment {
  const Assignment({
    required this.id,
    required this.title,
    this.courseId,
    this.courseCode,
    this.courseName,
    this.description,
    this.dueAt,
    this.status,
    this.score,
    this.feedback,
  });

  final String id;
  final String title;
  final String? courseId;
  final String? courseCode;
  final String? courseName;
  final String? description;
  final DateTime? dueAt;
  final String? status;
  final double? score;
  final String? feedback;

  bool get isOverdue {
    if (dueAt == null || status == 'SUBMITTED' || status == 'REVIEWED') {
      return false;
    }
    return DateTime.now().isAfter(dueAt!);
  }

  factory Assignment.fromJson(Map<String, dynamic> json) {
    return Assignment(
      id: readId(json, keys: ['id', 'assignmentId']),
      title: readString(json, 'title', fallback: readString(json, 'name')),
      courseId: json['courseId']?.toString(),
      courseCode: json['courseCode']?.toString(),
      courseName: json['courseName']?.toString(),
      description: json['description']?.toString(),
      dueAt: parseDateTime(json['dueAt'] ?? json['dueDate']),
      status:
          json['status']?.toString() ?? json['submissionStatus']?.toString(),
      score: _parseScore(json['score']),
      feedback: json['teacherFeedback']?.toString() ?? json['feedback']?.toString(),
    );
  }

  static double? _parseScore(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  /// Backend có thể gửi `courseId` là mã môn (PRJ301) hoặc UUID.
  bool belongsToCourse(Course course) {
    final ref = courseId;
    if (ref == course.id || ref == course.code) return true;
    return courseCode == course.code;
  }
}

class AssignmentSubmission {
  const AssignmentSubmission({
    required this.id,
    required this.assignmentId,
    this.status = 'SUBMITTED',
    this.score,
    this.teacherFeedback,
    this.weakTopics = const [],
  });

  final String id;
  final String assignmentId;
  final String status;
  final double? score;
  final String? teacherFeedback;
  final List<String> weakTopics;

  factory AssignmentSubmission.fromJson(Map<String, dynamic> json) {
    return AssignmentSubmission(
      id: readId(json, keys: ['id', 'submissionId']),
      assignmentId: readString(
        json,
        'assignmentId',
        fallback: readId(json, keys: ['assignmentId']),
      ),
      status: readString(json, 'status', fallback: 'SUBMITTED'),
      score: Assignment._parseScore(json['score']),
      teacherFeedback: json['teacherFeedback']?.toString(),
      weakTopics: parseStringList(json['weakTopics']),
    );
  }
}
