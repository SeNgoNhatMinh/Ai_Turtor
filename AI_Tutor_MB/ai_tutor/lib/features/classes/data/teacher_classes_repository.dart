import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/class_section.dart';

class TeacherClassesRepository {
  TeacherClassesRepository(this._dio);

  final Dio _dio;

  Future<List<ClassSection>> fetchClassSections(String teacherId) async {
    final response = await _dio.get<dynamic>(
      '/api/mentors/$teacherId/class-sections',
    );
    return parseList(response.data, ClassSection.fromJson);
  }

  Future<List<RosterStudent>> fetchRoster({
    required String courseId,
    required String classId,
    required String teacherId,
  }) async {
    final response = await _dio.get<dynamic>(
      '/api/courses/$courseId/class-sections/$classId/students',
      queryParameters: {'teacherId': teacherId},
    );
    // Backend trả { courseId, classId, count, students: [...] }.
    return parseList(
      unwrapList(response.data, ['students']),
      RosterStudent.fromJson,
    );
  }
}

final teacherClassesRepositoryProvider = Provider<TeacherClassesRepository>((
  ref,
) {
  return TeacherClassesRepository(ref.watch(springDioProvider));
});
