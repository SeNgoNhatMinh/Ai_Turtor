import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/exceptions.dart';
import '../../../core/network/n8n_payload.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/ai_conversation.dart';
import 'chat_answer_recovery.dart';
import 'daily_question_quota.dart';
import 'tutor_session.dart';

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
  /// Timeout → poll history; n8n fail khác quota → fallback Spring `/api/ai/query`.
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
    String? interactionType,
    String? tutorSessionId,
    String? sessionPhase,
    String? improvePlanId,
    String? planItemId,
    String? clickedSuggestion,
    String? requestedMode,
    List<String> sourceMaterialIds = const [],
    List<String> sourceChunkIds = const [],
    CancelToken? cancelToken,
  }) async {
    final normalizedRequestedMode = requestedMode == 'CODE' ? 'CODE' : 'RAG';
    final requiresDirectBackendRoute =
        requestedMode != null ||
        sourceMaterialIds.isNotEmpty ||
        sourceChunkIds.isNotEmpty ||
        (improvePlanId ?? '').trim().isNotEmpty ||
        (planItemId ?? '').trim().isNotEmpty;
    if (requiresDirectBackendRoute) {
      return _askSpring(
        userId: userId,
        courseId: courseId,
        message: message,
        classId: classId,
        conversationId: conversationId,
        studentName: studentName,
        studentEmail: studentEmail,
        codeSnippet: codeSnippet,
        tutorSessionId: tutorSessionId,
        sessionPhase: sessionPhase,
        interactionType: interactionType,
        improvePlanId: improvePlanId,
        planItemId: planItemId,
        clickedSuggestion: clickedSuggestion,
        requestedMode: normalizedRequestedMode,
        sourceMaterialIds: sourceMaterialIds,
        sourceChunkIds: sourceChunkIds,
        cancelToken: cancelToken,
      );
    }
    try {
      final answer = await _askN8n(
        userId: userId,
        courseId: courseId,
        message: message,
        classId: classId,
        conversationId: conversationId,
        studentName: studentName,
        studentEmail: studentEmail,
        authToken: authToken,
        codeSnippet: codeSnippet,
        sessionId: sessionId,
        interactionType: interactionType,
        tutorSessionId: tutorSessionId,
        sessionPhase: sessionPhase,
        improvePlanId: improvePlanId,
        planItemId: planItemId,
        clickedSuggestion: clickedSuggestion,
        cancelToken: cancelToken,
      );
      if (answer.answer.trim().isNotEmpty) return answer;
      final recovered = await recoverCanonicalAnswer(
        userId: userId,
        conversationId: conversationId,
        question: message,
        cancelToken: cancelToken,
      );
      if (recovered != null) return recovered;
      return answer;
    } on ApiBusinessException {
      rethrow;
    } catch (error) {
      if (isCanceledChatError(error)) rethrow;
      if (error is ApiBusinessException) rethrow;

      if (isN8nTimeoutError(error)) {
        final recovered = await recoverInFlightAnswer(
          userId: userId,
          conversationId: conversationId,
          question: message,
          cancelToken: cancelToken,
        );
        if (recovered != null) return recovered;
      }

      try {
        return await _askSpring(
          userId: userId,
          courseId: courseId,
          message: message,
          classId: classId,
          conversationId: conversationId,
          studentName: studentName,
          studentEmail: studentEmail,
          codeSnippet: codeSnippet,
          tutorSessionId: tutorSessionId,
          sessionPhase: sessionPhase,
          interactionType: interactionType,
          improvePlanId: improvePlanId,
          planItemId: planItemId,
          clickedSuggestion: clickedSuggestion,
          requestedMode: normalizedRequestedMode,
          sourceMaterialIds: sourceMaterialIds,
          sourceChunkIds: sourceChunkIds,
          cancelToken: cancelToken,
        );
      } catch (fallbackError) {
        if (isCanceledChatError(fallbackError)) rethrow;
        final recovered = await recoverCanonicalAnswer(
          userId: userId,
          conversationId: conversationId,
          question: message,
          cancelToken: cancelToken,
        );
        if (recovered != null) return recovered;
        throw error;
      }
    }
  }

  Future<AiAnswer> _askN8n({
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
    String? interactionType,
    String? tutorSessionId,
    String? sessionPhase,
    String? improvePlanId,
    String? planItemId,
    String? clickedSuggestion,
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
        'question': message,
        'codeSnippet': codeSnippet ?? '',
        if (interactionType != null && interactionType.isNotEmpty)
          'interactionType': interactionType,
        if (tutorSessionId != null && tutorSessionId.isNotEmpty)
          'tutorSessionId': tutorSessionId,
        'sessionPhase': (sessionPhase == null || sessionPhase.isEmpty)
            ? 'TEACH'
            : sessionPhase,
        if (improvePlanId != null && improvePlanId.isNotEmpty)
          'improvePlanId': improvePlanId,
        if (planItemId != null && planItemId.isNotEmpty)
          'planItemId': planItemId,
        if (clickedSuggestion != null && clickedSuggestion.isNotEmpty)
          'clickedSuggestion': clickedSuggestion,
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

  Future<AiAnswer> _askSpring({
    required String userId,
    required String courseId,
    required String message,
    String? classId,
    String? conversationId,
    String? studentName,
    String? studentEmail,
    String? codeSnippet,
    String? tutorSessionId,
    String? sessionPhase,
    String? interactionType,
    String? improvePlanId,
    String? planItemId,
    String? clickedSuggestion,
    String? requestedMode,
    List<String> sourceMaterialIds = const [],
    List<String> sourceChunkIds = const [],
    CancelToken? cancelToken,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/ai/query',
      queryParameters: {
        'userId': userId,
        if (studentName != null && studentName.isNotEmpty)
          'userName': studentName,
        if (studentEmail != null && studentEmail.isNotEmpty)
          'userEmail': studentEmail,
      },
      data: {
        'question': message,
        'message': message,
        'codeSnippet': codeSnippet,
        'courseId': courseId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        if (conversationId != null && conversationId.isNotEmpty)
          'conversationId': conversationId,
        if (tutorSessionId != null && tutorSessionId.isNotEmpty)
          'tutorSessionId': tutorSessionId,
        'sessionPhase': (sessionPhase == null || sessionPhase.isEmpty)
            ? 'TEACH'
            : sessionPhase,
        if (interactionType != null && interactionType.isNotEmpty)
          'interactionType': interactionType,
        if (improvePlanId != null && improvePlanId.isNotEmpty)
          'improvePlanId': improvePlanId,
        if (planItemId != null && planItemId.isNotEmpty)
          'planItemId': planItemId,
        if (clickedSuggestion != null && clickedSuggestion.isNotEmpty)
          'clickedSuggestion': clickedSuggestion,
        if (requestedMode != null && requestedMode.isNotEmpty)
          'requestedMode': requestedMode,
        if (sourceMaterialIds.isNotEmpty)
          'sourceMaterialIds': sourceMaterialIds,
        if (sourceChunkIds.isNotEmpty) 'sourceChunkIds': sourceChunkIds,
      },
      cancelToken: cancelToken,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    return AiAnswer.fromJson(unwrapMap(response.data));
  }

  Future<AiAnswer?> recoverCanonicalAnswer({
    required String userId,
    String? conversationId,
    required String question,
    CancelToken? cancelToken,
  }) {
    return _pollRecoveredAnswer(
      userId: userId,
      conversationId: conversationId,
      question: question,
      delays: canonicalAnswerRetryDelays,
      cancelToken: cancelToken,
    );
  }

  Future<AiAnswer?> recoverInFlightAnswer({
    required String userId,
    String? conversationId,
    required String question,
    CancelToken? cancelToken,
  }) {
    return _pollRecoveredAnswer(
      userId: userId,
      conversationId: conversationId,
      question: question,
      delays: inFlightAnswerRetryDelays,
      cancelToken: cancelToken,
    );
  }

  Future<AiAnswer?> _pollRecoveredAnswer({
    required String userId,
    String? conversationId,
    required String question,
    required List<int> delays,
    CancelToken? cancelToken,
  }) async {
    var resolvedId = (conversationId ?? '').trim();
    for (final delayMs in delays) {
      if (cancelToken?.isCancelled == true) return null;
      if (delayMs > 0) {
        await Future<void>.delayed(Duration(milliseconds: delayMs));
      }
      if (cancelToken?.isCancelled == true) return null;
      if (resolvedId.isEmpty) continue;
      try {
        final messages = await fetchMessages(
          conversationId: resolvedId,
          userId: userId,
        );
        final reply = findCanonicalAssistantReply(
          messages: messages,
          question: question,
        );
        if (reply != null) {
          return answerFromRecoveredMessage(reply, conversationId: resolvedId);
        }
      } catch (error) {
        if (isCanceledChatError(error)) return null;
      }
    }
    return null;
  }

  Future<void> recordUnderstandingCheck({
    required String conversationId,
    required String messageId,
    required String userId,
    required String selectedKey,
  }) async {
    await _spring.post<void>(
      '/api/ai/conversations/$conversationId/messages/$messageId/understanding-check',
      data: {'userId': userId, 'selectedKey': selectedKey},
    );
  }

  Future<DailyQuestionQuota> fetchQuestionQuota({
    required String studentId,
    required String courseId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/students/$studentId/courses/$courseId/question-quota',
      options: Options(extra: const {skipUnauthorizedRedirectExtra: true}),
    );
    return normalizeDailyQuota(response.data, courseId: courseId);
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
    String? tutorSessionId,
    String? sessionPhase,
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
      tutorSessionId: tutorSessionId,
      sessionPhase: sessionPhase,
      requestedMode: 'CODE',
    );
  }

  Future<List<String>> fetchSuggestedChapterTitles(String courseId) async {
    final trimmed = courseId.trim();
    if (trimmed.isEmpty) return const [];
    try {
      final response = await _spring.get<dynamic>(
        '/api/v2/expert-training/chapters/suggested',
        queryParameters: {'courseId': trimmed},
        options: Options(extra: const {skipUnauthorizedRedirectExtra: true}),
      );
      final chapters = unwrapList(response.data, ['chapters']);
      return chapters
          .whereType<Map>()
          .map((item) => (item['title'] ?? '').toString().trim())
          .where((title) => title.isNotEmpty)
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<TutorSessionOpenResult> openTutorSession({
    required String studentId,
    required String courseId,
    String? classId,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/tutor/sessions/open',
      data: {
        'studentId': studentId,
        'courseId': courseId,
        if (classId != null && classId.isNotEmpty) 'classId': classId,
      },
      options: Options(extra: const {skipUnauthorizedRedirectExtra: true}),
    );
    final raw = response.data is Map
        ? Map<String, dynamic>.from(response.data as Map)
        : <String, dynamic>{};
    final parsed = TutorSessionOpenResult.fromJson(unwrapMap(raw));
    if (parsed.conversationId.isNotEmpty ||
        parsed.openingMessage != null ||
        parsed.session != null) {
      return parsed;
    }
    return TutorSessionOpenResult.fromJson(raw);
  }

  Future<TutorSessionSummaryInfo> closeTutorSession(String sessionId) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/tutor/sessions/${Uri.encodeComponent(sessionId)}/close',
      data: const {},
      options: Options(extra: const {skipUnauthorizedRedirectExtra: true}),
    );
    return TutorSessionSummaryInfo.fromJson(unwrapMap(response.data));
  }
}

final aiTutorRepositoryProvider = Provider<AiTutorRepository>((ref) {
  return AiTutorRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
