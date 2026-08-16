import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/n8n_payload.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/ai_conversation.dart';

class AiTutorRepository {
  AiTutorRepository(this._spring, this._n8n);

  final Dio _spring;
  final Dio _n8n;

  Future<List<AiConversation>> fetchConversations(
    String userId, {
    String? courseId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/ai/conversations',
      queryParameters: {
        'userId': userId,
        if (courseId != null && courseId.isNotEmpty) 'courseId': courseId,
      },
    );
    return parseList(
      unwrapList(response.data, ['conversations']),
      AiConversation.fromJson,
    );
  }

  Future<AiConversation> createConversation(
    String userId, {
    String? title,
    String? courseId,
    String? classId,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/ai/conversations',
      queryParameters: {
        'userId': userId,
        if (courseId != null && courseId.isNotEmpty) 'courseId': courseId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
      },
      data: title != null ? {'title': title} : null,
    );
    return AiConversation.fromJson(response.data ?? {});
  }

  Future<void> renameConversation(
    String conversationId,
    String title,
    String userId,
  ) async {
    await _spring.patch<Map<String, dynamic>>(
      '/api/ai/conversations/$conversationId',
      data: {'userId': userId, 'title': title},
    );
  }

  Future<List<AiMessage>> searchMessages({
    required String userId,
    required String keyword,
    String? courseId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/ai/conversations/search',
      queryParameters: {
        'userId': userId,
        'keyword': keyword,
        if (courseId != null && courseId.isNotEmpty) 'courseId': courseId,
      },
    );
    return parseList(
      unwrapList(response.data, ['messages']),
      AiMessage.fromJson,
    );
  }

  Future<List<AiMessage>> fetchPinnedMessages({
    required String conversationId,
    required String userId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/ai/conversations/$conversationId/pinned-messages',
      queryParameters: {'userId': userId},
    );
    return parseList(
      unwrapList(response.data, ['messages']),
      AiMessage.fromJson,
    ).map((m) => m.copyWith(conversationId: conversationId)).toList();
  }

  Future<void> pinMessage({
    required String conversationId,
    required String messageId,
    required String userId,
  }) async {
    await _spring.patch<void>(
      '/api/ai/conversations/$conversationId/messages/$messageId/pin',
      queryParameters: {'userId': userId},
    );
  }

  Future<void> unpinMessage({
    required String conversationId,
    required String messageId,
    required String userId,
  }) async {
    await _spring.delete<void>(
      '/api/ai/conversations/$conversationId/messages/$messageId/pin',
      queryParameters: {'userId': userId},
    );
  }

  Future<void> deleteConversation(String conversationId, String userId) async {
    await _spring.delete<void>(
      '/api/ai/conversations/$conversationId',
      queryParameters: {'userId': userId},
    );
  }

  Future<List<AiMessage>> fetchMessages({
    required String conversationId,
    required String userId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/ai/conversations/$conversationId/messages',
      queryParameters: {'userId': userId},
    );
    return parseList(
      unwrapList(response.data, ['messages']),
      AiMessage.fromJson,
    );
  }

  /// Student chat via n8n `student-chat` webhook (RAG / CODE / ESCALATE).
  Future<AiAnswer> ask({
    required String userId,
    required String courseId,
    required String message,
    String? classId,
    String? conversationId,
    String? studentName,
    String? studentEmail,
    String? authToken,
    String? codeSnippet,
    String? sessionId,
    CancelToken? cancelToken,
  }) async {
    final payload = withN8nContext(
      {
        'studentId': userId,
        'studentName': studentName ?? '',
        'studentEmail': studentEmail ?? '',
        'courseId': courseId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (conversationId != null && conversationId.isNotEmpty)
          'conversationId': conversationId,
        'message': message,
        'codeSnippet': codeSnippet ?? '',
      },
      authToken: authToken,
      sessionId: sessionId ?? newSessionId('chat'),
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/student-chat',
      data: payload,
      cancelToken: cancelToken,
      options: Options(receiveTimeout: aiChatReceiveTimeout),
    );
    final data = unwrapMap(response.data);
    ensureN8nSuccess(data);
    return AiAnswer.fromJson(data);
  }

  Future<Map<String, dynamic>> reviewAnswer({
    required String studentId,
    required String courseId,
    required String conversationId,
    required String mode,
    required String reviewType,
    required String question,
    required String answer,
    required int rating,
    required bool accurate,
    required bool helpful,
    String? authToken,
    String? classId,
    double? aiConfidence,
    String? feedback,
    String? suggestedCorrection,
    String? questionEscalationId,
    String? reviewedBy,
    String? reviewerRole,
    String? correctnessLevel,
    String? sessionId,
  }) async {
    final payload = withN8nContext(
      {
        'studentId': studentId,
        'courseId': courseId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        'conversationId': conversationId,
        'mode': mode,
        'reviewType': reviewType,
        'question': question,
        'answer': answer,
        'rating': rating,
        'accurate': accurate,
        'helpful': helpful,
        if (aiConfidence != null) 'aiConfidence': aiConfidence,
        if (feedback != null && feedback.isNotEmpty) 'feedback': feedback,
        if (suggestedCorrection != null && suggestedCorrection.isNotEmpty)
          'suggestedCorrection': suggestedCorrection,
        if (questionEscalationId != null && questionEscalationId.isNotEmpty)
          'questionEscalationId': questionEscalationId,
        'reviewedBy': reviewedBy ?? studentId,
        'reviewerRole': reviewerRole ?? 'STUDENT',
        if (correctnessLevel != null && correctnessLevel.isNotEmpty)
          'correctnessLevel': correctnessLevel,
      },
      authToken: authToken,
      sessionId: sessionId ?? newSessionId('review'),
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/answer-review',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);
    return data;
  }

  Future<AiAnswer> codeMentorQuery({
    required String studentId,
    required String courseId,
    required String question,
    required String code,
    required String language,
    bool assignmentRelated = false,
    String? classId,
    String? conversationId,
    String? authToken,
    String? studentName,
    String? studentEmail,
  }) async {
    final message = assignmentRelated
        ? '$question\n\n(Language: $language, assignment-related)'
        : '$question\n\n(Language: $language)';

    return ask(
      userId: studentId,
      courseId: courseId,
      classId: classId,
      conversationId: conversationId,
      message: message,
      codeSnippet: code,
      authToken: authToken,
      studentName: studentName,
      studentEmail: studentEmail,
    );
  }
}

final aiTutorRepositoryProvider = Provider<AiTutorRepository>((ref) {
  return AiTutorRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
