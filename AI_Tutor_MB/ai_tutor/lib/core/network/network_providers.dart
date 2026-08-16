import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../features/auth/application/auth_controller.dart';
import 'dio_client.dart';

const _secureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);

final secureStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => _secureStorage,
);

Future<void> _handleUnauthorized(Ref ref) async {
  await ref.read(authControllerProvider.notifier).logout();
}

final springDioProvider = Provider<Dio>((ref) {
  return buildSpringDio(
    ref.watch(secureStorageProvider),
    onUnauthorized: () => _handleUnauthorized(ref),
  );
});

final n8nDioProvider = Provider<Dio>((ref) {
  return buildN8nDio(
    ref.watch(secureStorageProvider),
    onUnauthorized: () => _handleUnauthorized(ref),
  );
});
