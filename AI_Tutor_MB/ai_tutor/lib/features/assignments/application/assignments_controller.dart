import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/assignment.dart';
import '../../../shared/models/course.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/data/courses_repository.dart';
import '../data/assignments_repository.dart';

class StudentAssignmentsData {
  const StudentAssignmentsData({
    required this.assignments,
    required this.submissions,
    this.courses = const [],
  });

  final List<Assignment> assignments;
  final List<AssignmentSubmission> submissions;
  final List<Course> courses;

  Assignment enriched(Assignment assignment) {
    AssignmentSubmission? submission;
    for (final item in submissions) {
      if (item.assignmentId == assignment.id) {
        submission = item;
        break;
      }
    }
    String? courseCode = assignment.courseCode;
    if (courseCode == null && assignment.courseId != null) {
      for (final course in courses) {
        if (course.id == assignment.courseId ||
            course.code == assignment.courseId) {
          courseCode = course.code;
          break;
        }
      }
      courseCode ??= _courseIdAsDisplayCode(assignment.courseId);
    }
    if (submission == null) {
      return Assignment(
        id: assignment.id,
        title: assignment.title,
        courseId: assignment.courseId,
        courseCode: courseCode,
        courseName: assignment.courseName,
        description: assignment.description,
        dueAt: assignment.dueAt,
        status: assignment.status,
        score: assignment.score,
        feedback: assignment.feedback,
      );
    }
    return Assignment(
      id: assignment.id,
      title: assignment.title,
      courseId: assignment.courseId,
      courseCode: courseCode,
      courseName: assignment.courseName,
      description: assignment.description,
      dueAt: assignment.dueAt,
      status: submission.status,
      score: submission.score ?? assignment.score,
      feedback: submission.teacherFeedback ?? assignment.feedback,
    );
  }
}

String? _courseIdAsDisplayCode(String? courseId) {
  if (courseId == null || courseId.isEmpty) return null;
  if (courseId.contains('-') && courseId.length > 12) return null;
  return courseId;
}

class AssignmentsController
    extends AutoDisposeAsyncNotifier<StudentAssignmentsData> {
  @override
  Future<StudentAssignmentsData> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final studentId = ref.watch(currentUserIdProvider);
    final repo = ref.read(assignmentsRepositoryProvider);
    final results = await Future.wait([
      repo.fetchAssignments(studentId),
      repo.fetchSubmissions(studentId),
      ref.read(coursesRepositoryProvider).fetchStudentCourses(studentId),
    ]);
    return StudentAssignmentsData(
      assignments: results[0] as List<Assignment>,
      submissions: results[1] as List<AssignmentSubmission>,
      courses: results[2] as List<Course>,
    );
  }

  Future<void> submit({
    required String assignmentId,
    required String filePath,
    String? fileName,
    String? note,
  }) async {
    await ref
        .read(assignmentsRepositoryProvider)
        .submitAssignment(
          assignmentId: assignmentId,
          studentId: ref.read(currentUserIdProvider),
          filePath: filePath,
          fileName: fileName,
          note: note,
        );
    ref.invalidateSelf();
  }
}

final assignmentsControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      AssignmentsController,
      StudentAssignmentsData
    >(AssignmentsController.new);
