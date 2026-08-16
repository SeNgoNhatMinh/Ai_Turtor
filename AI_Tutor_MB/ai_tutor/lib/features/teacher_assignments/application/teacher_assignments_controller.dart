import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/class_section.dart';
import '../../../shared/models/teacher_inbox.dart';
import '../../auth/application/auth_controller.dart';
import '../../classes/data/teacher_classes_repository.dart';
import '../data/teacher_assignments_repository.dart';

class TeacherClassAssignmentsController
    extends
        AutoDisposeFamilyAsyncNotifier<
          List<TeacherAssignmentItem>,
          ({String courseId, String classId})
        > {
  @override
  Future<List<TeacherAssignmentItem>> build(
    ({String courseId, String classId}) params,
  ) async {
    ref.watch(realtimeRefreshTickProvider);
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref
        .read(teacherAssignmentsRepositoryProvider)
        .fetchClassAssignments(
          courseId: params.courseId,
          classId: params.classId,
          teacherId: teacherId,
        );
  }

  Future<void> createAssignment({
    required String courseId,
    required String classId,
    required String filePath,
    required String title,
    String? description,
    DateTime? dueAt,
  }) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    await ref
        .read(teacherAssignmentsRepositoryProvider)
        .createAssignment(
          courseId: courseId,
          classId: classId,
          teacherId: teacherId,
          filePath: filePath,
          title: title,
          description: description,
          dueAt: dueAt,
        );
    ref.invalidateSelf();
  }

  Future<void> updateAssignment(
    String assignmentId, {
    String? title,
    String? description,
    DateTime? dueAt,
  }) async {
    await ref
        .read(teacherAssignmentsRepositoryProvider)
        .updateAssignment(
          assignmentId: assignmentId,
          title: title,
          description: description,
          dueAt: dueAt,
        );
    ref.invalidateSelf();
  }

  Future<void> deleteAssignment(String assignmentId) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    await ref
        .read(teacherAssignmentsRepositoryProvider)
        .deleteAssignment(assignmentId: assignmentId, teacherId: teacherId);
    ref.invalidateSelf();
  }
}

final teacherClassAssignmentsControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      TeacherClassAssignmentsController,
      List<TeacherAssignmentItem>,
      ({String courseId, String classId})
    >(TeacherClassAssignmentsController.new);

class TeacherSubmissionsController
    extends AutoDisposeFamilyAsyncNotifier<List<SubmissionItem>, String> {
  @override
  Future<List<SubmissionItem>> build(String assignmentId) async {
    ref.watch(realtimeRefreshTickProvider);
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref
        .read(teacherAssignmentsRepositoryProvider)
        .fetchSubmissions(assignmentId: assignmentId, teacherId: teacherId);
  }
}

final teacherSubmissionsControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      TeacherSubmissionsController,
      List<SubmissionItem>,
      String
    >(TeacherSubmissionsController.new);

/// Tổng hợp mọi bài nộp của cả lớp (khác với xem theo từng bài tập).
class TeacherClassSubmissionsController extends AutoDisposeFamilyAsyncNotifier<
    List<SubmissionItem>, ({String courseId, String classId})> {
  @override
  Future<List<SubmissionItem>> build(
    ({String courseId, String classId}) params,
  ) async {
    ref.watch(realtimeRefreshTickProvider);
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref
        .read(teacherAssignmentsRepositoryProvider)
        .fetchClassSubmissions(
          courseId: params.courseId,
          classId: params.classId,
          teacherId: teacherId,
        );
  }
}

final teacherClassSubmissionsControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      TeacherClassSubmissionsController,
      List<SubmissionItem>,
      ({String courseId, String classId})
    >(TeacherClassSubmissionsController.new);

class GradeSubmissionController extends AutoDisposeAsyncNotifier<void> {
  String? _submissionId;

  @override
  Future<void> build() async {}

  void bind(String submissionId) {
    _submissionId = submissionId;
  }

  Future<void> submitGrade({
    required double score,
    String? feedback,
    List<String>? weakTopics,
  }) async {
    final submissionId = _submissionId;
    if (submissionId == null) {
      throw StateError('Submission not bound');
    }
    final teacherId = ref.read(currentTeacherIdProvider);
    await ref
        .read(teacherAssignmentsRepositoryProvider)
        .reviewSubmission(
          submissionId: submissionId,
          teacherId: teacherId,
          score: score,
          teacherFeedback: feedback,
          weakTopics: weakTopics,
        );
  }
}

final gradeSubmissionControllerProvider =
    AutoDisposeAsyncNotifierProvider<GradeSubmissionController, void>(
      GradeSubmissionController.new,
    );

/// Classes list reused on assignments tab for class picker.
final teacherAssignmentClassesProvider =
    AutoDisposeAsyncNotifierProvider<
      TeacherClassesForAssignmentsController,
      List<ClassSection>
    >(TeacherClassesForAssignmentsController.new);

class TeacherClassesForAssignmentsController
    extends AutoDisposeAsyncNotifier<List<ClassSection>> {
  @override
  Future<List<ClassSection>> build() async {
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref
        .read(teacherClassesRepositoryProvider)
        .fetchClassSections(teacherId);
  }
}
