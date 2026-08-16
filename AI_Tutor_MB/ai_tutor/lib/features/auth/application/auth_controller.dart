import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/status_style.dart';
import '../../../shared/models/auth_session.dart';
import '../data/auth_repository.dart';

class AuthController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() {
    return ref.read(authRepositoryProvider).readStoredSession();
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(email, password),
    );
  }

  Future<void> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(authRepositoryProvider)
          .register(
            email: email,
            password: password,
            fullName: fullName,
            phone: phone,
          ),
    );
  }

  /// Đồng bộ tên/avatar vào session hiện tại sau khi người dùng sửa hồ sơ.
  Future<void> applyProfileUpdate({
    required String fullName,
    String? avatarUrl,
  }) async {
    final current = state.valueOrNull;
    if (current == null) return;
    await ref
        .read(authRepositoryProvider)
        .updateStoredProfile(fullName: fullName, avatarUrl: avatarUrl);
    state = AsyncData(
      current.copyWith(fullName: fullName, avatarUrl: avatarUrl),
    );
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

final currentUserIdProvider = Provider<String>((ref) {
  final session = ref.watch(authControllerProvider).valueOrNull;
  if (session == null) {
    throw StateError('User not authenticated');
  }
  return session.userId;
});

/// Class sections, dashboards, and inbox APIs store the teacher Mongo user id.
final currentTeacherIdProvider = Provider<String>((ref) {
  return ref.watch(currentUserIdProvider);
});

final isTeacherRoleProvider = Provider<bool>((ref) {
  final role = ref.watch(authControllerProvider).valueOrNull?.role;
  if (role == null) return false;
  return isTeacherRole(role);
});

final isAdminRoleProvider = Provider<bool>((ref) {
  final role = ref.watch(authControllerProvider).valueOrNull?.role;
  if (role == null) return false;
  return isAdminRole(role);
});

final currentUserRoleProvider = Provider<String>((ref) {
  return ref.watch(authControllerProvider).valueOrNull?.role ?? 'STUDENT';
});

final currentAuthTokenProvider = Provider<String?>((ref) {
  return ref.watch(authControllerProvider).valueOrNull?.token;
});
