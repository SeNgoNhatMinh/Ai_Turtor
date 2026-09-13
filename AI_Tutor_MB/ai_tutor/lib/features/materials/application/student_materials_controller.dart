import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/course_material.dart';
import '../../memory/application/course_memory_provider.dart';
import '../../courses/data/courses_repository.dart';

typedef StudentMaterialsScope = ({String courseRouteId, String? classId});

final studentMaterialsProvider = FutureProvider.autoDispose
    .family<List<CourseMaterial>, StudentMaterialsScope>((ref, scope) async {
      final apiCourseId = resolveCourseApiId(ref, scope.courseRouteId);
      return ref.read(coursesRepositoryProvider).fetchMaterials(
        apiCourseId,
        classId: scope.classId,
      );
    });
