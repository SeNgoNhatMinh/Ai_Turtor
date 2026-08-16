import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/quiz.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../data/quiz_repository.dart';

// ── Student: quiz history for a course ──────────────────────────

class StudentQuizHistoryController
    extends AutoDisposeFamilyAsyncNotifier<List<QuizSession>, String> {
  @override
  Future<List<QuizSession>> build(String courseId) async {
    final userId = ref.watch(currentUserIdProvider);
    final courses = ref.watch(coursesControllerProvider).valueOrNull ?? [];
    final course = courses.where((c) => c.id == courseId).firstOrNull;
    final resolvedCourseId =
        course != null && course.code.isNotEmpty ? course.code : courseId;
    return ref.read(quizRepositoryProvider).listStudentQuizzes(
      studentId: userId,
      courseId: resolvedCourseId,
    );
  }
}

final studentQuizHistoryProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      StudentQuizHistoryController,
      List<QuizSession>,
      String
    >(StudentQuizHistoryController.new);

/// Load a submitted quiz with full answer key for review.
final quizReviewProvider = FutureProvider.autoDispose.family<QuizSession, String>(
  (ref, quizSessionId) =>
      ref.read(quizRepositoryProvider).getQuiz(quizSessionId),
);

// ── Student: assigned quiz list for a course ────────────────────

class StudentQuizAssignmentsController
    extends AutoDisposeFamilyAsyncNotifier<List<QuizAssignment>, String> {
  @override
  Future<List<QuizAssignment>> build(String courseId) async {
    final userId = ref.watch(currentUserIdProvider);
    final courses = ref.watch(coursesControllerProvider).valueOrNull ?? [];
    final course = courses.where((c) => c.id == courseId).firstOrNull;
    final resolvedCourseId =
        course != null && course.code.isNotEmpty ? course.code : courseId;
    return ref.read(quizRepositoryProvider).listStudentQuizAssignments(
      studentId: userId,
      courseId: resolvedCourseId,
      classId: course?.classId,
    );
  }
}

final studentQuizAssignmentsProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      StudentQuizAssignmentsController,
      List<QuizAssignment>,
      String
    >(StudentQuizAssignmentsController.new);

// ── Active quiz session state ────────────────────────────────────

class ActiveQuizController extends AutoDisposeAsyncNotifier<QuizSession?> {
  @override
  Future<QuizSession?> build() async => null;

  void loadSession(QuizSession session) {
    state = AsyncData(session);
  }

  Future<void> generate({
    required String courseId,
    String? classId,
    String? topic,
    String? suggestionText,
    int questionCount = 5,
  }) async {
    state = const AsyncLoading();
    final userId = ref.read(currentUserIdProvider);
    final token = ref.read(currentAuthTokenProvider);
    final courses = ref.read(coursesControllerProvider).valueOrNull ?? [];
    final course = courses.where((c) => c.id == courseId).firstOrNull;
    final resolvedCourseId =
        course != null && course.code.isNotEmpty ? course.code : courseId;
    final resolvedClassId = classId ?? course?.classId;

    state = await AsyncValue.guard(
      () => ref.read(quizRepositoryProvider).generateQuiz(
        studentId: userId,
        courseId: resolvedCourseId,
        classId: resolvedClassId,
        topic: topic,
        suggestionText: suggestionText,
        questionCount: questionCount,
        authToken: token ?? '',
      ),
    );
  }

  Future<void> startAssigned({
    required String assignmentId,
  }) async {
    state = const AsyncLoading();
    final userId = ref.read(currentUserIdProvider);
    state = await AsyncValue.guard(
      () => ref.read(quizRepositoryProvider).startAssignedQuiz(
        assignmentId: assignmentId,
        studentId: userId,
      ),
    );
  }

  Future<void> submit(List<Map<String, String>> answers) async {
    final quiz = state.valueOrNull;
    final quizId = quiz?.id;
    if (quizId == null) return;
    state = const AsyncLoading();
    final userId = ref.read(currentUserIdProvider);
    final token = ref.read(currentAuthTokenProvider);
    state = await AsyncValue.guard(
      () => ref.read(quizRepositoryProvider).submitQuiz(
        quizSessionId: quizId,
        studentId: userId,
        courseId: quiz!.courseId,
        classId: quiz.classId,
        answers: answers,
        authToken: token ?? '',
      ),
    );
  }

  void reset() => state = const AsyncData(null);
}

final activeQuizProvider =
    AutoDisposeAsyncNotifierProvider<ActiveQuizController, QuizSession?>(
      ActiveQuizController.new,
    );

// ── Teacher: quiz assignments list ───────────────────────────────

class TeacherQuizAssignmentsController
    extends AutoDisposeAsyncNotifier<List<QuizAssignment>> {
  @override
  Future<List<QuizAssignment>> build() async {
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref.read(quizRepositoryProvider).listTeacherQuizAssignments(teacherId);
  }

  Future<QuizAssignment> generate({
    required String courseId,
    required String title,
    String? classId,
    String? topic,
    int questionCount = 5,
  }) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    final token = ref.read(currentAuthTokenProvider);
    final draft = await ref.read(quizRepositoryProvider).generateQuizAssignment(
      teacherId: teacherId,
      courseId: courseId,
      title: title,
      classId: classId,
      topic: topic,
      questionCount: questionCount,
      authToken: token ?? '',
    );
    ref.invalidateSelf();
    return draft;
  }

  Future<void> publish({
    required String assignmentId,
    String targetType = 'CLASS',
    List<String>? targetStudentIds,
  }) async {
    await ref.read(quizRepositoryProvider).publishQuizAssignment(
      assignmentId: assignmentId,
      targetType: targetType,
      targetStudentIds: targetStudentIds,
    );
    ref.invalidateSelf();
  }

  Future<void> delete(String assignmentId) async {
    await ref.read(quizRepositoryProvider).deleteQuizAssignment(assignmentId);
    ref.invalidateSelf();
  }
}

final teacherQuizAssignmentsProvider =
    AutoDisposeAsyncNotifierProvider<
      TeacherQuizAssignmentsController,
      List<QuizAssignment>
    >(TeacherQuizAssignmentsController.new);

// ── Teacher: review one AI-scored quiz session ───────────────────

class TeacherQuizReviewController extends AutoDisposeAsyncNotifier<QuizSession?> {
  @override
  Future<QuizSession?> build() async => null;

  Future<void> loadSession(String quizSessionId) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(quizRepositoryProvider).getQuiz(quizSessionId),
    );
  }

  Future<void> submitReview({
    required String quizSessionId,
    int? reviewedScore,
    String? feedback,
  }) async {
    final reviewed = await ref.read(quizRepositoryProvider).teacherReviewQuiz(
          quizSessionId: quizSessionId,
          reviewedScore: reviewedScore,
          feedback: feedback,
        );
    state = AsyncData(reviewed);
  }

  void reset() => state = const AsyncData(null);
}

final teacherQuizReviewProvider =
    AutoDisposeAsyncNotifierProvider<TeacherQuizReviewController, QuizSession?>(
      TeacherQuizReviewController.new,
    );
