import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/routes.dart';
import '../../../core/network/realtime_providers.dart';
import '../../../core/utils/status_style.dart';
import '../../../shared/models/notification_item.dart';
import '../../auth/application/auth_controller.dart';
import '../../escalation/data/chat_repository.dart';
import '../../inbox/application/teacher_inbox_controller.dart';
import '../../senior/application/senior_controller.dart';

class NotificationsController
    extends AutoDisposeAsyncNotifier<List<AppNotification>> {
  @override
  Future<List<AppNotification>> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final session = ref.watch(authControllerProvider).valueOrNull;
    if (session == null) return [];

    final items = <AppNotification>[];

    if (isTeacherRole(session.role)) {
      items.addAll(await _teacherNotifications());
      if (isSeniorRole(session.role)) {
        items.addAll(await _seniorNotifications());
      }
    } else {
      items.addAll(await _studentNotifications(session.userId));
    }

    return items;
  }

  Future<List<AppNotification>> _studentNotifications(String userId) async {
    final items = <AppNotification>[];

    try {
      final unread = await ref
          .read(chatRepositoryProvider)
          .fetchUnread(userId: userId, role: 'STUDENT');
      if (unread.totalUnread > 0) {
        final chatRoomId = unread.rooms.isNotEmpty
            ? unread.rooms.first.chatRoomId
            : null;
        items.add(
          AppNotification(
            id: 'chat-unread',
            title: 'Tin nhắn chưa đọc',
            message:
                'Bạn có ${unread.totalUnread} tin nhắn live chat chưa đọc.',
            type: 'CHAT',
            route: chatRoomId != null
                ? AppRoutes.liveChat(chatRoomId)
                : AppRoutes.escalationHistory,
          ),
        );
      }
    } catch (_) {}

    return items;
  }

  Future<List<AppNotification>> _teacherNotifications() async {
    final items = <AppNotification>[];

    try {
      final inbox = await ref.read(teacherInboxControllerProvider.future);
      if (inbox.chatUnread > 0) {
        items.add(
          AppNotification(
            id: 'mentor-chat-unread',
            title: 'Live chat chưa đọc',
            message: '${inbox.chatUnread} tin nhắn đang chờ phản hồi.',
            type: 'CHAT',
            route: AppRoutes.teacherInbox,
          ),
        );
      }
      if (inbox.escalationCount > 0) {
        items.add(
          AppNotification(
            id: 'escalations-pending',
            title: 'Escalation chờ trả lời',
            message: '${inbox.escalationCount} câu hỏi cần bạn xử lý.',
            type: 'ESCALATION',
            route: AppRoutes.teacherInbox,
          ),
        );
      }
      if (inbox.reviewCount > 0) {
        items.add(
          AppNotification(
            id: 'reviews-pending',
            title: 'Review mentor',
            message: '${inbox.reviewCount} câu trả lời AI cần xem.',
            type: 'REVIEW',
            route: AppRoutes.teacherInbox,
          ),
        );
      }
    } catch (_) {}

    return items;
  }

  Future<List<AppNotification>> _seniorNotifications() async {
    final items = <AppNotification>[];

    try {
      final queue = await ref.read(seniorQueueControllerProvider.future);
      if (queue.reviews.isNotEmpty) {
        items.add(
          AppNotification(
            id: 'senior-reviews',
            title: 'Review chờ Senior',
            message: '${queue.reviews.length} review cần xử lý.',
            type: 'SENIOR_REVIEW',
            route: AppRoutes.seniorReviewQueue,
          ),
        );
      }
      if (queue.candidates.isNotEmpty) {
        items.add(
          AppNotification(
            id: 'senior-candidates',
            title: 'Tri thức chờ duyệt',
            message: '${queue.candidates.length} candidate chờ index vào AI.',
            type: 'CANDIDATE',
            route: AppRoutes.knowledgeCandidates,
          ),
        );
      }
    } catch (_) {}

    return items;
  }
}

final notificationsControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      NotificationsController,
      List<AppNotification>
    >(NotificationsController.new);

final notificationCountProvider = Provider<int>((ref) {
  return ref
      .watch(notificationsControllerProvider)
      .maybeWhen(data: (items) => items.length, orElse: () => 0);
});
