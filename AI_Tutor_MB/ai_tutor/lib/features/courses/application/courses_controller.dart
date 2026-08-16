import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/course.dart';
import '../../auth/application/auth_controller.dart';
import '../data/courses_repository.dart';

class CoursesController extends AutoDisposeAsyncNotifier<List<Course>> {
  @override
  Future<List<Course>> build() async {
    final studentId = ref.watch(currentUserIdProvider);
    return ref.read(coursesRepositoryProvider).fetchStudentCourses(studentId);
  }
}

final coursesControllerProvider =
    AutoDisposeAsyncNotifierProvider<CoursesController, List<Course>>(
      CoursesController.new,
    );

final selectedCourseProvider = StateProvider<Course?>((ref) => null);
