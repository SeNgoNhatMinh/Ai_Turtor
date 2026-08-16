import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/course_material.dart';

class CoursesRepository {
  CoursesRepository(this._dio);

  final Dio _dio;

  Future<List<Course>> fetchStudentCourses(String studentId) async {
    final response = await _dio.get<dynamic>(
      '/api/students/$studentId/courses',
    );
    return parseList(response.data, Course.fromJson);
  }

  Future<List<CourseMaterial>> fetchMaterials(
    String courseId, {
    String? classId,
  }) async {
    final response = await _dio.get<dynamic>(
      '/api/courses/$courseId/materials',
      queryParameters: {
        if (classId != null && classId.isNotEmpty) 'classId': classId,
      },
    );
    final data = response.data;
    final list = data is Map ? data['materials'] : data;
    return parseList(list, CourseMaterial.fromJson);
  }

  Future<void> downloadMaterialPdf({
    required String courseId,
    required String materialId,
    required String savePath,
  }) async {
    await _dio.download(
      '/api/courses/$courseId/materials/$materialId/pdf',
      savePath,
      options: Options(receiveTimeout: const Duration(minutes: 5)),
    );
  }

  String materialPdfApiPath(String courseId, String materialId) =>
      '/api/courses/$courseId/materials/$materialId/pdf';

  String materialPdfUrl(String courseId, String materialId) {
    final base = _dio.options.baseUrl.replaceAll(RegExp(r'/$'), '');
    return '$base/api/courses/$courseId/materials/$materialId/pdf';
  }

  String materialPageImageUrl(
    String courseId,
    String materialId,
    int pageNumber,
  ) {
    final base = _dio.options.baseUrl.replaceAll(RegExp(r'/$'), '');
    return '$base/api/courses/$courseId/materials/$materialId/pages/$pageNumber/image';
  }

  Future<CourseMaterial> uploadMaterial({
    required String courseId,
    required String teacherId,
    required String title,
    required String filePath,
    String? classId,
    String? uploaderRole,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
      'title': title,
      'teacherId': teacherId,
      if (classId != null) 'classId': classId,
      if (uploaderRole != null && uploaderRole.isNotEmpty)
        'uploaderRole': uploaderRole,
    });
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/courses/$courseId/materials/upload',
      data: formData,
      options: Options(
        receiveTimeout: const Duration(minutes: 5),
        sendTimeout: const Duration(minutes: 5),
        validateStatus: (status) => status != null && status >= 200 && status < 300,
      ),
    );
    final body = response.data ?? {};
    return CourseMaterial.fromJson({
      ...body,
      'id': body['materialId'] ?? body['documentId'] ?? body['id'],
      'title': body['title'] ?? title,
    });
  }

  /// Admin upload tài liệu chung cho cả course (không gắn classId).
  Future<CourseMaterial> uploadAdminMaterial({
    required String courseId,
    required String adminId,
    required String title,
    required String filePath,
  }) async {
    return uploadMaterial(
      courseId: courseId,
      teacherId: adminId,
      title: title,
      filePath: filePath,
      uploaderRole: 'ADMIN',
    );
  }

  Future<void> deleteMaterial({
    required String courseId,
    required String materialId,
    required String teacherId,
  }) async {
    await _dio.delete<void>(
      '/api/courses/$courseId/materials/$materialId',
      queryParameters: {'teacherId': teacherId},
    );
  }

  Future<void> reindexMaterial({
    required String courseId,
    required String materialId,
    required String teacherId,
  }) async {
    await _dio.post<void>(
      '/api/courses/$courseId/materials/$materialId/reindex',
      queryParameters: {'teacherId': teacherId},
    );
  }

  Future<void> updateMaterial({
    required String courseId,
    required String materialId,
    String? title,
    String? category,
  }) async {
    await _dio.put<void>(
      '/api/courses/$courseId/materials/$materialId',
      data: {
        if (title != null) 'title': title,
        if (category != null) 'category': category,
      },
    );
  }

  // ── Import tài liệu HTML từ URL ─────────────────────────────────

  Future<HtmlTocPreview> previewHtmlToc({
    required String courseId,
    required String url,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/courses/$courseId/materials/url-toc',
      data: {'url': url},
    );
    return HtmlTocPreview.fromJson(response.data ?? {});
  }

  Future<void> importHtmlUrl({
    required String courseId,
    required String url,
    required String teacherId,
    String? title,
    String? classId,
    String? uploaderRole,
    List<String>? selectedUrls,
    bool followNext = false,
    int? maxPages,
  }) async {
    await _dio.post<void>(
      '/api/courses/$courseId/materials/import-url',
      data: {
        'url': url,
        if (title != null && title.isNotEmpty) 'title': title,
        if (classId != null) 'classId': classId,
        'teacherId': teacherId,
        'uploaderRole': uploaderRole ?? (classId != null ? 'TEACHER' : 'ADMIN'),
        if (selectedUrls != null && selectedUrls.isNotEmpty) 'selectedUrls': selectedUrls,
        'followNext': followNext,
        if (maxPages != null) 'maxPages': maxPages,
      },
    );
  }
}

final coursesRepositoryProvider = Provider<CoursesRepository>((ref) {
  return CoursesRepository(ref.watch(springDioProvider));
});
