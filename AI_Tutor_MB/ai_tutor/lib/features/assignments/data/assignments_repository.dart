import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/assignment.dart';

class AssignmentsRepository {
  AssignmentsRepository(this._dio);

  final Dio _dio;

  Future<List<Assignment>> fetchAssignments(String studentId) async {
    final response = await _dio.get<dynamic>(
      '/api/students/$studentId/assignments',
    );
    return parseList(response.data, Assignment.fromJson);
  }

  Future<List<AssignmentSubmission>> fetchSubmissions(String studentId) async {
    final response = await _dio.get<dynamic>(
      '/api/students/$studentId/submissions',
    );
    return parseList(response.data, AssignmentSubmission.fromJson);
  }

  Future<Assignment?> fetchAssignmentById(
    List<Assignment> assignments,
    String id,
  ) async {
    for (final item in assignments) {
      if (item.id == id) return item;
    }
    return null;
  }

  /// Tải file đề bài qua Dio (có auth header) rồi mở bằng app hệ thống.
  Future<OpenResult> downloadAndOpenAssignmentFile({
    required String assignmentId,
    String? suggestedFileName,
  }) async {
    final response = await _dio.get<List<int>>(
      '/api/assignments/$assignmentId/file',
      options: Options(responseType: ResponseType.bytes),
    );

    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw StateError('EMPTY_ASSIGNMENT_FILE');
    }

    final fileName = _fileNameFromHeaders(response.headers) ??
        suggestedFileName ??
        'de-bai-$assignmentId';
    final safeName = fileName.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);

    return OpenFilex.open(file.path);
  }

  String? _fileNameFromHeaders(Headers headers) {
    final disposition = headers.value('content-disposition');
    if (disposition == null) return null;

    final utf8Match = RegExp(
      r"filename\*=UTF-8''([^;]+)",
      caseSensitive: false,
    ).firstMatch(disposition);
    if (utf8Match != null) {
      return Uri.decodeComponent(utf8Match.group(1)!.trim());
    }

    final plainMatch = RegExp(
      r'filename="?([^";]+)"?',
      caseSensitive: false,
    ).firstMatch(disposition);
    return plainMatch?.group(1)?.trim();
  }

  Future<void> submitAssignment({
    required String assignmentId,
    required String studentId,
    required String filePath,
    String? fileName,
    String? studentName,
    String? studentEmail,
    String? note,
  }) async {
    // Backend đọc studentId/studentName/... qua @RequestParam → gửi kèm form field.
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
      'studentId': studentId,
      if (studentName != null) 'studentName': studentName,
      if (studentEmail != null) 'studentEmail': studentEmail,
      if (note != null) 'note': note,
    });
    await _dio.post<void>(
      '/api/students/assignments/$assignmentId/submit',
      queryParameters: {'studentId': studentId},
      data: formData,
    );
  }
}

final assignmentsRepositoryProvider = Provider<AssignmentsRepository>((ref) {
  return AssignmentsRepository(ref.watch(springDioProvider));
});
