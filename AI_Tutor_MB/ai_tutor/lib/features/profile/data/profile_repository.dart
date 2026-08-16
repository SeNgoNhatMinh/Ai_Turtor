import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/user_profile.dart';

class ProfileRepository {
  ProfileRepository(this._dio);

  final Dio _dio;

  Future<UserProfile> fetchProfile(String userId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/users/$userId/profile',
      );
      return UserProfile.fromJson(response.data ?? {});
    } on DioException catch (error) {
      if (error.response?.statusCode != 404) rethrow;
      return _fetchMentorProfile(userId);
    }
  }

  Future<UserProfile> _fetchMentorProfile(String userId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/mentors/$userId',
    );
    final mentor = unwrapMap(response.data, keys: ['mentor']);
    return UserProfile.fromJson({
      ...mentor,
      'userId': mentor['id'] ?? userId,
      'fullName': mentor['name'] ?? mentor['fullName'],
      'role': 'TEACHER',
    });
  }

  Future<UserProfile> updateProfile({
    required String userId,
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? bio,
    String? address,
    String? city,
  }) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/api/users/$userId/profile',
      data: {
        if (fullName != null) 'fullName': fullName,
        if (phone != null) 'phone': phone,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (bio != null) 'bio': bio,
        if (address != null) 'address': address,
        if (city != null) 'city': city,
      },
    );
    return UserProfile.fromJson(response.data ?? {});
  }

  Future<void> changePassword({
    required String userId,
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.put<void>(
      '/api/users/$userId/password',
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(springDioProvider));
});
