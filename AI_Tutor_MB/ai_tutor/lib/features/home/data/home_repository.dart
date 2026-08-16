import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/assignment.dart';
import '../../../shared/models/student_dashboard.dart';

class HomeRepository {
  HomeRepository(this._dio);

  final Dio _dio;

  Future<StudentDashboard> fetchDashboard({
    required String studentId,
    required String requesterId,
    required String requesterRole,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/students/$studentId/dashboard',
      queryParameters: {
        'requesterId': requesterId,
        'requesterRole': requesterRole,
      },
    );
    return StudentDashboard.fromJson(response.data ?? {});
  }

  Future<List<Assignment>> fetchAssignments(String studentId) async {
    final response = await _dio.get<dynamic>(
      '/api/students/$studentId/assignments',
    );
    return parseList(response.data, Assignment.fromJson);
  }
}

final homeRepositoryProvider = Provider<HomeRepository>((ref) {
  return HomeRepository(ref.watch(springDioProvider));
});
