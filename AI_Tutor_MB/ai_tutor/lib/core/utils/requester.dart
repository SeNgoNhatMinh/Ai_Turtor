import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/auth_controller.dart';

({String requesterId, String requesterRole}) readRequester(Ref ref) {
  final session = ref.read(authControllerProvider).valueOrNull;
  if (session == null) {
    throw StateError('Not authenticated');
  }
  return (requesterId: session.userId, requesterRole: session.role);
}
