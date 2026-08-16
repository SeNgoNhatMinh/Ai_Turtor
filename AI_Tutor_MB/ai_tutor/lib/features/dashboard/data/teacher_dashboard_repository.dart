import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../shared/models/teacher_dashboard.dart';

class TeacherDashboardRepository {
  TeacherDashboardRepository(this._dio);

  final Dio _dio;

  Future<TeacherDashboard> fetchDashboard({
    required String teacherId,
    required String requesterId,
    required String requesterRole,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/mentors/$teacherId/dashboard',
      queryParameters: {
        'requesterId': requesterId,
        'requesterRole': requesterRole,
      },
    );
    return TeacherDashboard.fromJson(response.data ?? {});
  }
}

final teacherDashboardRepositoryProvider = Provider<TeacherDashboardRepository>(
  (ref) {
    return TeacherDashboardRepository(ref.watch(springDioProvider));
  },
);
