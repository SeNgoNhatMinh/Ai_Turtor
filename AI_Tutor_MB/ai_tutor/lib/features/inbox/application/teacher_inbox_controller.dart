import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../core/utils/requester.dart';
import '../../../shared/models/live_chat.dart';
import '../../../shared/models/teacher_inbox.dart';
import '../../auth/application/auth_controller.dart';
import '../../escalation/data/chat_repository.dart';
import '../data/teacher_inbox_repository.dart';

class TeacherInboxData {
  const TeacherInboxData({
    required this.liveChats,
    required this.escalations,
    required this.reviews,
    this.chatUnread = 0,
  });

  final List<TeacherEscalationItem> liveChats;
  final List<TeacherEscalationItem> escalations;
  final List<MentorPendingReview> reviews;
  final int chatUnread;

  int get escalationCount => escalations.length;
  int get reviewCount => reviews.length;
}

class TeacherInboxController
    extends AutoDisposeAsyncNotifier<TeacherInboxData> {
  @override
  Future<TeacherInboxData> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final teacherId = ref.watch(currentTeacherIdProvider);
    final requester = readRequester(ref);
    final session = ref.watch(authControllerProvider).valueOrNull;
    final repo = ref.read(teacherInboxRepositoryProvider);
    final chatRepo = ref.read(chatRepositoryProvider);

    final inbox = await repo.fetchInbox(
      teacherId: teacherId,
      requesterId: requester.requesterId,
      requesterRole: requester.requesterRole,
    );

    var reviews = const <MentorPendingReview>[];
    try {
      reviews = await repo.fetchMentorPendingReviews();
    } catch (_) {}

    var chatUnread = 0;
    final unreadRooms = <ChatUnreadRoom>[];
    if (session != null) {
      try {
        final unread = await chatRepo.fetchUnread(
          userId: session.userId,
          role: 'MENTOR',
        );
        chatUnread = unread.totalUnread;
        unreadRooms.addAll(unread.rooms);
      } catch (_) {}
    }

    final liveChats = inbox
        .where(
          (item) =>
              item.status == 'IN_CHAT' &&
              item.chatRoomId != null &&
              item.chatRoomId!.isNotEmpty,
        )
        .toList();

    for (final room in unreadRooms) {
      if (liveChats.any((item) => item.chatRoomId == room.chatRoomId)) {
        continue;
      }
      liveChats.insert(
        0,
        TeacherEscalationItem(
          id: room.chatRoomId,
          status: 'IN_CHAT',
          chatRoomId: room.chatRoomId,
          originalQuestion: 'Live chat chưa đọc',
        ),
      );
    }
    final escalations = inbox
        .where(
          (item) =>
              item.status != 'IN_CHAT' &&
              item.status != 'COMPLETED' &&
              item.status != 'CANCELLED',
        )
        .toList();

    return TeacherInboxData(
      liveChats: liveChats,
      escalations: escalations,
      reviews: reviews,
      chatUnread: chatUnread,
    );
  }

  Future<void> answerEscalation({
    required String escalationId,
    required String answer,
    String? conversationId,
    bool createKnowledgeCandidate = false,
    String? candidateType,
  }) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');

    await ref
        .read(teacherInboxRepositoryProvider)
        .answerEscalation(
          questionEscalationId: escalationId,
          teacherId: ref.read(currentTeacherIdProvider),
          teacherName: session.fullName,
          answer: answer,
          authToken: session.token ?? '',
          conversationId: conversationId,
          createKnowledgeCandidate: createKnowledgeCandidate,
          candidateType: candidateType,
        );
    ref.invalidateSelf();
  }
}

final teacherInboxControllerProvider =
    AutoDisposeAsyncNotifierProvider<TeacherInboxController, TeacherInboxData>(
      TeacherInboxController.new,
    );
