import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/course_material.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/data/courses_repository.dart';

/// Quản lý tài liệu chung theo course — dành cho Admin.
class AdminMaterialsController
    extends AutoDisposeFamilyAsyncNotifier<List<CourseMaterial>, String> {
  @override
  Future<List<CourseMaterial>> build(String courseId) async {
    ref.watch(realtimeRefreshTickProvider);
    return ref.read(coursesRepositoryProvider).fetchMaterials(courseId);
  }

  Future<CourseMaterial> upload({required String title, required String filePath}) async {
    final adminId = ref.read(currentUserIdProvider);
    final material = await ref.read(coursesRepositoryProvider).uploadAdminMaterial(
          courseId: arg,
          adminId: adminId,
          title: title,
          filePath: filePath,
        );
    ref.invalidateSelf();
    return material;
  }

  Future<void> delete(String materialId) async {
    final adminId = ref.read(currentUserIdProvider);
    await ref.read(coursesRepositoryProvider).deleteMaterial(
          courseId: arg,
          materialId: materialId,
          teacherId: adminId,
        );
    ref.invalidateSelf();
  }

  Future<void> reindex(String materialId) async {
    final adminId = ref.read(currentUserIdProvider);
    await ref.read(coursesRepositoryProvider).reindexMaterial(
          courseId: arg,
          materialId: materialId,
          teacherId: adminId,
        );
    ref.invalidateSelf();
  }
}

final adminMaterialsControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      AdminMaterialsController,
      List<CourseMaterial>,
      String
    >(AdminMaterialsController.new);
