import '../../core/utils/json_helpers.dart';

class TeacherEscalationItem {
  const TeacherEscalationItem({
    required this.id,
    required this.status,
    this.originalQuestion,
    this.aiAnswer,
    this.studentName,
    this.studentId,
    this.chatRoomId,
    this.courseName,
    this.createdAt,
  });

  final String id;
  final String status;
  final String? originalQuestion;
  final String? aiAnswer;
  final String? studentName;
  final String? studentId;
  final String? chatRoomId;
  final String? courseName;
  final DateTime? createdAt;

  factory TeacherEscalationItem.fromJson(Map<String, dynamic> json) {
    return TeacherEscalationItem(
      id: readId(json, keys: ['id', 'questionEscalationId', 'escalationId']),
      status: readString(json, 'status', fallback: 'PENDING_OFFER'),
      originalQuestion:
          json['originalQuestion']?.toString() ?? json['question']?.toString(),
      aiAnswer: json['aiAnswer']?.toString() ??
          json['answer']?.toString() ??
          json['aiResponse']?.toString(),
      studentName: json['studentName']?.toString() ??
          json['studentFullName']?.toString() ??
          json['userName']?.toString(),
      studentId: json['studentId']?.toString() ?? json['userId']?.toString(),
      chatRoomId: json['chatRoomId']?.toString() ?? json['roomId']?.toString(),
      courseName: json['courseName']?.toString() ?? json['courseId']?.toString(),
      createdAt: parseDateTime(json['createdAt'] ?? json['updatedAt']),
    );
  }
}

class MentorPendingReview {
  const MentorPendingReview({
    required this.id,
    this.question,
    this.aiAnswer,
    this.reviewType,
    this.status = 'NEEDS_MENTOR_REVIEW',
    this.studentName,
    this.courseName,
    this.reviewCount,
    this.distinctStudentCount,
    this.escalationTier,
    this.isGrouped = false,
  });

  final String id;
  final String? question;
  final String? aiAnswer;
  final String? reviewType;
  final String status;
  final String? studentName;
  final String? courseName;
  final int? reviewCount;
  final int? distinctStudentCount;
  final String? escalationTier;
  final bool isGrouped;

  factory MentorPendingReview.fromJson(Map<String, dynamic> json) {
    final representativeId = json['representativeReviewId']?.toString();
    final grouped = representativeId != null && representativeId.isNotEmpty;
    final reviewCount = (json['reviewCount'] as num?)?.toInt();
    final distinctStudents = (json['distinctStudentCount'] as num?)?.toInt();
    return MentorPendingReview(
      id: grouped
          ? representativeId
          : readId(json, keys: ['id', 'reviewId']),
      question:
          json['question']?.toString() ?? json['originalQuestion']?.toString(),
      aiAnswer: json['aiAnswer']?.toString() ?? json['answer']?.toString(),
      reviewType: json['reviewType']?.toString(),
      status: readString(
        json,
        'status',
        fallback: readString(json, 'queueStatus', fallback: 'NEEDS_MENTOR_REVIEW'),
      ),
      studentName: grouped && distinctStudents != null && distinctStudents > 1
          ? '$distinctStudents sinh viên'
          : json['studentName']?.toString(),
      courseName: json['courseName']?.toString() ?? json['courseId']?.toString(),
      reviewCount: reviewCount,
      distinctStudentCount: distinctStudents,
      escalationTier: json['escalationTier']?.toString(),
      isGrouped: grouped,
    );
  }
}

class TeacherAssignmentItem {
  const TeacherAssignmentItem({
    required this.id,
    required this.title,
    required this.courseId,
    required this.classId,
    this.description,
    this.dueAt,
    this.submissionCount,
    this.pendingGradeCount,
  });

  final String id;
  final String title;
  final String courseId;
  final String classId;
  final String? description;
  final DateTime? dueAt;
  final int? submissionCount;
  final int? pendingGradeCount;

  factory TeacherAssignmentItem.fromJson(Map<String, dynamic> json) {
    return TeacherAssignmentItem(
      id: readId(json, keys: ['id', 'assignmentId']),
      title: readString(json, 'title', fallback: readString(json, 'name')),
      courseId: readId(json, keys: ['courseId']),
      classId: readId(json, keys: ['classId', 'classSectionId']),
      description: json['description']?.toString(),
      dueAt: parseDateTime(json['dueAt'] ?? json['dueDate']),
      submissionCount: (json['submissionCount'] as num?)?.toInt(),
      pendingGradeCount: (json['pendingGradeCount'] as num?)?.toInt(),
    );
  }
}

class SubmissionItem {
  const SubmissionItem({
    required this.id,
    required this.assignmentId,
    required this.studentName,
    this.status = 'SUBMITTED',
    this.score,
    this.submittedAt,
  });

  final String id;
  final String assignmentId;
  final String studentName;
  final String status;
  final double? score;
  final DateTime? submittedAt;

  factory SubmissionItem.fromJson(Map<String, dynamic> json) {
    return SubmissionItem(
      id: readId(json, keys: ['id', 'submissionId']),
      assignmentId: readString(json, 'assignmentId'),
      studentName: readString(
        json,
        'studentName',
        fallback: readString(json, 'studentFullName', fallback: 'Sinh viên'),
      ),
      status: readString(json, 'status', fallback: 'SUBMITTED'),
      score: _toDouble(json['score']),
      submittedAt: parseDateTime(json['submittedAt'] ?? json['createdAt']),
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}
