import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/class_section.dart';
import '../../auth/application/auth_controller.dart';
import '../data/teacher_classes_repository.dart';

class TeacherClassesController
    extends AutoDisposeAsyncNotifier<List<ClassSection>> {
  @override
  Future<List<ClassSection>> build() async {
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref
        .read(teacherClassesRepositoryProvider)
        .fetchClassSections(teacherId);
  }
}

final teacherClassesControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      TeacherClassesController,
      List<ClassSection>
    >(TeacherClassesController.new);

class TeacherRosterController
    extends
        AutoDisposeFamilyAsyncNotifier<
          List<RosterStudent>,
          ({String courseId, String classId})
        > {
  @override
  Future<List<RosterStudent>> build(
    ({String courseId, String classId}) params,
  ) async {
    final teacherId = ref.watch(currentTeacherIdProvider);
    return ref
        .read(teacherClassesRepositoryProvider)
        .fetchRoster(
          courseId: params.courseId,
          classId: params.classId,
          teacherId: teacherId,
        );
  }
}

final teacherRosterControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      TeacherRosterController,
      List<RosterStudent>,
      ({String courseId, String classId})
    >(TeacherRosterController.new);
