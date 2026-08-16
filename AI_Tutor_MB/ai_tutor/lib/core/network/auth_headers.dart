import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'network_providers.dart';

/// HTTP headers for protected BE assets (`/api/courses/.../pdf`, page images).
final authHeadersProvider = FutureProvider<Map<String, String>>((ref) async {
  final token = (await ref.read(secureStorageProvider).read(key: 'auth_token'))
      ?.trim();
  if (token == null || token.isEmpty) return const {};
  return {'Authorization': 'Bearer $token'};
});
