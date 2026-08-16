import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/admin_models.dart';
import '../../../shared/models/class_section.dart';
import '../../../shared/models/course.dart';

class AdminRepository {
  AdminRepository(this._dio);
  final Dio _dio;

  // ── Dashboard ─────────────────────────────────────────────────

  Future<AdminStats> getDashboardStats() async {
    try {
      final res = await _dio.get('/api/admin/dashboard/stats');
      final data = unwrapMap(res.data);
      return AdminStats.fromJson(data);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        throw StateError(
          'Phiên đăng nhập không hợp lệ hoặc đã hết hạn '
          '(hay gặp sau khi rebuild Docker). '
          'Hãy đăng xuất và đăng nhập lại bằng admin@system.local.',
        );
      }
      rethrow;
    }
  }

  // ── Users ─────────────────────────────────────────────────────

  Future<List<AdminUser>> listUsers({String? query, String? role, bool? active}) async {
    final res = await _dio.get('/api/admin/users', queryParameters: {
      if (query != null && query.isNotEmpty) 'q': query,
      if (role != null && role.isNotEmpty) 'role': role,
      if (active != null) 'active': active,
    });
    final data = res.data as Map<String, dynamic>;
    return parseList(data['users'], AdminUser.fromJson);
  }

  Future<AdminUser> updateUser(String userId, {bool? isActive, String? role}) async {
    final res = await _dio.patch('/api/admin/users/$userId', data: {
      if (isActive != null) 'isActive': isActive,
      if (role != null) 'role': role,
    });
    return AdminUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteUser(String userId) async {
    await _dio.delete('/api/admin/users/$userId');
  }

  // ── Semesters ─────────────────────────────────────────────────

  Future<List<Semester>> listSemesters() async {
    final res = await _dio.get('/api/admin/semesters');
    return parseList(res.data, Semester.fromJson);
  }

  Future<Semester> saveSemester({
    required String semesterCode,
    String? name,
    String status = 'ACTIVE',
  }) async {
    final res = await _dio.post('/api/admin/semesters', data: {
      'semesterCode': semesterCode,
      if (name != null && name.isNotEmpty) 'name': name,
      'status': status,
    });
    return Semester.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteSemester(String semesterCode) async {
    await _dio.delete('/api/admin/semesters/$semesterCode');
  }

  // ── Courses (admin: all, not filtered by teacher) ─────────────

  Future<List<Course>> listAllCourses() async {
    final res = await _dio.get('/api/admin/courses');
    return parseList(res.data, Course.fromJson);
  }

  Future<Course> saveCourse({
    required String courseId,
    required String courseCode,
    required String name,
    String? semesterCode,
    String status = 'ACTIVE',
  }) async {
    final res = await _dio.post('/api/admin/courses', data: {
      'courseId': courseId,
      'code': courseCode,
      'name': name,
      if (semesterCode != null && semesterCode.isNotEmpty) 'semesterId': semesterCode,
      'status': status,
    });
    return Course.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteCourse(String courseId) async {
    await _dio.delete('/api/admin/courses/$courseId');
  }

  // ── Class sections (admin: all) ───────────────────────────────

  Future<List<ClassSection>> listAllClasses(String courseId) async {
    final res = await _dio.get('/api/courses/$courseId/class-sections');
    return parseList(res.data, ClassSection.fromJson);
  }

  Future<ClassSection> saveClassSection({
    required String courseId,
    required String classId,
    required String className,
    String? teacherId,
    int? maxStudents,
  }) async {
    final res = await _dio.post('/api/admin/courses/$courseId/class-sections', data: {
      'classId': classId,
      'className': className,
      'courseId': courseId,
      if (teacherId != null && teacherId.isNotEmpty) 'teacherId': teacherId,
      if (maxStudents != null) 'maxStudents': maxStudents,
    });
    return ClassSection.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteClassSection(String courseId, String classId) async {
    await _dio.delete('/api/admin/courses/$courseId/class-sections/$classId');
  }

  Future<void> completeCourse(String courseId) async {
    await _dio.patch('/api/admin/courses/$courseId/complete');
  }

  Future<void> completeClassSection(String courseId, String classId) async {
    await _dio.patch('/api/admin/courses/$courseId/class-sections/$classId/complete');
  }

  // ── Roster: thêm/xoá từng sinh viên riêng lẻ ────────────────────

  Future<List<Map<String, dynamic>>> listClassStudents(
    String courseId,
    String classId,
  ) async {
    final res = await _dio.get(
      '/api/courses/$courseId/class-sections/$classId/students',
    );
    final data = res.data as Map<String, dynamic>;
    return (data['students'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<void> enrollStudent({
    required String courseId,
    required String classId,
    required String studentId,
    String? studentName,
    String? studentEmail,
  }) async {
    await _dio.post('/api/admin/class-sections/$courseId/$classId/students', data: {
      'students': [
        {
          'studentId': studentId,
          if (studentName != null && studentName.isNotEmpty) 'studentName': studentName,
          if (studentEmail != null && studentEmail.isNotEmpty) 'studentEmail': studentEmail,
        },
      ],
    });
  }

  Future<void> removeStudentFromClass({
    required String courseId,
    required String classId,
    required String studentId,
  }) async {
    await _dio.delete('/api/admin/class-sections/$courseId/$classId/students/$studentId');
  }

  // ── Import teachers ───────────────────────────────────────────

  /// URL tải file mẫu Excel để import giảng viên (mở bằng trình duyệt/app
  /// ngoài, tương tự cách app xem PDF tài liệu).
  String mentorImportTemplateUrl() {
    final base = _dio.options.baseUrl.replaceAll(RegExp(r'/$'), '');
    return '$base/api/mentors/import/template.xlsx';
  }

  Future<Map<String, dynamic>> importTeachersExcel(
    List<int> fileBytes,
    String fileName, {
    bool dryRun = false,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        fileBytes,
        filename: fileName,
        contentType: DioMediaType('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ),
      if (dryRun) 'dryRun': 'true',
    });
    final res = await _dio.post('/api/mentors/import', data: formData);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> importStudentsExcel(
    String courseId,
    String classId,
    List<int> fileBytes,
    String fileName,
  ) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        fileBytes,
        filename: fileName,
        contentType: DioMediaType('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ),
    });
    final res = await _dio.post(
      '/api/admin/class-sections/$courseId/$classId/students/import',
      data: formData,
    );
    return res.data as Map<String, dynamic>;
  }

  // ── Mentors (admin management) ─────────────────────────────────

  Future<List<AdminMentor>> listMentors({
    String? query,
    bool? active,
    bool? verified,
  }) async {
    final res = await _dio.get('/api/admin/mentors', queryParameters: {
      if (query != null && query.isNotEmpty) 'q': query,
      if (active != null) 'active': active,
      if (verified != null) 'verified': verified,
    });
    final data = res.data as Map<String, dynamic>;
    return parseList(data['mentors'], AdminMentor.fromJson);
  }

  Future<AdminMentor> updateMentor(
    String mentorId, {
    bool? isActive,
    bool? verified,
  }) async {
    final res = await _dio.patch('/api/admin/mentors/$mentorId', data: {
      if (isActive != null) 'isActive': isActive,
      if (verified != null) 'verified': verified,
    });
    return AdminMentor.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteMentor(String mentorId) async {
    await _dio.delete('/api/admin/mentors/$mentorId');
  }

  // ── Mentor escalations (admin oversight) ───────────────────────

  Future<List<AdminMentorEscalation>> listMentorEscalations({String? status}) async {
    final res = await _dio.get('/api/admin/mentor-escalations', queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
    });
    final data = res.data as Map<String, dynamic>;
    return parseList(data['escalations'], AdminMentorEscalation.fromJson);
  }

  Future<void> deleteMentorEscalation(String escalationId) async {
    await _dio.delete('/api/admin/mentor-escalations/$escalationId');
  }

  // ── Subscriptions ─────────────────────────────────────────────

  Future<List<SubscriptionPlan>> listPlans() async {
    final res = await _dio.get('/api/admin/subscription-plans', queryParameters: {
      'includeInactive': true,
    });
    final data = res.data as Map<String, dynamic>;
    return parseList(data['plans'], SubscriptionPlan.fromJson);
  }

  Future<List<UserSubscription>> listSubscriptions({String? userId, bool activeOnly = false}) async {
    final res = await _dio.get('/api/admin/subscriptions', queryParameters: {
      if (userId != null && userId.isNotEmpty) 'userId': userId,
      if (activeOnly) 'activeOnly': true,
    });
    final data = res.data as Map<String, dynamic>;
    return parseList(data['subscriptions'], UserSubscription.fromJson);
  }

  Future<UserSubscription> assignPlan({
    required String userId,
    required String planCode,
  }) async {
    final res = await _dio.post('/api/admin/subscriptions/assign', data: {
      'userId': userId,
      'planCode': planCode,
    });
    return UserSubscription.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteSubscription(String subscriptionId) async {
    await _dio.delete('/api/admin/subscriptions/$subscriptionId');
  }

  Future<UserSubscription> updateSubscriptionStatus(
    String subscriptionId,
    String status,
  ) async {
    final res = await _dio.patch(
      '/api/admin/subscriptions/$subscriptionId/status',
      data: {'status': status},
    );
    return UserSubscription.fromJson(res.data as Map<String, dynamic>);
  }

  Future<SubscriptionPlan> updatePlan(
    String planId, {
    String? name,
    String? description,
    double? price,
    int? durationDays,
    bool? isActive,
  }) async {
    final res = await _dio.put('/api/admin/subscription-plans/$planId', data: {
      if (name != null) 'name': name,
      if (description != null) 'description': description,
      if (price != null) 'price': price,
      if (durationDays != null) 'durationDays': durationDays,
      if (isActive != null) 'isActive': isActive,
    });
    return SubscriptionPlan.fromJson(res.data as Map<String, dynamic>);
  }
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.watch(springDioProvider));
});
