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
    final payload = withN8nContext(
      {
        'studentId': studentId,
        'courseId': courseId,
        if (classId != null) 'classId': classId,
        ...quizPromptPayload(topic: topic, suggestionText: suggestionText),
        'questionCount': questionCount,
      },
      authToken: authToken,
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/quiz-generate',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);

    final sessionId = data['quizSessionId']?.toString() ?? data['id']?.toString();
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
    final payload = withN8nContext(
      {
        'quizSessionId': quizSessionId,
        'studentId': studentId,
        'courseId': courseId,
        if (classId != null) 'classId': classId,
        'answers': answers,
      },
      authToken: authToken,
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/quiz-submit',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);

    if (data['questions'] == null || (data['questions'] as List?)?.isEmpty == true) {
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

  // ── Student: assigned quizzes ────────────────────────────────

  Future<List<QuizAssignment>> listStudentQuizAssignments({
    required String studentId,
    required String courseId,
    String? classId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/students/$studentId/courses/$courseId/quiz-assignments',
      queryParameters: {
        if (classId != null) 'classId': classId,
      },
    );
    return parseList(
      unwrapList(response.data, ['assignments']),
      QuizAssignment.fromJson,
    );
  }

  Future<QuizSession> startAssignedQuiz({
    required String assignmentId,
    required String studentId,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/tutor/quiz-assignments/$assignmentId/attempts',
      queryParameters: {'studentId': studentId},
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    return QuizSession.fromJson(response.data ?? {});
  }

  // ── Teacher: manage quiz assignments ────────────────────────

  Future<QuizAssignment> generateQuizAssignment({
    required String teacherId,
    required String courseId,
    required String title,
    required String authToken,
    String? classId,
    String? topic,
    String? suggestionText,
    int questionCount = 5,
  }) async {
    final payload = withN8nContext(
      {
        'teacherId': teacherId,
        'courseId': courseId,
        if (classId != null) 'classId': classId,
        'title': title,
        ...quizPromptPayload(topic: topic, suggestionText: suggestionText),
        'questionCount': questionCount,
      },
      authToken: authToken,
    );

    final response = await _n8n.post<Map<String, dynamic>>(
      '/quiz-generate',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    ensureN8nSuccess(data);

    if (data['assignment'] is Map) {
      return QuizAssignment.fromJson(
        Map<String, dynamic>.from(data['assignment'] as Map),
      );
    }
    return QuizAssignment.fromJson(data);
  }

  Future<QuizAssignment> updateQuizAssignment({
    required String assignmentId,
    String? title,
    String? topic,
    List<Map<String, dynamic>>? questions,
  }) async {
    final response = await _spring.put<Map<String, dynamic>>(
      '/api/tutor/quiz-assignments/$assignmentId',
      data: {
        if (title != null) 'title': title,
        if (topic != null) 'topic': topic,
        if (questions != null) 'questions': questions,
      },
    );
    return QuizAssignment.fromJson(response.data ?? {});
  }

  Future<void> deleteQuizAssignment(String assignmentId) async {
    await _spring.delete<void>('/api/tutor/quiz-assignments/$assignmentId');
  }

  Future<QuizAssignment> publishQuizAssignment({
    required String assignmentId,
    String targetType = 'CLASS',
    List<String>? targetStudentIds,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/tutor/quiz-assignments/$assignmentId/publish',
      data: {
        'targetType': targetType,
        if (targetStudentIds != null) 'targetStudentIds': targetStudentIds,
      },
    );
    return QuizAssignment.fromJson(response.data ?? {});
  }

  Future<QuizSession> teacherReviewQuiz({
    required String quizSessionId,
    int? reviewedScore,
    String? feedback,
  }) async {
    final response = await _spring.put<Map<String, dynamic>>(
      '/api/tutor/quizzes/$quizSessionId/teacher-review',
      data: {
        if (reviewedScore != null) 'reviewedScore': reviewedScore,
        if (feedback != null) 'feedback': feedback,
      },
    );
    return QuizSession.fromJson(response.data ?? {});
  }

  Future<List<QuizAssignment>> listTeacherQuizAssignments(
    String teacherId,
  ) async {
    final response = await _spring.get<dynamic>(
      '/api/tutor/teachers/$teacherId/quiz-assignments',
    );
    return parseList(
      unwrapList(response.data, ['assignments']),
      QuizAssignment.fromJson,
    );
  }
}

final quizRepositoryProvider = Provider<QuizRepository>((ref) {
  return QuizRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
