import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/escalation.dart';

class EscalationRepository {
  EscalationRepository(this._dio);

  final Dio _dio;

  Future<EscalationOffer> fetchOffer(String questionEscalationId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/tutor/escalations/offer',
      queryParameters: {'questionEscalationId': questionEscalationId},
    );
    return EscalationOffer.fromJson(
      unwrapMap(response.data, keys: ['offer']),
    );
  }

  Future<EscalationSelectResult> selectMentor({
    required String userId,
    required String questionEscalationId,
    required String selectedMentorId,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/tutor/escalations/select',
      data: {
        'userId': userId,
        'questionEscalationId': questionEscalationId,
        'selectedMentorId': selectedMentorId,
      },
    );
    return EscalationSelectResult.fromJson(
      unwrapMap(response.data, keys: ['selection', 'result']),
    );
  }

  Future<void> cancel({
    required String userId,
    required String questionEscalationId,
  }) async {
    await _dio.post<void>(
      '/api/tutor/escalations/cancel',
      data: {'userId': userId, 'questionEscalationId': questionEscalationId},
    );
  }

  Future<Map<String, dynamic>> fetchDetail(String questionEscalationId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/tutor/escalations/$questionEscalationId',
    );
    return Map<String, dynamic>.from(response.data ?? {});
  }

  Future<List<EscalationHistoryItem>> fetchHistory(String userId) async {
    final response = await _dio.get<dynamic>(
      '/api/tutor/escalations/history',
      queryParameters: {'userId': userId},
    );
    // Backend trả { userId, escalations: [...], count }.
    return parseList(
      unwrapList(response.data, ['escalations']),
      EscalationHistoryItem.fromJson,
    );
  }
}

final escalationRepositoryProvider = Provider<EscalationRepository>((ref) {
  return EscalationRepository(ref.watch(springDioProvider));
});
