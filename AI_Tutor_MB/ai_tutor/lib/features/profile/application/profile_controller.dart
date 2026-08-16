import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/user_profile.dart';
import '../../auth/application/auth_controller.dart';
import '../data/profile_repository.dart';

class ProfileController extends AutoDisposeAsyncNotifier<UserProfile> {
  @override
  Future<UserProfile> build() async {
    final userId = ref.watch(currentUserIdProvider);
    return ref.read(profileRepositoryProvider).fetchProfile(userId);
  }

  Future<void> updateProfile({
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? bio,
    String? address,
    String? city,
  }) async {
    final userId = ref.read(currentUserIdProvider);
    final updated = await ref
        .read(profileRepositoryProvider)
        .updateProfile(
          userId: userId,
          fullName: fullName,
          phone: phone,
          avatarUrl: avatarUrl,
          bio: bio,
          address: address,
          city: city,
        );
    state = AsyncData(updated);
    // Keep the auth session (header/avatar) in sync with the new profile.
    await ref
        .read(authControllerProvider.notifier)
        .applyProfileUpdate(
          fullName: updated.fullName,
          avatarUrl: updated.avatarUrl,
        );
  }
}

final profileControllerProvider =
    AutoDisposeAsyncNotifierProvider<ProfileController, UserProfile>(
      ProfileController.new,
    );
