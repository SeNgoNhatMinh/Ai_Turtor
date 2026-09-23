import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_event.dart';
import '../../../core/network/realtime_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/escalation.dart';
import '../../../shared/models/live_chat.dart';
import '../../auth/application/auth_controller.dart';
import '../data/chat_repository.dart';
import '../data/escalation_repository.dart';
import '../data/mentor_support.dart';

class EscalationOfferController
    extends AutoDisposeFamilyAsyncNotifier<EscalationOffer, String> {
  late String _escalationId;

  @override
  Future<EscalationOffer> build(String questionEscalationId) async {
    _escalationId = questionEscalationId;
    ref.listen(realtimeEventsProvider, (_, next) {
      next.whenData((event) {
        final current = state.valueOrNull;
        if (current == null) return;
        final updated = applyTeacherPresenceEvent(current, event);
        if (!identical(updated, current)) {
          state = AsyncData(updated);
        }
      });
    });
    final repo = ref.read(escalationRepositoryProvider);

    String? activeChatRoomId;
    String? escalationStatus;
    String? originalQuestion;
    String? aiAnswer;
    try {
      final detail = await repo.fetchDetail(questionEscalationId);
      final escalation = unwrapMap(detail, keys: ['questionEscalation']);
      escalationStatus = escalation['status']?.toString();
      activeChatRoomId = escalation['chatRoomId']?.toString();
      originalQuestion =
          escalation['originalQuestion']?.toString() ??
          escalation['question']?.toString();
      aiAnswer =
          escalation['aiResponse']?.toString() ??
          escalation['aiAnswer']?.toString();
    } catch (_) {}

    final offer = await repo.fetchOffer(questionEscalationId);
    return offer.copyWith(
      status: escalationStatus ?? offer.status,
      activeChatRoomId: activeChatRoomId,
      originalQuestion: originalQuestion ?? offer.originalQuestion,
      aiAnswer: aiAnswer ?? offer.aiAnswer,
    );
  }

  Future<String> selectMentor(String mentorId) async {
    final current = state.valueOrNull;
    if (current?.hasActiveChat == true) {
      return current!.activeChatRoomId!;
    }

    final userId = ref.read(currentUserIdProvider);
    final result = await ref
        .read(escalationRepositoryProvider)
        .selectMentor(
          userId: userId,
          questionEscalationId: _escalationId,
          selectedMentorId: mentorId,
        );
    ref.invalidateSelf();
    return result.chatRoomId;
  }

  Future<void> cancel() async {
    final userId = ref.read(currentUserIdProvider);
    await ref
        .read(escalationRepositoryProvider)
        .cancel(userId: userId, questionEscalationId: _escalationId);
    ref.invalidateSelf();
  }
}

final escalationOfferControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      EscalationOfferController,
      EscalationOffer,
      String
    >(EscalationOfferController.new);

EscalationOffer applyTeacherPresenceEvent(
  EscalationOffer offer,
  RealtimeEvent event,
) {
  if (event.type.toUpperCase() != 'TEACHER_PRESENCE_CHANGED') return offer;

  final teacherId = (event.data['teacherId'] ?? event.entityId)
      ?.toString()
      .trim();
  if (teacherId == null || teacherId.isEmpty) return offer;

  final rawOnline = event.data['online'];
  final online = rawOnline is bool
      ? rawOnline
      : event.status?.toUpperCase() == 'ONLINE';
  var changed = false;
  final mentors = offer.mentors
      .map((mentor) {
        if (mentor.id != teacherId || mentor.online == online) return mentor;
        changed = true;
        return mentor.copyWith(online: online);
      })
      .toList(growable: false);

  return changed ? offer.copyWith(mentors: mentors) : offer;
}

class EscalationHistoryController
    extends AutoDisposeAsyncNotifier<List<EscalationHistoryItem>> {
  @override
  Future<List<EscalationHistoryItem>> build() async {
    final userId = ref.watch(currentUserIdProvider);
    final items = await ref
        .read(escalationRepositoryProvider)
        .fetchHistory(userId);
    return sortSupportTicketsNewestFirst(items);
  }
}

final escalationHistoryControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      EscalationHistoryController,
      List<EscalationHistoryItem>
    >(EscalationHistoryController.new);

class EscalationDetailController
    extends AutoDisposeFamilyAsyncNotifier<EscalationHistoryItem, String> {
  @override
  Future<EscalationHistoryItem> build(String escalationId) async {
    final raw = await ref
        .read(escalationRepositoryProvider)
        .fetchDetail(escalationId);
    return EscalationHistoryItem.fromDetailJson(raw);
  }
}

final escalationDetailControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      EscalationDetailController,
      EscalationHistoryItem,
      String
    >(EscalationDetailController.new);

class LiveChatData {
  const LiveChatData({
    required this.detail,
    required this.messages,
    this.socketConnected = false,
    this.mentorOnline,
  });

  final ChatRoomDetail detail;
  final List<LiveChatMessage> messages;
  final bool socketConnected;
  final bool? mentorOnline;

  LiveChatData copyWith({
    ChatRoomDetail? detail,
    List<LiveChatMessage>? messages,
    bool? socketConnected,
    bool? mentorOnline,
  }) {
    return LiveChatData(
      detail: detail ?? this.detail,
      messages: messages ?? this.messages,
      socketConnected: socketConnected ?? this.socketConnected,
      mentorOnline: mentorOnline ?? this.mentorOnline,
    );
  }
}

typedef LiveChatRequest = ({
  String chatRoomId,
  String? mentorId,
  bool? mentorOnline,
});

