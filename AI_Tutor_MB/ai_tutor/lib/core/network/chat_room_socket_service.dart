import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../../shared/models/live_chat.dart';
import 'ws_url.dart';

typedef ChatSocketMessageHandler = void Function(LiveChatMessage message);

/// Kết nối `/ws/chat` cho một phòng live chat mentor-student.
class ChatRoomSocketService {
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  String? _token;
  String? _chatRoomId;
  bool _manualClose = false;

  final _connectionController = StreamController<bool>.broadcast();
  ChatSocketMessageHandler? onMessage;

  Stream<bool> get connectionChanges => _connectionController.stream;
  bool get isConnected => _channel != null;

  Future<void> connect({
    required String token,
    required String chatRoomId,
  }) async {
    final trimmedToken = token.trim();
    if (trimmedToken.isEmpty || chatRoomId.isEmpty) return;
    if (_token == trimmedToken &&
        _chatRoomId == chatRoomId &&
        _channel != null) {
      return;
    }

    await disconnect(manual: true);
    _token = trimmedToken;
    _chatRoomId = chatRoomId;
    _manualClose = false;
    await _openChannel();
  }

  Future<void> disconnect({bool manual = true}) async {
    _manualClose = manual;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _pingTimer?.cancel();
    _pingTimer = null;
    await _subscription?.cancel();
    _subscription = null;
    await _channel?.sink.close();
    _channel = null;
    if (manual) {
      _token = null;
      _chatRoomId = null;
    }
    _connectionController.add(false);
  }

  Future<void> sendText({
    required String content,
    required String senderName,
    String messageType = 'TEXT',
  }) async {
    if (!isConnected) {
      throw StateError('Chat WebSocket chưa kết nối');
    }
    _sendJson({
      'type': 'SEND_MESSAGE',
      'content': content,
      'senderName': senderName,
      'messageType': messageType,
    });
  }

  Future<void> _openChannel() async {
    final token = _token;
    final chatRoomId = _chatRoomId;
    if (token == null ||
        chatRoomId == null ||
        token.isEmpty ||
        chatRoomId.isEmpty ||
        _manualClose) {
      return;
    }

    try {
      final channel = WebSocketChannel.connect(
        Uri.parse(
          chatWebSocketUrl(token: token, chatRoomId: chatRoomId),
        ),
      );
      _channel = channel;
      _connectionController.add(true);

      _subscription = channel.stream.listen(
        _onMessage,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
        cancelOnError: true,
      );

      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
        _sendJson({'type': 'PING'});
      });
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _onMessage(dynamic raw) {
    if (raw is! String) return;
    try {
      final json = jsonDecode(raw);
      if (json is! Map) return;
      final map = Map<String, dynamic>.from(json);
      final type = map['type']?.toString() ?? '';
      if (type == 'PONG' || type == 'CONNECTED') return;
      if (type != 'NEW_MESSAGE') return;

      final messageJson = map['message'];
      if (messageJson is! Map) return;
      final message = LiveChatMessage.fromJson(
        Map<String, dynamic>.from(messageJson),
      );
      onMessage?.call(message);
    } catch (_) {}
  }

  void _sendJson(Map<String, dynamic> payload) {
    final channel = _channel;
    if (channel == null) return;
    channel.sink.add(jsonEncode(payload));
  }

  void _scheduleReconnect() {
    if (_manualClose || _token == null || _chatRoomId == null) return;
    _channel = null;
    _connectionController.add(false);
    _pingTimer?.cancel();
    _pingTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _openChannel);
  }

  void dispose() {
    disconnect(manual: true);
    _connectionController.close();
  }
}
