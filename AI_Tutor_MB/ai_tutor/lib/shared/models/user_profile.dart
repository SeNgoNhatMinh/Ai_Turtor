import '../../core/utils/json_helpers.dart';

class UserProfile {
  const UserProfile({
    required this.userId,
    required this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    this.role,
    this.bio,
    this.address,
    this.city,
    this.isActive,
    this.isEmailVerified,
    this.createdAt,
    this.lastLoginAt,
  });

  final String userId;
  final String fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String? role;
  final String? bio;
  final String? address;
  final String? city;
  final bool? isActive;
  final bool? isEmailVerified;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userId: readId(json, keys: ['userId', 'id']),
      fullName: readString(json, 'fullName', fallback: readString(json, 'name')),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      role: json['role']?.toString(),
      bio: json['bio']?.toString(),
      address: json['address']?.toString(),
      city: json['city']?.toString(),
      isActive: json['isActive'] as bool?,
      isEmailVerified: json['isEmailVerified'] as bool?,
      createdAt: parseDateTime(json['createdAt']),
      lastLoginAt: parseDateTime(json['lastLoginAt']),
    );
  }
}
