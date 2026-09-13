import 'package:ai_tutor/features/quiz/application/quiz_hub_stats.dart';
import 'package:ai_tutor/shared/models/quiz.dart';
import 'package:flutter_test/flutter_test.dart';

QuizSession _session({
  required String id,
  required String status,
  String quizType = 'SELF_PRACTICE',
  String? teacherReviewStatus,
  int? score,
  int? teacherReviewedScore,
  DateTime? createdAt,
}) {
  return QuizSession(
    id: id,
    studentId: 's1',
    courseId: 'PRJ301',
    questions: const [],
    status: status,
    quizType: quizType,
    teacherReviewStatus: teacherReviewStatus,
    score: score,
    teacherReviewedScore: teacherReviewedScore,
    createdAt: createdAt,
  );
}

void main() {
  test('aggregates hub stats like the web quiz page', () {
    final stats = QuizHubStats.from(
      assignedCount: 2,
      sessions: [
        _session(
          id: 'a',
          status: 'GENERATED',
          createdAt: DateTime(2026, 9, 10),
        ),
        _session(
          id: 'b',
          status: 'SUBMITTED',
          createdAt: DateTime(2026, 9, 12),
        ),
        _session(
          id: 'c',
          status: 'SUBMITTED',
          quizType: 'ASSIGNED',
          teacherReviewStatus: 'REVIEWED',
          createdAt: DateTime(2026, 9, 13),
        ),
      ],
    );

    expect(stats.assigned, 2);
    expect(stats.inProgress, 1);
    expect(stats.submitted, 2);
    expect(stats.reviewed, 1);
    expect(stats.latest, DateTime(2026, 9, 13));
  });

  test('hides assigned answer keys until teacher review', () {
    final waiting = _session(
      id: 'w',
      status: 'SUBMITTED',
      quizType: 'ASSIGNED',
      score: 8,
    );
    final reviewed = _session(
      id: 'r',
      status: 'SUBMITTED',
      quizType: 'ASSIGNED',
      teacherReviewStatus: 'REVIEWED',
      score: 6,
      teacherReviewedScore: 9,
    );

    expect(quizResultStatusLabel(waiting), 'Chờ giảng viên duyệt');
    expect(shouldHideQuizAnswerKey(waiting), isTrue);
    expect(quizDisplayScore(reviewed), 9);
    expect(shouldHideQuizAnswerKey(reviewed), isFalse);
  });
}
