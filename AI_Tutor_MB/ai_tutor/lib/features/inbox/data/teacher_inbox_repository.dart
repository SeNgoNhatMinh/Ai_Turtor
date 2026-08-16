import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/n8n_payload.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/teacher_inbox.dart';

class TeacherInboxRepository {
  TeacherInboxRepository(this._spring, this._n8n);

  final Dio _spring;
  final Dio _n8n;

  Future<List<TeacherEscalationItem>> fetchEscalations({
    required String teacherId,
    required String requesterId,
    required String requesterRole,
    String? status,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/escalations/teachers/$teacherId',
      queryParameters: {
        'requesterId': requesterId,
        'requesterRole': requesterRole,
        if (status != null) 'status': status,
      },
    );
    return parseList(
      unwrapList(response.data, ['escalations']),
      TeacherEscalationItem.fromJson,
    );
  }

  Future<List<TeacherEscalationItem>> fetchInbox({
    required String teacherId,
    required String requesterId,
    required String requesterRole,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/mentors/$teacherId/escalations/inbox',
      queryParameters: {
        'requesterId': requesterId,
        'requesterRole': requesterRole,
      },
    );
    return parseList(
      unwrapList(response.data, ['escalations']),
      TeacherEscalationItem.fromJson,
    );
  }

  Future<List<MentorPendingReview>> fetchMentorPendingReviews({
    String? courseId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/answer-reviews/mentor-pending',
      queryParameters: {if (courseId != null) 'courseId': courseId},
    );
    return parseList(
      unwrapAnswerReviewItems(response.data),
      MentorPendingReview.fromJson,
    );
  }

  Future<Map<String, dynamic>> answerEscalation({
    required String questionEscalationId,
    required String teacherId,
    required String teacherName,
    required String answer,
    required String authToken,
    String? conversationId,
    bool createKnowledgeCandidate = false,
    String? candidateType,
    String? sessionId,
  }) async {
    final payload = withN8nContext(
      {
        if (conversationId != null && conversationId.isNotEmpty)
          'conversationId': conversationId,
        'questionEscalationId': questionEscalationId,
        'teacherId': teacherId,
        'teacherName': teacherName,
        'answer': answer,
        'createKnowledgeCandidate': createKnowledgeCandidate,
        if (candidateType != null) 'candidateType': candidateType,
      },
      authToken: authToken,
      sessionId: sessionId ?? newSessionId('teacher'),
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/teacher-answer-escalation',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);
    return data;
  }
}

final teacherInboxRepositoryProvider = Provider<TeacherInboxRepository>((ref) {
  return TeacherInboxRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
