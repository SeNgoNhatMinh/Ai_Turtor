import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/n8n_payload.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/quiz.dart';

class QuizRepository {
  QuizRepository(this._spring, this._n8n);

  final Dio _spring;
  final Dio _n8n;

  /// Backend yêu cầu ít nhất một trong hai trường `topic` / `suggestionText`.
  static Map<String, String> quizPromptPayload({
    String? topic,
    String? suggestionText,
    String defaultSuggestion = 'Kiểm tra tổng hợp theo tài liệu môn học',
  }) {
    final trimmedTopic = topic?.trim();
    if (trimmedTopic != null && trimmedTopic.isNotEmpty) {
      return {'topic': trimmedTopic};
    }
    final trimmedSuggestion = suggestionText?.trim();
    if (trimmedSuggestion != null && trimmedSuggestion.isNotEmpty) {
      return {'suggestionText': trimmedSuggestion};
    }
    return {'suggestionText': defaultSuggestion};
  }

  // ── Student: self-practice quiz (n8n quiz-generate / quiz-submit) ──

  Future<QuizSession> generateQuiz({
    required String studentId,
    required String courseId,
    required String authToken,
    String? classId,
    String? topic,
    String? suggestionText,
    int questionCount = 5,
  }) async {
    final payload = withN8nContext({
      'studentId': studentId,
      'courseId': courseId,
      if (classId != null) 'classId': classId,
      ...quizPromptPayload(topic: topic, suggestionText: suggestionText),
      'questionCount': questionCount,
    }, authToken: authToken);

    final response = await _n8n.post<Map<String, dynamic>>(
      '/quiz-generate',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);

    final sessionId =
        data['quizSessionId']?.toString() ?? data['id']?.toString();
    final questions = data['questions'];
    if (sessionId != null &&
        sessionId.isNotEmpty &&
        (questions == null || (questions is List && questions.isEmpty))) {
      return getQuiz(sessionId);
    }
    return QuizSession.fromJson(data);
  }

  Future<QuizSession> getQuiz(String quizSessionId) async {
    final response = await _spring.get<Map<String, dynamic>>(
      '/api/tutor/quizzes/$quizSessionId',
    );
    return QuizSession.fromJson(response.data ?? {});
  }

  Future<QuizSession> submitQuiz({
    required String quizSessionId,
    required String studentId,
    required String courseId,
    required String authToken,
    required List<Map<String, String>> answers,
    String? classId,
  }) async {
    final payload = withN8nContext({
      'quizSessionId': quizSessionId,
      'studentId': studentId,
      'courseId': courseId,
      if (classId != null) 'classId': classId,
      'answers': answers,
    }, authToken: authToken);

    final response = await _n8n.post<Map<String, dynamic>>(
      '/quiz-submit',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);

    if (data['questions'] == null ||
        (data['questions'] as List?)?.isEmpty == true) {
      try {
        return getQuiz(quizSessionId);
      } catch (_) {
        return QuizSession.fromJson({
          ...data,
          'quizSessionId': quizSessionId,
          'id': quizSessionId,
        });
      }
    }
    return QuizSession.fromJson({
      ...data,
      'quizSessionId': quizSessionId,
      'id': quizSessionId,
    });
  }

  Future<List<QuizSession>> listStudentQuizzes({
    required String studentId,
    required String courseId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/students/$studentId/courses/$courseId/quizzes',
    );
    return parseList(
      unwrapList(response.data, ['quizzes']),
      QuizSession.fromJson,
    );
  }
}

final quizRepositoryProvider = Provider<QuizRepository>((ref) {
  return QuizRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
