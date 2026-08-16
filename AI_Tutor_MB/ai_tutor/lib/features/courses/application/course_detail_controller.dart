import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/course.dart';
import '../../assignments/data/assignments_repository.dart';
import '../../auth/application/auth_controller.dart';

/// Tính % tiến độ của 1 môn dựa trên số bài tập đã nộp/đã chấm trên tổng số
/// bài tập của môn đó. Trang môn học giờ chỉ còn trang "Thông tin" nên không
/// cần fetch danh sách tài liệu nữa như trước.
class CourseProgressController
    extends AutoDisposeFamilyAsyncNotifier<int, Course> {
  @override
  Future<int> build(Course course) async {
    final studentId = ref.watch(currentUserIdProvider);
    final assignments = await ref
        .read(assignmentsRepositoryProvider)
        .fetchAssignments(studentId);
    final courseAssignments = assignments
        .where((a) => a.belongsToCourse(course))
        .toList();
    if (courseAssignments.isEmpty) return 0;

    final reviewed = courseAssignments
        .where((a) => a.status == 'REVIEWED' || a.status == 'SUBMITTED')
        .length;
    return ((reviewed / courseAssignments.length) * 100)
        .round()
        .clamp(0, 100);
  }
}

final courseProgressControllerProvider = AutoDisposeAsyncNotifierProviderFamily<
  CourseProgressController,
  int,
  Course
>(CourseProgressController.new);
