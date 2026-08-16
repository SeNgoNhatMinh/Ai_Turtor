import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/live_chat.dart';

class ChatRepository {
  ChatRepository(this._dio);

  final Dio _dio;

  Future<ChatRoomDetail> fetchDetail(String chatRoomId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/chat/detail',
      queryParameters: {'chatRoomId': chatRoomId},
    );
    return ChatRoomDetail.fromJson(unwrapMap(response.data));
  }

  Future<List<LiveChatMessage>> fetchHistory({
    required String chatRoomId,
    int page = 0,
    int size = 50,
  }) async {
    final response = await _dio.get<dynamic>(
      '/api/chat/history',
      queryParameters: {'chatRoomId': chatRoomId, 'page': page, 'size': size},
    );
    // Backend trả ChatHistoryResponse { ..., messages: [...] }.
    return parseListSafe(
      unwrapList(response.data, ['messages']),
      LiveChatMessage.fromJson,
    ).reversed.toList();
  }

  Future<LiveChatMessage> sendMessage({
    required String chatRoomId,
    required String senderId,
    required String senderName,
    required String senderRole,
    required String content,
    String messageType = 'TEXT',
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/chat/send',
      data: {
        'chatRoomId': chatRoomId,
        'senderId': senderId,
        'senderName': senderName,
        'senderRole': senderRole,
        'content': content,
        'messageType': messageType,
      },
    );
    return LiveChatMessage.fromJson(unwrapMap(response.data));
  }

  Future<void> markRead({
    required String chatRoomId,
    required String userId,
  }) async {
    await _dio.post<void>(
      '/api/chat/mark-read',
      data: {'chatRoomId': chatRoomId, 'userId': userId},
    );
  }

  Future<void> closeRoom({
    required String chatRoomId,
    required String userId,
    int? userRating,
    String? userFeedback,
  }) async {
    await _dio.post<void>(
      '/api/chat/close',
      data: {
        'chatRoomId': chatRoomId,
        'userId': userId,
        if (userRating != null) 'userRating': userRating,
        if (userFeedback != null) 'userFeedback': userFeedback,
      },
    );
  }

  Future<ChatUnreadSummary> fetchUnread({
    required String userId,
    required String role,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/chat/unread',
      queryParameters: {'userId': userId, 'role': role},
    );
    return ChatUnreadSummary.fromJson(response.data ?? {});
  }
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepository(ref.watch(springDioProvider));
});
