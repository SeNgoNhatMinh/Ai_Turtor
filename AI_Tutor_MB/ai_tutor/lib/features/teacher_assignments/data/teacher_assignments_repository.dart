import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/teacher_inbox.dart';

class TeacherAssignmentsRepository {
  TeacherAssignmentsRepository(this._dio);

  final Dio _dio;

  Future<List<TeacherAssignmentItem>> fetchClassAssignments({
    required String courseId,
    required String classId,
    required String teacherId,
  }) async {
    final response = await _dio.get<dynamic>(
      '/api/mentor/courses/$courseId/classes/$classId/assignments',
      queryParameters: {'teacherId': teacherId},
    );
    return parseList(
      unwrapList(response.data, ['assignments']),
      TeacherAssignmentItem.fromJson,
    );
  }

  Future<List<SubmissionItem>> fetchSubmissions({
    required String assignmentId,
    required String teacherId,
  }) async {
    final response = await _dio.get<dynamic>(
      '/api/mentor/assignments/$assignmentId/submissions',
      queryParameters: {'teacherId': teacherId},
    );
    return parseList(
      unwrapList(response.data, ['submissions']),
      SubmissionItem.fromJson,
    );
  }

  Future<void> createAssignment({
    required String courseId,
    required String classId,
    required String teacherId,
    required String filePath,
    required String title,
    String? description,
    DateTime? dueAt,
    String targetType = 'ALL_CLASS',
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      'title': title,
      'teacherId': teacherId,
      'targetType': targetType,
      if (description != null) 'description': description,
      if (dueAt != null) 'dueAt': dueAt.toIso8601String(),
    });
    await _dio.post<void>(
      '/api/mentor/courses/$courseId/classes/$classId/assignments/upload',
      data: formData,
    );
  }

  Future<void> updateAssignment({
    required String assignmentId,
    String? title,
    String? description,
    DateTime? dueAt,
  }) async {
    await _dio.put<void>(
      '/api/mentor/assignments/$assignmentId',
      data: {
        if (title != null) 'title': title,
        if (description != null) 'description': description,
        if (dueAt != null) 'dueAt': dueAt.toIso8601String(),
      },
    );
  }

  Future<void> deleteAssignment({
    required String assignmentId,
    required String teacherId,
  }) async {
    await _dio.delete<void>(
      '/api/mentor/assignments/$assignmentId',
      queryParameters: {'teacherId': teacherId},
    );
  }

  Future<List<SubmissionItem>> fetchClassSubmissions({
    required String courseId,
    required String classId,
    required String teacherId,
  }) async {
    final response = await _dio.get<dynamic>(
      '/api/mentor/courses/$courseId/classes/$classId/submissions',
      queryParameters: {'teacherId': teacherId},
    );
    return parseList(
      unwrapList(response.data, ['submissions']),
      SubmissionItem.fromJson,
    );
  }

  Future<void> reviewSubmission({
    required String submissionId,
    required String teacherId,
    required double score,
    String? teacherFeedback,
    List<String>? weakTopics,
  }) async {
    // teacherId nằm trong ReviewAssignmentSubmissionRequest (body), không phải query.
    await _dio.put<void>(
      '/api/mentor/submissions/$submissionId/review',
      data: {
        'teacherId': teacherId,
        'score': score,
        if (teacherFeedback != null) 'teacherFeedback': teacherFeedback,
        if (weakTopics != null && weakTopics.isNotEmpty)
          'weakTopics': weakTopics,
      },
    );
  }

  String submissionFileUrl(String submissionId) {
    final base = _dio.options.baseUrl.replaceAll(RegExp(r'/$'), '');
    return '$base/api/submissions/$submissionId/file';
  }
}

final teacherAssignmentsRepositoryProvider =
    Provider<TeacherAssignmentsRepository>((ref) {
      return TeacherAssignmentsRepository(ref.watch(springDioProvider));
    });