class LiveChatController
    extends AutoDisposeFamilyAsyncNotifier<LiveChatData, LiveChatRequest> {
  Timer? _poll;
  StreamSubscription<bool>? _wsConnectionSub;
  late String _roomId;
  String? _mentorId;
  bool? _mentorOnline;
  bool _wsConnected = false;

  @override
  Future<LiveChatData> build(LiveChatRequest request) async {
    _roomId = request.chatRoomId;
    _mentorId = request.mentorId;
    _mentorOnline = request.mentorOnline;
    ref.listen(realtimeEventsProvider, (_, next) {
      next.whenData(_onPresenceEvent);
    });
    _setupWebSocket();
    _poll = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!_wsConnected) {
        refreshMessages();
      }
    });
    ref.onDispose(_disposeSockets);
    final data = await _loadRoom();
    return data.copyWith(socketConnected: _wsConnected);
  }

  Future<LiveChatData> _loadRoom() async {
    final repo = ref.read(chatRepositoryProvider);
    final detail = await repo.fetchDetail(_roomId);
    _mentorId ??= detail.mentorId;
    final messages = await repo.fetchHistory(chatRoomId: _roomId);
    await _markRead(_roomId);
    return LiveChatData(
      detail: detail,
      messages: messages,
      socketConnected: _wsConnected,
      mentorOnline: _mentorOnline,
    );
  }

  void _onPresenceEvent(RealtimeEvent event) {
    if (event.type.toUpperCase() != 'TEACHER_PRESENCE_CHANGED') return;
    final teacherId = (event.data['teacherId'] ?? event.entityId)
        ?.toString()
        .trim();
    if (teacherId == null || teacherId.isEmpty || teacherId != _mentorId) {
      return;
    }

    final rawOnline = event.data['online'];
    _mentorOnline = rawOnline is bool
        ? rawOnline
        : event.status?.toUpperCase() == 'ONLINE';
    final current = state.valueOrNull;
    if (current != null && current.mentorOnline != _mentorOnline) {
      state = AsyncData(current.copyWith(mentorOnline: _mentorOnline));
    }
  }

  void _setupWebSocket() {
    final session = ref.read(authControllerProvider).valueOrNull;
    final token = session?.token?.trim();
    if (session == null || token == null || token.isEmpty) return;

    final socket = ref.read(chatRoomSocketServiceProvider);
    socket.onMessage = _onWsMessage;
    socket.connect(token: token, chatRoomId: _roomId);

    _wsConnectionSub?.cancel();
    _wsConnectionSub = socket.connectionChanges.listen((connected) {
      _wsConnected = connected;
      if (state.hasValue) {
        final current = state.requireValue;
        state = AsyncData(current.copyWith(socketConnected: connected));
      }
    });
  }

  void _onWsMessage(LiveChatMessage message) {
    if (!state.hasValue) return;
    final current = state.requireValue;
    if (current.messages.any((m) => m.id == message.id)) return;

    final merged =
        [
          ...current.messages.where(
            (m) =>
                !(m.id.startsWith('local-') &&
                    m.content.trim() == message.content.trim()),
          ),
          message,
        ]..sort((a, b) {
          final at = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          final bt = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          return at.compareTo(bt);
        });

    state = AsyncData(
      LiveChatData(
        detail: current.detail,
        messages: merged,
        socketConnected: _wsConnected,
        mentorOnline: current.mentorOnline,
      ),
    );
    _markRead(_roomId);
  }

  void _disposeSockets() {
    _poll?.cancel();
    _wsConnectionSub?.cancel();
    final socket = ref.read(chatRoomSocketServiceProvider);
    socket.onMessage = null;
    socket.disconnect();
  }

  Future<void> reload() async {
    if (!state.hasValue) return;
    try {
      final data = await _loadRoom();
      state = AsyncData(data.copyWith(socketConnected: _wsConnected));
    } catch (_) {}
  }

  Future<void> _markRead(String chatRoomId) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) return;
    await ref
        .read(chatRepositoryProvider)
        .markRead(chatRoomId: chatRoomId, userId: session.userId);
  }

  Future<void> refreshMessages() async {
    if (!state.hasValue) return;
    try {
      final repo = ref.read(chatRepositoryProvider);
      final messages = await repo.fetchHistory(chatRoomId: _roomId);
      final detail = await repo.fetchDetail(_roomId);
      state = AsyncData(
        LiveChatData(
          detail: detail,
          messages: messages,
          socketConnected: _wsConnected,
          mentorOnline: _mentorOnline,
        ),
      );
    } catch (_) {}
  }

  Future<void> sendMessage(String content) async {
    if (content.trim().isEmpty) return;
    if (state.requireValue.detail.isReadOnly) return;

    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) return;

    final optimistic = LiveChatMessage(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      content: content.trim(),
      senderRole: _chatRole(session.role),
      createdAt: DateTime.now(),
    );

    final previous = state.requireValue;
    state = AsyncData(
      LiveChatData(
        detail: previous.detail,
        messages: [...previous.messages, optimistic],
        socketConnected: _wsConnected,
        mentorOnline: previous.mentorOnline,
      ),
    );

    try {
      final socket = ref.read(chatRoomSocketServiceProvider);
      if (socket.isConnected) {
        await socket.sendText(
          content: content.trim(),
          senderName: session.fullName,
        );
      } else {
        await ref
            .read(chatRepositoryProvider)
            .sendMessage(
              chatRoomId: _roomId,
              senderId: session.userId,
              senderName: session.fullName,
              senderRole: _chatRole(session.role),
              content: content.trim(),
            );
        await refreshMessages();
      }
    } catch (error) {
      state = AsyncData(previous);
      rethrow;
    }
  }

  Future<void> closeRoom({int? rating, String? feedback}) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) return;

    await ref
        .read(chatRepositoryProvider)
        .closeRoom(
          chatRoomId: _roomId,
          userId: session.userId,
          userRating: rating,
          userFeedback: feedback,
        );
    ref.invalidateSelf();
  }
}

String _chatRole(String role) {
  if (role == 'STUDENT' || role == 'USER') return 'STUDENT';
  return 'MENTOR';
}

final liveChatControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      LiveChatController,
      LiveChatData,
      LiveChatRequest
    >(LiveChatController.new);

final chatUnreadProvider = FutureProvider.autoDispose<int>((ref) async {
  ref.watch(realtimeRefreshTickProvider);
  final session = ref.watch(authControllerProvider).valueOrNull;
  if (session == null) return 0;
  final summary = await ref
      .read(chatRepositoryProvider)
      .fetchUnread(userId: session.userId, role: _chatRole(session.role));
  return summary.totalUnread;
});
