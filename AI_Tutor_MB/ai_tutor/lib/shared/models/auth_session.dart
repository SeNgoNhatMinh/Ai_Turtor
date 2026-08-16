class AuthSession {
  const AuthSession({
    required this.userId,
    required this.role,
    required this.fullName,
    this.email,
    this.avatarUrl,
    this.token,
    this.mentorCode,
  });

  final String userId;
  final String role;
  final String fullName;
  final String? email;
  final String? avatarUrl;
  final String? token;

  /// Business id used by backend class/mentor APIs (e.g. `TEACHER_A`).
  final String? mentorCode;

  AuthSession copyWith({
    String? fullName,
    String? avatarUrl,
    String? email,
    String? mentorCode,
  }) {
    return AuthSession(
      userId: userId,
      role: role,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      token: token,
      mentorCode: mentorCode ?? this.mentorCode,
    );
  }

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      userId: json['userId'] as String,
      role: json['role'] as String? ?? 'STUDENT',
      fullName: json['fullName'] as String? ?? '',
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      token: json['token'] as String?,
      mentorCode: json['mentorCode'] as String?,
    );
  }
}
