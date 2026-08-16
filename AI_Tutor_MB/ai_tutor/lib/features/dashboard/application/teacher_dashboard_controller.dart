import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/requester.dart';
import '../../../shared/models/teacher_dashboard.dart';
import '../../auth/application/auth_controller.dart';
import '../data/teacher_dashboard_repository.dart';

class TeacherDashboardController
    extends AutoDisposeAsyncNotifier<TeacherDashboard> {
  @override
  Future<TeacherDashboard> build() async {
    final teacherId = ref.watch(currentTeacherIdProvider);
    final requester = readRequester(ref);
    return ref
        .read(teacherDashboardRepositoryProvider)
        .fetchDashboard(
          teacherId: teacherId,
          requesterId: requester.requesterId,
          requesterRole: requester.requesterRole,
        );
  }
}

final teacherDashboardControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      TeacherDashboardController,
      TeacherDashboard
    >(TeacherDashboardController.new);
