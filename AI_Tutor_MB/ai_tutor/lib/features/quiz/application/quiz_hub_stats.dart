import '../../../shared/models/quiz.dart';

class QuizHubStats {
  const QuizHubStats({
    required this.assigned,
    required this.inProgress,
    required this.submitted,
    required this.reviewed,
    this.latest,
  });

  final int assigned;
  final int inProgress;
  final int submitted;
  final int reviewed;
  final DateTime? latest;

  factory QuizHubStats.from({
    required List<QuizSession> sessions,
    required int assignedCount,
  }) {
    var inProgress = 0;
    var submitted = 0;
    var reviewed = 0;
    DateTime? latest;
    for (final session in sessions) {
      if (session.isSubmitted) {
        submitted += 1;
        if (isTeacherReviewed(session)) reviewed += 1;
      } else {
        inProgress += 1;
      }
      final stamp = session.submittedAt ?? session.createdAt;
      if (stamp != null && (latest == null || stamp.isAfter(latest))) {
        latest = stamp;
      }
    }
    return QuizHubStats(
      assigned: assignedCount,
      inProgress: inProgress,
      submitted: submitted,
      reviewed: reviewed,
      latest: latest,
    );
  }
}

String quizResultStatusLabel(QuizSession session) {
  final reviewStatus = (session.teacherReviewStatus ?? '').toUpperCase();
  if (reviewStatus.contains('REVIEWED')) return 'Giảng viên đã duyệt';
  if (session.quizType == 'ASSIGNED' && session.isSubmitted) {
    return 'Chờ giảng viên duyệt';
  }
  if (session.isSubmitted) return 'Backend đã chấm';
  return session.status;
}

bool isTeacherReviewed(QuizSession session) {
  return (session.teacherReviewStatus ?? '').toUpperCase().contains('REVIEWED');
}

bool shouldHideQuizAnswerKey(QuizSession session) {
  if (!session.isSubmitted) return true;
  if (session.quizType != 'ASSIGNED') return false;
  return !isTeacherReviewed(session);
}

int quizDisplayScore(QuizSession session) {
  return session.teacherReviewedScore ?? session.score ?? 0;
}

int quizDisplayMaxScore(QuizSession session) {
  return session.maxScore ?? session.questions.length;
}
