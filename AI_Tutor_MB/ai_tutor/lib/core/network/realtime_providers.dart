import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'chat_room_socket_service.dart';
import 'events_socket_service.dart';
import 'realtime_event.dart';
import '../../features/auth/application/auth_controller.dart';

final eventsSocketServiceProvider = Provider<EventsSocketService>((ref) {
  final service = EventsSocketService();
  ref.onDispose(service.dispose);
  return service;
});

final chatRoomSocketServiceProvider = Provider<ChatRoomSocketService>((ref) {
  final service = ChatRoomSocketService();
  ref.onDispose(service.dispose);
  return service;
});

/// Tick tăng khi có realtime event — các controller invalidate/refetch theo tick.
final realtimeRefreshTickProvider = StateProvider<int>((ref) => 0);

final realtimeEventsProvider = StreamProvider<RealtimeEvent>((ref) {
  ref.watch(realtimeConnectionProvider);
  return ref.watch(eventsSocketServiceProvider).events;
});

/// Giữ kết nối `/ws/events` khi đã đăng nhập.
final realtimeConnectionProvider = Provider<void>((ref) {
  final service = ref.watch(eventsSocketServiceProvider);

  ref.listen(authControllerProvider, (previous, next) {
    final token = next.valueOrNull?.token?.trim();
    if (token == null || token.isEmpty) {
      service.disconnect();
      return;
    }
    service.connect(token);
  }, fireImmediately: true);

  ref.onDispose(service.disconnect);
});

/// Lắng nghe event và bump refresh tick cho materials / inbox / notifications.
final realtimeRefreshListenerProvider = Provider<void>((ref) {
  ref.watch(realtimeConnectionProvider);

  ref.listen(realtimeEventsProvider, (_, next) {
    next.whenData((event) {
      if (_shouldRefresh(event.type.toUpperCase(), event.entityType)) {
        ref.read(realtimeRefreshTickProvider.notifier).state++;
      }
    });
  });
});

bool _shouldRefresh(String type, String? entityType) {
  if (type.contains('MATERIAL') ||
      type.contains('INDEX') ||
      entityType == 'COURSE_MATERIAL') {
    return true;
  }
  if (type.contains('ASSIGNMENT') || entityType == 'ASSIGNMENT') {
    return true;
  }
  if (type.contains('EXPERT') ||
      type.contains('GOLD_QA') ||
      type.contains('RUBRIC') ||
      type.contains('EVAL_RUN')) {
    return true;
  }
  if (type.contains('GRADING') || type.contains('AI_GRADING')) {
    return true;
  }
  if (type.contains('ANSWER_REVIEW') || entityType == 'AI_ANSWER_REVIEW') {
    return true;
  }
  if (type.contains('KNOWLEDGE_CANDIDATE') ||
      entityType == 'KNOWLEDGE_CANDIDATE') {
    return true;
  }
  if (type.contains('ESCALATION') || entityType == 'QUESTION_ESCALATION') {
    return true;
  }
  return false;
}
