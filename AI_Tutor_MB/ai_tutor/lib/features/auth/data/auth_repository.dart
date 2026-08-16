import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../core/utils/status_style.dart';
import '../../../shared/models/auth_session.dart';

class AuthRepository {
  AuthRepository(this._dio, this._storage);

  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<AuthSession?> readStoredSession() async {
    final userId = await _storage.read(key: 'user_id');
    final role = await _storage.read(key: 'role');
    final token = (await _storage.read(key: 'auth_token'))?.trim();
    if (userId == null || role == null) return null;
    if (token == null || token.isEmpty) return null;

    var session = AuthSession(
      userId: userId,
      role: role,
      fullName: await _storage.read(key: 'full_name') ?? '',
      email: await _storage.read(key: 'email'),
      avatarUrl: await _storage.read(key: 'avatar_url'),
      token: token,
      mentorCode: await _storage.read(key: 'mentor_code'),
    );
    if (isTeacherRole(role) &&
        !isAdminRole(role) &&
        (session.mentorCode == null || session.mentorCode!.isEmpty)) {
      final code = await _resolveMentorCode(userId);
      if (code != null && code.isNotEmpty) {
        await _storage.write(key: 'mentor_code', value: code);
        session = session.copyWith(mentorCode: code);
      }
    }
    return session;
  }

  static final _authOptions = Options(receiveTimeout: authReceiveTimeout);

  Future<AuthSession> login(String email, String password) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/users/login',
      data: {'email': email, 'password': password},
      options: _authOptions,
    );
    final data = Map<String, dynamic>.from(response.data!);
    // Dùng role từ login response nếu có; fallback sang profile endpoint
    // (404 → TEACHER vì mentor không lưu trong bảng users).
    final loginRole = data['role'] as String?;
    if (loginRole == null || loginRole.isEmpty) {
      data['role'] = await _resolveRole(data['userId'] as String?);
    }
    final role = data['role'] as String? ?? 'STUDENT';
    if (isTeacherRole(role) && !isAdminRole(role)) {
      data['mentorCode'] = await _resolveMentorCode(data['userId'] as String);
    }
    await _persistSession(data, email: email);
    return AuthSession.fromJson({...data, 'email': email});
  }

  Future<String?> _resolveMentorCode(String userId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/mentors/$userId',
        options: _authOptions,
      );
      final mentor = unwrapMap(res.data, keys: ['mentor']);
      final code = mentor['code']?.toString() ?? mentor['mentorCode']?.toString();
      if (code != null && code.isNotEmpty) return code;
    } on DioException catch (_) {}
    return null;
  }

  Future<String> _resolveRole(String? userId) async {
    if (userId == null) return 'STUDENT';
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/users/$userId/profile',
        options: _authOptions,
      );
      final role = res.data?['role'] as String?;
      return (role == null || role.isEmpty) ? 'STUDENT' : role;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return 'TEACHER';
      return 'STUDENT';
    }
  }

  Future<AuthSession> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/users/register',
      data: {
        'email': email,
        'password': password,
        'fullName': fullName,
        if (phone != null) 'phone': phone,
      },
      options: _authOptions,
    );
    // Backend register chỉ trả userId + token; role mặc định STUDENT (design guide §15).
    final data = <String, dynamic>{
      ...response.data!,
      'role': response.data!['role'] ?? 'STUDENT',
      'fullName': response.data!['fullName'] ?? fullName,
    };
    await _persistSession(data, email: email);
    return AuthSession.fromJson({...data, 'email': email});
  }

  /// Cập nhật thông tin hiển thị (tên/avatar) đã lưu cục bộ sau khi sửa hồ sơ.
  Future<void> updateStoredProfile({
    required String fullName,
    String? avatarUrl,
  }) async {
    await _storage.write(key: 'full_name', value: fullName);
    if (avatarUrl != null) {
      await _storage.write(key: 'avatar_url', value: avatarUrl);
    }
  }

  Future<void> logout() => _storage.deleteAll();

  Future<void> _persistSession(Map<String, dynamic> data, {String? email}) async {
    final userId = data['userId'] as String?;
    if (userId == null) {
      throw StateError('Auth response missing userId');
    }

    final token = data['token'] as String?;
    if (token == null || token.trim().isEmpty) {
      throw StateError(
        'Backend không trả JWT. Kiểm tra ai-tutor-api (:8085) và đăng nhập lại.',
      );
    }
    await _storage.write(key: 'auth_token', value: token.trim());
    await _storage.write(key: 'user_id', value: userId);
    await _storage.write(
      key: 'role',
      value: data['role'] as String? ?? 'STUDENT',
    );
    await _storage.write(
      key: 'full_name',
      value: data['fullName'] as String? ?? '',
    );
    final resolvedEmail = email ?? data['email'] as String?;
    if (resolvedEmail != null && resolvedEmail.isNotEmpty) {
      await _storage.write(key: 'email', value: resolvedEmail);
    }
    final avatarUrl = data['avatarUrl'] as String?;
    if (avatarUrl != null) {
      await _storage.write(key: 'avatar_url', value: avatarUrl);
    }
    final mentorCode = data['mentorCode'] as String?;
    if (mentorCode != null && mentorCode.isNotEmpty) {
      await _storage.write(key: 'mentor_code', value: mentorCode);
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(springDioProvider),
    ref.watch(secureStorageProvider),
  );
});
