import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/course_material.dart';
import '../../auth/application/auth_controller.dart';
import '../data/courses_repository.dart';

typedef MaterialScope = ({String courseId, String classId});

class TeacherMaterialsController
    extends AutoDisposeFamilyAsyncNotifier<List<CourseMaterial>, MaterialScope> {
  @override
  Future<List<CourseMaterial>> build(MaterialScope scope) async {
    ref.watch(realtimeRefreshTickProvider);
    return ref.read(coursesRepositoryProvider).fetchMaterials(
      scope.courseId,
      classId: scope.classId,
    );
  }

  Future<CourseMaterial> upload({required String title, required String filePath}) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    final material = await ref
        .read(coursesRepositoryProvider)
        .uploadMaterial(
          courseId: arg.courseId,
          classId: arg.classId,
          teacherId: teacherId,
          title: title,
          filePath: filePath,
        );
    ref.invalidateSelf();
    return material;
  }

  Future<void> delete(String materialId) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    await ref
        .read(coursesRepositoryProvider)
        .deleteMaterial(
          courseId: arg.courseId,
          materialId: materialId,
          teacherId: teacherId,
        );
    ref.invalidateSelf();
  }

  Future<void> reindex(String materialId) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    await ref
        .read(coursesRepositoryProvider)
        .reindexMaterial(
          courseId: arg.courseId,
          materialId: materialId,
          teacherId: teacherId,
        );
  }

  Future<void> updateMetadata(
    String materialId, {
    String? title,
    String? category,
  }) async {
    await ref
        .read(coursesRepositoryProvider)
        .updateMaterial(
          courseId: arg.courseId,
          materialId: materialId,
          title: title,
          category: category,
        );
    ref.invalidateSelf();
  }

  Future<void> importFromUrl({
    required String url,
    String? title,
    List<String>? selectedUrls,
    bool followNext = false,
    int? maxPages,
  }) async {
    final teacherId = ref.read(currentTeacherIdProvider);
    await ref
        .read(coursesRepositoryProvider)
        .importHtmlUrl(
          courseId: arg.courseId,
          url: url,
          teacherId: teacherId,
          classId: arg.classId,
          title: title,
          selectedUrls: selectedUrls,
          followNext: followNext,
          maxPages: maxPages,
        );
    ref.invalidateSelf();
  }
}

final teacherMaterialsControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      TeacherMaterialsController,
      List<CourseMaterial>,
      MaterialScope
    >(TeacherMaterialsController.new);
