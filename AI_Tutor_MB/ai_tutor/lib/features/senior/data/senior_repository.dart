import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/n8n_payload.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/senior_queue.dart';

class SeniorRepository {
  SeniorRepository(this._spring, this._n8n);

  final Dio _spring;
  final Dio _n8n;

  Future<List<SeniorPendingReview>> fetchSeniorPendingReviews({
    String? courseId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/answer-reviews/senior-pending',
      queryParameters: {if (courseId != null) 'courseId': courseId},
    );
    return parseList(
      unwrapAnswerReviewItems(response.data),
      SeniorPendingReview.fromJson,
    );
  }

  Future<List<KnowledgeCandidateItem>> fetchSeniorPendingCandidates({
    String? courseId,
    String? teacherId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/knowledge-candidates/senior-pending',
      queryParameters: {
        if (courseId != null) 'courseId': courseId,
        if (teacherId != null) 'teacherId': teacherId,
      },
    );
    return parseList(
      unwrapList(response.data, ['candidates']),
      KnowledgeCandidateItem.fromJson,
    );
  }

  Future<KnowledgeCandidateItem> fetchCandidateById(String candidateId) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/knowledge-candidates',
    );
    final items = parseList(
      unwrapList(response.data, ['candidates']),
      KnowledgeCandidateItem.fromJson,
    );
    return items.firstWhere(
      (c) => c.id == candidateId,
      orElse: () => throw StateError('Không tìm thấy candidate'),
    );
  }

  Future<Map<String, dynamic>> resolveReview({
    required String reviewId,
    required String seniorReviewerId,
    required String seniorReviewerName,
    required String reviewerRole,
    required String decision,
    required String authToken,
    String? notes,
    bool createKnowledgeCandidate = false,
    String? candidateType,
    String? correctedAnswer,
    String? sessionId,
  }) async {
    final payload = withN8nContext(
      {
        'reviewId': reviewId,
        'seniorReviewerId': seniorReviewerId,
        'seniorReviewerName': seniorReviewerName,
        'reviewerRole': reviewerRole,
        'decision': decision,
        if (notes != null) 'notes': notes,
        'createKnowledgeCandidate': createKnowledgeCandidate,
        if (candidateType != null) 'candidateType': candidateType,
        if (correctedAnswer != null) 'correctedAnswer': correctedAnswer,
      },
      authToken: authToken,
      sessionId: sessionId ?? newSessionId('senior-review'),
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/senior-resolve-answer-review',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);
    return data;
  }

  Future<Map<String, dynamic>> approveCandidate({
    required String candidateId,
    required String reviewerId,
    required String reviewerRole,
    required String reviewerName,
    required String authToken,
    String? reviewNote,
    String? contentOverride,
    String? sessionId,
  }) async {
    final payload = withN8nContext(
      {
        'candidateId': candidateId,
        'decision': 'APPROVE',
        'reviewerId': reviewerId,
        'reviewerRole': reviewerRole,
        'reviewerName': reviewerName,
        if (reviewNote != null) 'reviewNote': reviewNote,
        if (contentOverride != null) 'contentOverride': contentOverride,
      },
      authToken: authToken,
      sessionId: sessionId ?? newSessionId('senior-approve'),
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/senior-knowledge-approval',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);
    return data;
  }

  Future<Map<String, dynamic>> rejectCandidate({
    required String candidateId,
    required String reviewerId,
    required String reviewerRole,
    required String reviewerName,
    required String rejectionReason,
    required String authToken,
    String? sessionId,
  }) async {
    final payload = withN8nContext(
      {
        'candidateId': candidateId,
        'decision': 'REJECT',
        'reviewerId': reviewerId,
        'reviewerRole': reviewerRole,
        'reviewerName': reviewerName,
        'rejectionReason': rejectionReason,
      },
      authToken: authToken,
      sessionId: sessionId ?? newSessionId('senior-reject'),
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/senior-knowledge-approval',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);
    return data;
  }
}

final seniorRepositoryProvider = Provider<SeniorRepository>((ref) {
  return SeniorRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
