import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../shared/models/improve_plan.dart';
import '../../../shared/models/improve_suggestion.dart';

class ImprovePlanRepository {
  ImprovePlanRepository(this._dio);

  final Dio _dio;

  Future<ImprovePlan?> fetchPlan({
    required String studentId,
    required String courseId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/students/$studentId/courses/$courseId/improve-plan',
    );
    return _parseImprovePlanResponse(response.data);
  }

  /// Backend trả plan object trực tiếp khi có; envelope `{ plan: "" }` khi chưa có.
  ImprovePlan? _parseImprovePlanResponse(Map<String, dynamic>? data) {
    if (data == null || data.isEmpty) return null;

    final nested = data['plan'];
    if (nested is Map) {
      return ImprovePlan.fromJson(Map<String, dynamic>.from(nested));
    }
    if (nested == null || nested == '' || (nested is List && nested.isEmpty)) {
      return null;
    }

    if (data.containsKey('planItems') ||
        data.containsKey('id') ||
        data.containsKey('planId')) {
      return ImprovePlan.fromJson(data);
    }

    return null;
  }

  Future<StudentMemory> fetchMemory({
    required String studentId,
    required String courseId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/tutor/students/$studentId/courses/$courseId/memory',
    );
    return StudentMemory.fromJson(response.data ?? {});
  }

  Future<void> createSuggestions({
    required String studentId,
    required String courseId,
  }) async {
    await _dio.post<void>(
      '/api/tutor/improve-suggestions',
      data: {'studentId': studentId, 'courseId': courseId},
    );
  }

  /// Gợi ý sau câu trả lời AI — parse `ruleSuggestions` thành chip hành động.
  Future<List<ImproveSuggestionItem>> fetchActionableSuggestions({
    required String studentId,
    required String courseId,
    String? classId,
    String? question,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/tutor/improve-suggestions',
      data: {
        'studentId': studentId,
        'courseId': courseId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (question != null && question.isNotEmpty) 'question': question,
        'includeAiSuggestion': false,
      },
    );
    final raw = response.data?['ruleSuggestions'];
    if (raw is! List) return const [];
    final items = raw
        .whereType<Map>()
        .map((e) => ImproveSuggestionItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return ImproveSuggestionItem.actionableChips(items);
  }

  Future<void> completePlan(String planId) async {
    await _dio.put<void>('/api/improve-plans/$planId/complete');
  }

  Future<StudentMemory> pinSuggestion({
    required String studentId,
    required String courseId,
    required String suggestion,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/tutor/students/$studentId/courses/$courseId/memory/pinned-suggestions',
      data: {'suggestion': suggestion},
    );
    return StudentMemory.fromJson(response.data ?? {});
  }

  Future<StudentMemory> unpinSuggestion({
    required String studentId,
    required String courseId,
    required String suggestion,
  }) async {
    final response = await _dio.delete<Map<String, dynamic>>(
      '/api/tutor/students/$studentId/courses/$courseId/memory/pinned-suggestions',
      queryParameters: {'suggestion': suggestion},
    );
    return StudentMemory.fromJson(response.data ?? {});
  }

  Future<LearnSuggestionResult> learnFromSuggestion({
    required String studentId,
    required String courseId,
    String? classId,
    String? conversationId,
    required String topic,
    String? suggestionText,
    String? suggestionKey,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/tutor/students/$studentId/courses/$courseId/suggestions/learn',
      data: {
        'topic': topic,
        'suggestionText': suggestionText ?? topic,
        if (suggestionKey != null && suggestionKey.isNotEmpty)
          'suggestionKey': suggestionKey,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (conversationId != null && conversationId.isNotEmpty)
          'conversationId': conversationId,
      },
    );
    return LearnSuggestionResult.fromJson(response.data ?? {});
  }
}

final improvePlanRepositoryProvider = Provider<ImprovePlanRepository>((ref) {
  return ImprovePlanRepository(ref.watch(springDioProvider));
});
