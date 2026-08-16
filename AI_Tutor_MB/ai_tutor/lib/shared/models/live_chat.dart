import '../../core/utils/json_helpers.dart';

class ChatRoomDetail {
  const ChatRoomDetail({
    required this.id,
    required this.status,
    this.mentorName,
    this.mentorAvatarUrl,
    this.originalQuestion,
    this.aiAnswer,
    this.studentName,
  });

  final String id;
  final String status;
  final String? mentorName;
  final String? mentorAvatarUrl;
  final String? originalQuestion;
  final String? aiAnswer;
  final String? studentName;

  factory ChatRoomDetail.fromJson(Map<String, dynamic> json) {
    return ChatRoomDetail(
      id: readId(json, keys: ['id', 'chatRoomId']),
      status: readString(json, 'status', fallback: 'ACTIVE'),
      mentorName:
          json['mentorName']?.toString() ?? json['mentorFullName']?.toString(),
      mentorAvatarUrl: json['mentorAvatarUrl']?.toString(),
      originalQuestion:
          json['originalQuestion']?.toString() ?? json['question']?.toString(),
      aiAnswer: json['aiAnswer']?.toString() ??
          json['answer']?.toString() ??
          json['aiResponse']?.toString(),
      studentName: json['studentName']?.toString() ?? json['userName']?.toString(),
    );
  }

  bool get isReadOnly =>
      status == 'CLOSED' || status == 'ENDED' || status == 'COMPLETED';
}

class LiveChatMessage {
  const LiveChatMessage({
    required this.id,
    required this.content,
    required this.senderRole,
    this.messageType = 'TEXT',
    this.createdAt,
    this.fileName,
  });

  final String id;
  final String content;
  final String senderRole;
  final String messageType;
  final DateTime? createdAt;
  final String? fileName;

  bool get isUser => senderRole == 'USER' || senderRole == 'STUDENT';

  bool get isSystem => messageType == 'SYSTEM' || senderRole == 'SYSTEM';

  factory LiveChatMessage.fromJson(Map<String, dynamic> json) {
    return LiveChatMessage(
      id: readId(json, keys: ['id', 'messageId']),
      content: readString(
        json,
        'content',
        fallback: readString(
          json,
          'message',
          fallback: readString(json, 'text'),
        ),
      ),
      senderRole: readString(
        json,
        'senderRole',
        fallback: readString(json, 'role', fallback: 'USER'),
      ),
      messageType: readString(json, 'messageType', fallback: 'TEXT'),
      createdAt: parseDateTime(
        json['createdAt'] ?? json['sentAt'] ?? json['timestamp'],
      ),
      fileName: json['fileName']?.toString(),
    );
  }
}

class ChatUnreadSummary {
  const ChatUnreadSummary({this.totalUnread = 0, this.rooms = const []});

  final int totalUnread;
  final List<ChatUnreadRoom> rooms;

  factory ChatUnreadSummary.fromJson(Map<String, dynamic> json) {
    final rawRooms = json['chatRooms'] ?? json['rooms'] ?? json['items'];
    final rooms = <ChatUnreadRoom>[];
    if (rawRooms is List) {
      for (final item in rawRooms) {
        if (item is! Map) continue;
        try {
          rooms.add(ChatUnreadRoom.fromJson(Map<String, dynamic>.from(item)));
        } catch (_) {}
      }
    }

    return ChatUnreadSummary(
      totalUnread:
          ((json['totalUnread'] ?? json['unreadCount']) as num?)?.toInt() ??
          rooms.length,
      rooms: rooms,
    );
  }
}

class ChatUnreadRoom {
  const ChatUnreadRoom({required this.chatRoomId, this.unreadCount = 0});

  final String chatRoomId;
  final int unreadCount;

  factory ChatUnreadRoom.fromJson(Map<String, dynamic> json) {
    return ChatUnreadRoom(
      chatRoomId: readId(json, keys: ['chatRoomId', 'roomId', 'id']),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }
}
