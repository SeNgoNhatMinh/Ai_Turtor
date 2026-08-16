import '../../core/utils/json_helpers.dart';

class KnowledgeCandidateItem {
  const KnowledgeCandidateItem({
    required this.id,
    required this.status,
    this.question,
    this.proposedAnswer,
    this.correctedAnswer,
    this.candidateType,
    this.courseName,
    this.courseId,
    this.sourceMentorId,
    this.sourceMentorName,
    this.createdAt,
  });

  final String id;
  final String status;
  final String? question;
  final String? proposedAnswer;
  final String? correctedAnswer;
  final String? candidateType;
  final String? courseName;
  final String? courseId;
  final String? sourceMentorId;
  final String? sourceMentorName;
  final DateTime? createdAt;

  String get displayAnswer => correctedAnswer ?? proposedAnswer ?? '—';

  factory KnowledgeCandidateItem.fromJson(Map<String, dynamic> json) {
    return KnowledgeCandidateItem(
      id: readId(json, keys: ['id', 'candidateId', 'knowledgeCandidateId']),
      status: readString(json, 'status', fallback: 'PENDING_SENIOR_REVIEW'),
      question:
          json['question']?.toString() ?? json['originalQuestion']?.toString(),
      proposedAnswer:
          json['proposedAnswer']?.toString() ??
          json['answer']?.toString() ??
          json['proposedContent']?.toString(),
      correctedAnswer:
          json['correctedAnswer']?.toString() ??
          json['contentOverride']?.toString(),
      candidateType: json['candidateType']?.toString(),
      courseName: json['courseName']?.toString(),
      courseId: json['courseId']?.toString(),
      sourceMentorId:
          json['sourceMentorId']?.toString() ??
          json['mentorId']?.toString() ??
          json['createdById']?.toString(),
      sourceMentorName:
          json['sourceMentorName']?.toString() ??
          json['mentorName']?.toString(),
      createdAt: parseDateTime(json['createdAt'] ?? json['updatedAt']),
    );
  }
}

class SeniorPendingReview {
  const SeniorPendingReview({
    required this.id,
    this.question,
    this.aiAnswer,
    this.reviewType,
    this.status = 'NEEDS_SENIOR_REVIEW',
    this.studentName,
    this.courseName,
    this.courseId,
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
  final String? courseId;
  final int? reviewCount;
  final int? distinctStudentCount;
  final String? escalationTier;
  final bool isGrouped;

  factory SeniorPendingReview.fromJson(Map<String, dynamic> json) {
    final representativeId = json['representativeReviewId']?.toString();
    final grouped = representativeId != null && representativeId.isNotEmpty;
    final distinctStudents = (json['distinctStudentCount'] as num?)?.toInt();
    return SeniorPendingReview(
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
        fallback: readString(json, 'queueStatus', fallback: 'NEEDS_SENIOR_REVIEW'),
      ),
      studentName: grouped && distinctStudents != null && distinctStudents > 1
          ? '$distinctStudents sinh viên'
          : json['studentName']?.toString(),
      courseName: json['courseName']?.toString(),
      courseId: json['courseId']?.toString(),
      reviewCount: (json['reviewCount'] as num?)?.toInt(),
      distinctStudentCount: distinctStudents,
      escalationTier: json['escalationTier']?.toString(),
      isGrouped: grouped,
    );
  }
}
